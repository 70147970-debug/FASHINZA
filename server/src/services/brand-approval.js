/**
 * Brand approval (MERN addition). Every new brand account starts PENDING; an administrator checks the company
 * (usually within 24–48 hours) and approves it — the brand is then shown as a "Verified brand" — or rejects it
 * with a reason. Decisions can be revisited. Until a brand is approved it can sign in and edit its company
 * profile, but cannot create, edit or submit production projects (403 BRAND_NOT_APPROVED).
 *
 * Stored on the user (models/User.js): approvalStatus, approvalNote, approvalReviewedAt, approvalReviewedById.
 * A missing approvalStatus (records created before this feature) counts as APPROVED.
 */
import { ApprovalStatus, ProjectStatus } from "@fashinza/shared/enums.js";
import { withTransaction } from "../db.js";
import { assertRole } from "../lib/access.js";
import { AppError, conflict, invalid, notFound } from "../lib/errors.js";
import { audit, notify } from "../lib/events.js";
import { idOf, toObjectId } from "../lib/ids.js";
import { appLink, composeEmail, sendMailInBackground } from "../lib/mail.js";
import { mapById, oneByRef } from "../lib/relations.js";
import { containsInsensitive, serialize } from "../lib/serialize.js";
import { config } from "../config.js";
import { AuditLog, BrandProfile, Order, Project, User } from "../models/index.js";
import { countBy, resolveAuditTargets } from "./admin.js";

export const BRAND_NOT_APPROVED_MESSAGES = Object.freeze({
  PENDING: "Your brand is waiting for approval (usually 24–48 hours). You can create projects once it's approved.",
  REJECTED: "Your brand was not approved. Contact us if you think this is a mistake.",
});

/** The effective approval status of a user document (missing → APPROVED). */
export function approvalOf(user) {
  return user?.approvalStatus ?? "APPROVED";
}

/** MongoDB filter on `user` for one approval status (APPROVED includes users without the field). */
export function approvalFilter(status) {
  return status === "APPROVED" ? { approvalStatus: { $in: ["APPROVED", null] } } : { approvalStatus: status };
}

/**
 * Throws 403 BRAND_NOT_APPROVED unless the brand behind `actor` is approved. Other roles pass (role checks are
 * the caller's job). Reads the database, not the actor, so a decision applies to sessions that are already open.
 * @param {{ id: string, role: string }} actor
 * @param {import("mongoose").ClientSession} [session]
 */
export async function assertBrandApproved(actor, session) {
  if (actor.role !== "BRAND") return;
  const user = await User.findById(toObjectId(actor.id), { approvalStatus: 1 })
    .session(session ?? null)
    .lean();
  const status = approvalOf(user);
  if (status === "APPROVED") return;
  throw new AppError(BRAND_NOT_APPROVED_MESSAGES[status] ?? BRAND_NOT_APPROVED_MESSAGES.PENDING, "BRAND_NOT_APPROVED");
}

/**
 * Tells every active administrator that a brand registered (in-app inside the registration transaction, and by
 * email once it has committed — call `emailAdminsAboutNewBrand` after the transaction).
 */
export async function notifyAdminsOfNewBrand(session, brand) {
  const admins = await User.find({ role: "ADMIN", status: "ACTIVE" }, { _id: 1, email: 1 })
    .session(session ?? null)
    .lean();
  if (!admins.length) return [];
  await notify(
    session,
    admins.map((a) => idOf(a._id)),
    "SYSTEM",
    "New brand awaiting approval",
    `${brand.organization} (${brand.name}) registered and is waiting for approval. Check the company within 24–48 hours.`,
    `/admin/brands/${brand.id}`,
  );
  return admins.map((a) => a.email);
}

/** Email to the administrators (addresses from notifyAdminsOfNewBrand) about a new brand. Never throws. */
export function emailAdminsAboutNewBrand(adminEmails, brand) {
  if (!adminEmails?.length) return;
  const { text, html } = composeEmail({
    greeting: "Hello,",
    paragraphs: [
      `${brand.organization} registered on Fashinza as a fashion brand (${brand.name}, ${brand.email}).`,
      "The brand cannot create production projects until it is approved. Please check that the company is genuine and approve or reject it within 24–48 hours.",
    ],
    action: { label: "Review the brand", href: appLink(`/admin/brands/${brand.id}`) },
  });
  sendMailInBackground({ to: adminEmails, subject: `New brand awaiting approval: ${brand.organization}`, text, html });
}

