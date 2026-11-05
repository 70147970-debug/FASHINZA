/**
 * Administration (port of src/server/services/admin.ts, plus the admin decisions that lived in
 * src/server/services/profiles.ts — reviewDocument, decideVerification, revokeVerification — and
 * src/server/services/accounts.ts — setUserStatus; docs/mern/api.md §5 places them here).
 */
import { VerificationStatus } from "@fashinza/shared/enums.js";
import { withTransaction } from "../db.js";
import { revokeAllSessions } from "../auth/session.js";
import { assertRole } from "../lib/access.js";
import { conflict, invalid, notFound } from "../lib/errors.js";
import { audit, notify } from "../lib/events.js";
import { idOf, toObjectId } from "../lib/ids.js";
import { by, groupByRef, mapById, nullAwareSort, oneByRef, sortWith } from "../lib/relations.js";
import { containsInsensitive, serialize } from "../lib/serialize.js";
import {
  AuditLog,
  BrandProfile,
  ContactInquiry,
  ManufacturerCapability,
  ManufacturerDocument,
  ManufacturerProfile,
  Order,
  PaymentMilestone,
  PaymentTransaction,
  Project,
  QCReport,
  ReworkTask,
  User,
  WebhookEvent,
  IssueReport,
} from "../models/index.js";

const page = (p) => Math.max(1, p ?? 1);
const pages = (total, size) => Math.max(1, Math.ceil(total / size));

// ───────────────────────────── Users ─────────────────────────────

/** @param {{ q?: string, role?: string, status?: string, page?: number }} f */
export async function listUsers(actor, f = {}) {
  assertRole(actor, "ADMIN");
  const size = 20;
  /** @type {Record<string, unknown>} */
  const where = {
    ...(f.role ? { role: f.role } : {}),
    ...(f.status ? { status: f.status } : {}),
  };
  if (f.q) {
    const rx = containsInsensitive(f.q);
    const [brandUsers, factoryUsers] = await Promise.all([BrandProfile.distinct("userId", { companyName: rx }), ManufacturerProfile.distinct("userId", { businessName: rx })]);
    where.$or = [{ name: rx }, { email: rx }, { _id: { $in: brandUsers } }, { _id: { $in: factoryUsers } }];
  }
  const [users, total] = await Promise.all([
    User.find(where)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page(f.page) - 1) * size)
      .limit(size)
      .lean(),
    User.countDocuments(where),
  ]);
  const ids = users.map((u) => u._id);
  const [brandProfiles, factoryProfiles] = await Promise.all([
    oneByRef(BrandProfile, "userId", ids, { userId: 1, companyName: 1 }),
    oneByRef(ManufacturerProfile, "userId", ids, { userId: 1, businessName: 1, verificationStatus: 1 }),
  ]);
  const items = users.map((u) => {
    const bp = brandProfiles.get(idOf(u._id));
    const mp = factoryProfiles.get(idOf(u._id));
    return {
      id: idOf(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      statusReason: u.statusReason ?? null,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt ?? null,
      profileCompleted: u.profileCompleted,
      brandProfile: bp ? { companyName: bp.companyName } : null,
      manufacturerProfile: mp ? { id: idOf(mp._id), businessName: mp.businessName, verificationStatus: mp.verificationStatus } : null,
    };
  });
  return { items, total, page: page(f.page), pages: pages(total, size) };
}

/**
 * Admin suspends or reactivates an account. Suspension signs the user out everywhere.
 * @param {"ACTIVE" | "SUSPENDED"} status
 */