// ───────────────────────────── Admin: list, review, decide ─────────────────────────────

const page = (p) => Math.max(1, p ?? 1);
const pages = (total, size) => Math.max(1, Math.ceil(total / size));

/** Brand users matching the search (name, email or company name), optionally one approval status. */
async function brandWhere(f) {
  /** @type {Record<string, unknown>} */
  const where = { role: "BRAND", ...(f.status ? approvalFilter(f.status) : {}) };
  if (f.q) {
    const rx = containsInsensitive(f.q);
    const byCompany = await BrandProfile.distinct("userId", { companyName: rx });
    where.$or = [{ name: rx }, { email: rx }, { _id: { $in: byCompany } }];
  }
  return where;
}

/** Number of projects per brand (all statuses). */
async function projectCounts(brandIds) {
  if (!brandIds.length) return new Map();
  const rows = await Project.aggregate([{ $match: { brandId: { $in: brandIds } } }, { $group: { _id: "$brandId", n: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [idOf(r._id), r.n]));
}

/**
 * Admin brand queue, newest registrations first.
 * @param {{ status?: "PENDING" | "APPROVED" | "REJECTED", q?: string, page?: number }} f
 */
export async function listBrands(actor, f = {}) {
  assertRole(actor, "ADMIN");
  const size = 20;
  const where = await brandWhere(f);
  const [users, total] = await Promise.all([
    User.find(where)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page(f.page) - 1) * size)
      .limit(size)
      .lean(),
    User.countDocuments(where),
  ]);
  const ids = users.map((u) => u._id);
  const [profiles, counts] = await Promise.all([
    oneByRef(BrandProfile, "userId", ids, { userId: 1, companyName: 1, country: 1, city: 1, website: 1, socialLinks: 1 }),
    projectCounts(ids),
  ]);
  const items = users.map((u) => {
    const p = profiles.get(idOf(u._id));
    return {
      id: idOf(u._id),
      name: u.name,
      email: u.email,
      status: u.status,
      profileCompleted: u.profileCompleted,
      createdAt: u.createdAt,
      approvalStatus: approvalOf(u),
      approvalNote: u.approvalNote ?? null,
      approvalReviewedAt: u.approvalReviewedAt ?? null,
      brandProfile: p
        ? {
            companyName: p.companyName,
            country: p.country || null,
            city: p.city ?? null,
            website: p.website ?? null,
            socialLinks: Array.isArray(p.socialLinks) ? p.socialLinks.length : 0,
          }
        : null,
      projectCount: counts.get(idOf(u._id)) ?? 0,
    };
  });
  return { items, total, page: page(f.page), pages: pages(total, size) };
}