export async function setUserStatus(actor, userId, status, reason) {
  assertRole(actor, "ADMIN");
  if (userId === actor.id) throw conflict("You cannot change the status of your own account.");
  await withTransaction(async (session) => {
    const id = toObjectId(userId);
    const user = id ? await User.findById(id, { status: 1, role: 1 }).session(session).lean() : null;
    if (!user) throw invalid("User not found.");
    if (user.status === status) throw conflict(`The account is already ${status.toLowerCase()}.`);
    await User.updateOne({ _id: id }, { $set: { status, statusReason: status === "SUSPENDED" ? reason : null } }, { session });
    if (status === "SUSPENDED") await revokeAllSessions(id, session);
    await audit(session, { actorId: actor.id, action: status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED", targetType: "User", targetId: idOf(id), reason });
    await notify(session, idOf(id), "ACCOUNT_STATUS", status === "SUSPENDED" ? "Account suspended" : "Account reactivated", reason);
  });
}

// ───────────────────────────── Factories ─────────────────────────────

/** Profiles of manufacturers whose profile is completed (`user: { profileCompleted: true }`), plus filters. */
async function factoryWhere(f) {
  const completed = await User.distinct("_id", { profileCompleted: true });
  return {
    userId: { $in: completed },
    ...(f.status ? { verificationStatus: f.status } : {}),
    ...(f.q ? { businessName: containsInsensitive(f.q) } : {}),
  };
}

/** @param {{ status?: string, q?: string, page?: number }} f */
export async function listFactories(actor, f = {}) {
  assertRole(actor, "ADMIN");
  const size = 20;
  const where = await factoryWhere(f);
  // Oldest pending requests first so the queue is worked in order.
  const order = nullAwareSort([
    ["verificationRequestedAt", 1, "last"],
    ["createdAt", -1],
    ["_id", -1],
  ]);
  const [profiles, total] = await Promise.all([
    ManufacturerProfile.aggregate([{ $match: where }, order.addFields, order.sort, { $skip: (page(f.page) - 1) * size }, { $limit: size }, order.unset]),
    ManufacturerProfile.countDocuments(where),
  ]);
  const [docCounts, users] = await Promise.all([
    ManufacturerDocument.aggregate([{ $match: { profileId: { $in: profiles.map((p) => p._id) } } }, { $group: { _id: "$profileId", n: { $sum: 1 } } }]),
    mapById(User, profiles.map((p) => p.userId), { email: 1, status: 1 }),
  ]);
  const counts = new Map(docCounts.map((c) => [idOf(c._id), c.n]));
  const items = profiles.map((p) => {
    const u = users.get(idOf(p.userId));
    return {
      ...serialize(ManufacturerProfile, p),
      _count: { documents: counts.get(idOf(p._id)) ?? 0 },
      user: u ? { email: u.email, status: u.status } : null,
    };
  });
  return { items, total, page: page(f.page), pages: pages(total, size) };
}

/** Factories per verification status (same scope and search as listFactories), for the queue's tab counts. */
export async function countFactoriesByStatus(actor, f = {}) {
  assertRole(actor, "ADMIN");
  const rows = await ManufacturerProfile.aggregate([{ $match: await factoryWhere({ q: f.q }) }, { $group: { _id: "$verificationStatus", n: { $sum: 1 } } }]);
  const sorted = sortWith(rows, by((r) => r._id, { enumValues: VerificationStatus }));
  return Object.fromEntries(sorted.map((r) => [r._id, r.n]));
}

export async function getFactory(actor, id) {
  assertRole(actor, "ADMIN");
  const oid = toObjectId(id);
  const p = oid ? await ManufacturerProfile.findById(oid).lean() : null;
  if (!p) throw notFound("Factory");
  const [capabilities, documents, user] = await Promise.all([
    ManufacturerCapability.find({ profileId: p._id }).sort({ _id: 1 }).lean(),
    ManufacturerDocument.find({ profileId: p._id }).sort({ createdAt: -1, _id: -1 }).lean(),
    User.findById(p.userId, { email: 1, name: 1, status: 1, statusReason: 1, createdAt: 1 }).lean(),
  ]);
  // Decisions on the factory, its documents and its account (suspensions), newest first.
  const targetIds = [idOf(p._id), idOf(p.userId), ...documents.map((d) => idOf(d._id))];
  const entries = await AuditLog.find({ targetId: { $in: targetIds } })
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  const actors = await mapById(User, entries.map((e) => e.actorId), { name: 1 });
  const targets = await resolveAuditTargets(entries);
  const history = entries.map((e) => {
    const a = actors.get(idOf(e.actorId));
    return { ...serialize(AuditLog, e), actor: a ? { name: a.name } : null, target: targets[e.targetId] };
  });
  const profile = {
    ...serialize(ManufacturerProfile, p),
    capabilities: serialize(ManufacturerCapability, capabilities),
    documents: serialize(ManufacturerDocument, documents),
    user: user
      ? { id: idOf(user._id), email: user.email, name: user.name, status: user.status, statusReason: user.statusReason ?? null, createdAt: user.createdAt }
      : null,
  };
  return { profile, history };
}

/** Admin review of one uploaded document (e.g. confirming a GOTS certificate is genuine). */
export async function reviewDocument(actor, documentId, status, note) {
  assertRole(actor, "ADMIN");
  if (status === "REJECTED" && !note) throw invalid("Give a reason for rejecting the document.", { note: "Give a reason for rejecting the document." });
  await withTransaction(async (session) => {
    const id = toObjectId(documentId);
    const doc = id ? await ManufacturerDocument.findById(id).session(session).lean() : null;
    const profile = doc ? await ManufacturerProfile.findById(doc.profileId, { userId: 1 }).session(session).lean() : null;
    if (!doc || !profile) throw notFound("Document");
    await ManufacturerDocument.updateOne({ _id: doc._id }, { $set: { status, reviewNote: note ?? null, reviewedAt: new Date() } }, { session });
    await audit(session, {
      actorId: actor.id,
      action: `DOCUMENT_${status}`,
      targetType: "ManufacturerDocument",
      targetId: idOf(doc._id),
      reason: note,
      metadata: { fileName: doc.fileName, certification: doc.certificationName ?? null },
    });
    await notify(
      session,
      profile.userId,
      "VERIFICATION_DECISION",
      `Document ${status === "VERIFIED" ? "verified" : "rejected"}`,
      `${doc.certificationName ?? doc.fileName}${note ? `: ${note}` : ""}`,
      "/factory",
    );
  });
}

/** @param {"VERIFIED" | "REJECTED"} decision */
export async function decideVerification(actor, profileId, decision, reason) {
  assertRole(actor, "ADMIN");
  await withTransaction(async (session) => {
    const id = toObjectId(profileId);
    const profile = id ? await ManufacturerProfile.findById(id).session(session).lean() : null;
    if (!profile) throw notFound("Factory");
    const documents = await ManufacturerDocument.find({ profileId: id }, { type: 1, status: 1 }).session(session).lean();
    if (profile.verificationStatus !== "PENDING") throw conflict("Only factories awaiting review can be verified or rejected.");
    if (decision === "VERIFIED" && !documents.some((d) => d.type === "BUSINESS_REGISTRATION" && d.status === "VERIFIED")) {
      throw invalid("Verify the business registration document before approving the factory.");
    }
    await ManufacturerProfile.updateOne(
      { _id: id },
      { $set: { verificationStatus: decision, verificationNote: reason, verifiedAt: decision === "VERIFIED" ? new Date() : null } },
      { session },
    );
    await audit(session, { actorId: actor.id, action: `FACTORY_${decision}`, targetType: "ManufacturerProfile", targetId: idOf(id), reason });
    await notify(
      session,
      profile.userId,
      "VERIFICATION_DECISION",
      decision === "VERIFIED" ? "Your factory is verified" : "Verification not approved",
      decision === "VERIFIED" ? "You can now be matched to brand projects and submit quotations." : reason,
      "/factory",
    );
  });
}

/** Admin: withdraw verification (e.g. an expired certificate). */
export async function revokeVerification(actor, profileId, reason) {
  assertRole(actor, "ADMIN");
  await withTransaction(async (session) => {
    const id = toObjectId(profileId);
    const profile = id ? await ManufacturerProfile.findById(id).session(session).lean() : null;
    if (!profile) throw notFound("Factory");
    if (profile.verificationStatus !== "VERIFIED") throw conflict("Only verified factories can have verification revoked.");
    await ManufacturerProfile.updateOne({ _id: id }, { $set: { verificationStatus: "REJECTED", verificationNote: reason, verifiedAt: null } }, { session });
    await audit(session, { actorId: actor.id, action: "FACTORY_VERIFICATION_REVOKED", targetType: "ManufacturerProfile", targetId: idOf(id), reason });
    await notify(session, profile.userId, "VERIFICATION_DECISION", "Verification revoked", reason, "/factory");
  });
}

// ───────────────────────────── Quality, payments ─────────────────────────────

/** QC reports / rework tasks with `order: { id, reference, project: { name } }`. */
async function withOrderRef(Model, docs) {
  const orders = await mapById(Order, docs.map((d) => d.orderId), { reference: 1, projectId: 1 });
  const projects = await mapById(Project, [...orders.values()].map((o) => o.projectId), { name: 1 });
  return docs.map((d) => {
    const o = orders.get(idOf(d.orderId));
    const p = o && projects.get(idOf(o.projectId));
    return { ...serialize(Model, d), order: o ? { id: idOf(o._id), reference: o.reference, project: p ? { name: p.name } : null } : null };
  });
}

export async function qcOverview(actor) {
  assertRole(actor, "ADMIN");
  const rejectedOrder = nullAwareSort([
    ["decidedAt", -1, "first"],
    ["_id", -1],
  ]);
  const [failed, rejectedByBrand, openRework, pendingDecisions] = await Promise.all([
    QCReport.find({ result: "FAIL" }).sort({ createdAt: -1, _id: -1 }).limit(25).lean(),
    QCReport.aggregate([{ $match: { brandDecision: "REJECTED" } }, rejectedOrder.addFields, rejectedOrder.sort, { $limit: 25 }, rejectedOrder.unset]),
    ReworkTask.find({ status: "OPEN" }).sort({ createdAt: 1, _id: 1 }).lean(),
    QCReport.countDocuments({ result: "PASS", brandDecision: "PENDING" }),
  ]);
  return {
    failed: await withOrderRef(QCReport, failed),
    rejectedByBrand: await withOrderRef(QCReport, rejectedByBrand),
    openRework: await withOrderRef(ReworkTask, openRework),
    pendingDecisions,
  };
}

/** @param {{ page?: number, errorsOnly?: boolean }} f */
export async function paymentOverview(actor, f = {}) {
  assertRole(actor, "ADMIN");
  const size = 25;
  // Same condition as the overview's "Unprocessed webhook errors" count.
  const eventWhere = f.errorsOnly ? { error: { $ne: null }, processedAt: null } : {};
  const [events, eventTotal, refundable] = await Promise.all([
    WebhookEvent.find(eventWhere)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page(f.page) - 1) * size)
      .limit(size)
      .lean(),
    WebhookEvent.countDocuments(eventWhere),
    PaymentMilestone.find({ status: { $in: ["PAID", "PROCESSING", "FAILED"] } })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(50)
      .lean(),
  ]);
  const orders = await mapById(Order, refundable.map((p) => p.orderId), { reference: 1, projectId: 1, brandId: 1 });
  const orderList = [...orders.values()];
  const [projects, brands, brandProfiles, transactions] = await Promise.all([
    mapById(Project, orderList.map((o) => o.projectId), { name: 1 }),
    mapById(User, orderList.map((o) => o.brandId), { name: 1 }),
    oneByRef(BrandProfile, "userId", orderList.map((o) => o.brandId), { userId: 1, companyName: 1 }),
    groupByRef(PaymentTransaction, "paymentMilestoneId", refundable.map((p) => p._id), { sort: { createdAt: -1, _id: -1 } }),
  ]);
  return {
    events: serialize(WebhookEvent, events),
    refundable: refundable.map((pm) => {
      const o = orders.get(idOf(pm.orderId));
      const p = o && projects.get(idOf(o.projectId));
      const b = o && brands.get(idOf(o.brandId));
      const bp = o && brandProfiles.get(idOf(o.brandId));
      return {
        ...serialize(PaymentMilestone, pm),
        order: o
          ? {
              id: idOf(o._id),
              reference: o.reference,
              project: p ? { name: p.name } : null,
              brand: { name: b?.name ?? null, brandProfile: bp ? { companyName: bp.companyName } : null },
            }
          : null,
        transactions: serialize(PaymentTransaction, transactions.get(idOf(pm._id)) ?? []),
      };
    }),
    page: page(f.page),
    pages: pages(eventTotal, size),
    total: eventTotal,
  };
}

// ───────────────────────────── Audit ─────────────────────────────

/** @param {{ targetType?: string, q?: string, page?: number }} f */
export async function listAudit(actor, f = {}) {
  assertRole(actor, "ADMIN");
  const size = 30;
  /** @type {Record<string, unknown>} */
  const where = { ...(f.targetType ? { targetType: f.targetType } : {}) };
  if (f.q) {
    const rx = containsInsensitive(f.q);
    where.$or = [{ action: rx }, { reason: rx }, { targetId: f.q }];
  }
  const [entries, total, types] = await Promise.all([
    AuditLog.find(where)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page(f.page) - 1) * size)
      .limit(size)
      .lean(),
    AuditLog.countDocuments(where),
    AuditLog.distinct("targetType"),
  ]);
  const actors = await mapById(User, entries.map((e) => e.actorId), { name: 1, email: 1 });
  const targets = await resolveAuditTargets(entries);
  return {
    items: entries.map((e) => {
      const a = actors.get(idOf(e.actorId));
      return { ...serialize(AuditLog, e), actor: a ? { name: a.name, email: a.email } : null, target: targets[e.targetId] };
    }),
    total,
    page: page(f.page),
    pages: pages(total, size),
    types: [...types].sort(),
  };
}

const metaString = (m, key) => {
  const v = m && typeof m === "object" && !Array.isArray(m) ? m[key] : undefined;
  return typeof v === "string" && v ? v : undefined;
};