/** Brands per approval status (same search as listBrands), for the queue's tab counts. */
export async function countBrandsByApproval(actor, f = {}) {
  assertRole(actor, "ADMIN");
  const rows = await User.aggregate([
    { $match: await brandWhere({ q: f.q }) },
    { $group: { _id: { $ifNull: ["$approvalStatus", "APPROVED"] }, n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(ApprovalStatus.map((s) => [s, rows.find((r) => r._id === s)?.n ?? 0]));
}

/** Brand review page: account, company profile, projects, decisions on the account. */
export async function getBrand(actor, id) {
  assertRole(actor, "ADMIN");
  const oid = toObjectId(id);
  const user = oid ? await User.findOne({ _id: oid, role: "BRAND" }).lean() : null;
  if (!user) throw notFound("Brand");
  const [profile, byStatus, recent, activeOrders, reviewer, entries] = await Promise.all([
    BrandProfile.findOne({ userId: oid }).lean(),
    countBy(Project, "status", ProjectStatus, { brandId: oid }),
    Project.find({ brandId: oid }, { name: 1, status: 1, category: 1, updatedAt: 1 }).sort({ updatedAt: -1, _id: -1 }).limit(5).lean(),
    Order.countDocuments({ brandId: oid, status: { $nin: ["DELIVERED", "CANCELLED"] } }),
    user.approvalReviewedById ? User.findById(user.approvalReviewedById, { name: 1 }).lean() : null,
    AuditLog.find({ targetId: idOf(oid) }).sort({ createdAt: -1, _id: -1 }).limit(50).lean(),
  ]);
  const [actors, targets] = await Promise.all([mapById(User, entries.map((e) => e.actorId), { name: 1 }), resolveAuditTargets(entries)]);
  return {
    brand: {
      id: idOf(user._id),
      name: user.name,
      email: user.email,
      status: user.status,
      statusReason: user.statusReason ?? null,
      profileCompleted: user.profileCompleted,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
      approvalStatus: approvalOf(user),
      approvalNote: user.approvalNote ?? null,
      approvalReviewedAt: user.approvalReviewedAt ?? null,
      approvalReviewedBy: reviewer ? { name: reviewer.name } : null,
    },
    profile: profile ? serialize(BrandProfile, profile) : null,
    projects: {
      total: byStatus.reduce((n, r) => n + r._count, 0),
      byStatus,
      recent: serialize(Project, recent),
      activeOrders,
    },
    history: entries.map((e) => {
      const a = actors.get(idOf(e.actorId));
      return { ...serialize(AuditLog, e), actor: a ? { name: a.name } : null, target: targets[e.targetId] };
    }),
  };
}

/**
 * Admin decision on a brand: APPROVED (the brand is verified; optional note) or REJECTED (reason required).
 * Decisions can be revisited, but not repeated. Audit BRAND_APPROVED / BRAND_REJECTED, in-app notification and
 * email to the brand.
 * @param {"APPROVED" | "REJECTED"} decision
 * @param {string | undefined} note
 */
export async function decideBrandApproval(actor, brandId, decision, note) {
  assertRole(actor, "ADMIN");
  const text = typeof note === "string" && note.trim() ? note.trim() : undefined;
  if (decision === "REJECTED" && !text) throw invalid("Give a reason for rejecting the brand.", { note: "Give a reason for rejecting the brand." });
  /** @type {{ name: string, email: string, companyName: string } | null} */
  let brand = null;
  await withTransaction(async (session) => {
    const id = toObjectId(brandId);
    const user = id ? await User.findOne({ _id: id, role: "BRAND" }, { name: 1, email: 1, approvalStatus: 1 }).session(session).lean() : null;
    if (!user) throw notFound("Brand");
    const from = approvalOf(user);
    if (from === decision) throw conflict(decision === "APPROVED" ? "This brand is already approved." : "This brand has already been rejected.");
    const profile = await BrandProfile.findOne({ userId: id }, { companyName: 1 }).session(session).lean();
    const companyName = profile?.companyName ?? user.name;
    await User.updateOne(
      { _id: id },
      { $set: { approvalStatus: decision, approvalNote: text ?? null, approvalReviewedAt: new Date(), approvalReviewedById: toObjectId(actor.id) } },
      { session },
    );
    await audit(session, {
      actorId: actor.id,
      action: decision === "APPROVED" ? "BRAND_APPROVED" : "BRAND_REJECTED",
      targetType: "User",
      targetId: idOf(id),
      reason: text,
      metadata: { from, to: decision, companyName },
    });
    await notify(
      session,
      idOf(id),
      "VERIFICATION_DECISION",
      decision === "APPROVED" ? "Your brand is approved" : "Brand not approved",
      decision === "APPROVED"
        ? `Fashinza verified ${companyName}. You can now create production projects and get matched with verified factories.${text ? ` Note from the team: ${text}` : ""}`
        : text,
      decision === "APPROVED" ? "/projects/new" : "/dashboard",
    );
    brand = { name: user.name, email: user.email, companyName };
  });
  if (brand) emailBrandDecision(brand, decision, text);
}

/** Email to the brand about the decision (sent after the commit; never throws). */
function emailBrandDecision(brand, decision, note) {
  const firstName = brand.name.split(" ")[0] || brand.name;
  const { text, html } =
    decision === "APPROVED"
      ? composeEmail({
          greeting: `Hello ${firstName},`,
          paragraphs: [
            `Good news: we've checked ${brand.companyName} and approved your brand on Fashinza.`,
            "You can now create production projects. Verified factories that meet every requirement of a project are invited to quote.",
            ...(note ? [`Note from the team: ${note}`] : []),
          ],
          action: { label: "Create a production project", href: appLink("/projects/new") },
        })
      : composeEmail({
          greeting: `Hello ${firstName},`,
          paragraphs: [
            `We've reviewed ${brand.companyName} and could not approve it on Fashinza.`,
            `Reason: ${note}`,
            `You can still sign in and update your company profile. If you think this is a mistake, contact us at ${config.contactEmail}.`,
          ],
          action: { label: "Open Fashinza", href: appLink("/dashboard") },
        });
  sendMailInBackground({
    to: brand.email,
    subject: decision === "APPROVED" ? "Your brand is approved on Fashinza" : "Your Fashinza brand registration",
    text,
    html,
  });
}