/**
 * Names the records behind audit entries (read-only): one batched query per record type. Falls back to what
 * the entry's metadata recorded when the record no longer exists. Keyed by targetId.
 * @param {{ targetType: string, targetId: string, metadata?: unknown }[]} items
 * @returns {Promise<Record<string, { name?: string, href?: string }>>}
 */
export async function resolveAuditTargets(items) {
  const ids = (type) => [...new Set(items.filter((i) => i.targetType === type).map((i) => idOf(i.targetId)))];
  const [users, profiles, documents, issues, milestones, inquiries] = await Promise.all([
    mapById(User, ids("User"), { name: 1 }),
    mapById(ManufacturerProfile, ids("ManufacturerProfile"), { businessName: 1 }),
    mapById(ManufacturerDocument, ids("ManufacturerDocument"), { fileName: 1, certificationName: 1, profileId: 1 }),
    mapById(IssueReport, ids("IssueReport"), { subject: 1 }),
    mapById(PaymentMilestone, ids("PaymentMilestone"), { label: 1, orderId: 1 }),
    mapById(ContactInquiry, ids("ContactInquiry"), { name: 1, subject: 1 }),
  ]);
  const userIds = [...users.keys()];
  const [userFactories, userBrands, docProfiles, milestoneOrders] = await Promise.all([
    oneByRef(ManufacturerProfile, "userId", userIds, { userId: 1, businessName: 1 }),
    oneByRef(BrandProfile, "userId", userIds, { userId: 1, companyName: 1 }),
    mapById(ManufacturerProfile, [...documents.values()].map((d) => d.profileId), { businessName: 1 }),
    mapById(Order, [...milestones.values()].map((m) => m.orderId), { reference: 1 }),
  ]);
  /** @type {Record<string, { name?: string, href?: string }>} */
  const out = {};
  for (const [id, u] of users) {
    const mp = userFactories.get(id);
    const org = mp?.businessName ?? userBrands.get(id)?.companyName;
    out[id] = {
      name: org ? `${u.name} (${org})` : u.name,
      href: mp ? `/admin/factories/${idOf(mp._id)}` : `/admin/users?q=${encodeURIComponent(u.name)}`,
    };
  }
  for (const [id, p] of profiles) out[id] = { name: p.businessName, href: `/admin/factories/${id}` };
  for (const [id, d] of documents) {
    const p = docProfiles.get(idOf(d.profileId));
    if (!p) continue;
    out[id] = { name: `${d.certificationName ?? d.fileName} · ${p.businessName}`, href: `/admin/factories/${idOf(p._id)}` };
  }
  for (const [id, i] of issues) out[id] = { name: i.subject, href: `/disputes/${id}` };
  for (const [id, m] of milestones) {
    const o = milestoneOrders.get(idOf(m.orderId));
    if (!o) continue;
    out[id] = { name: `${o.reference} · ${m.label}`, href: `/orders/${idOf(o._id)}?tab=payments` };
  }
  for (const [id, q] of inquiries) out[id] = { name: `${q.subject} (${q.name})`, href: "/admin/enquiries" };
  // Deleted records: fall back to what the entry itself recorded.
  for (const i of items) {
    const key = idOf(i.targetId);
    if (out[key]) continue;
    const file = metaString(i.metadata, "certification") ?? metaString(i.metadata, "fileName");
    const amount = metaString(i.metadata, "amount");
    const currency = metaString(i.metadata, "currency");
    const name = file ?? (amount && currency ? `${currency} ${amount}` : undefined);
    if (name) out[key] = { name };
  }
  return out;
}

// ───────────────────────────── Enquiries ─────────────────────────────

/** @param {{ status?: string, page?: number }} f */
export async function listEnquiries(actor, f = {}) {
  assertRole(actor, "ADMIN");
  const size = 20;
  const where = f.status ? { status: f.status } : {};
  const [items, total] = await Promise.all([
    ContactInquiry.find(where)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page(f.page) - 1) * size)
      .limit(size)
      .lean(),
    ContactInquiry.countDocuments(where),
  ]);
  return { items: serialize(ContactInquiry, items), total, page: page(f.page), pages: pages(total, size) };
}

export async function setEnquiryStatus(actor, id, status) {
  assertRole(actor, "ADMIN");
  await withTransaction(async (session) => {
    const oid = toObjectId(id);
    const e = oid ? await ContactInquiry.findById(oid).session(session).lean() : null;
    if (!e) throw notFound("Enquiry");
    await ContactInquiry.updateOne({ _id: oid }, { $set: { status } }, { session });
    await audit(session, { actorId: actor.id, action: "ENQUIRY_STATUS_CHANGED", targetType: "ContactInquiry", targetId: idOf(oid), metadata: { from: e.status, to: status } });
  });
}

// ───────────────────────────── Overview ─────────────────────────────

/** Prisma `groupBy({ by: [key], _count: true })`, sorted by the key in enum declaration order. */
export async function countBy(Model, key, values, match = {}) {
  const rows = await Model.aggregate([{ $match: match }, { $group: { _id: `$${key}`, n: { $sum: 1 } } }]);
  return sortWith(rows, by((r) => r._id, { enumValues: values })).map((r) => ({ [key]: r._id, _count: r.n }));
}
