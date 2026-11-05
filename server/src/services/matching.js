/**
 * Factory matching (port of src/server/services/matching.ts). The engine itself is the pure rules-v1 function in
 * @fashinza/shared/matching.js; this module loads its input, stores the results and tells factories.
 * Inside a transaction every query runs sequentially on the session (one connection, no concurrent operations).
 */
import { DEFAULT_WEIGHTS, MATCHING_ALGORITHM, matchFactories } from "@fashinza/shared/matching.js";
import { logActivity, notify } from "../lib/events.js";
import { byId, groupBy, oid, opts, s } from "../lib/records.js";
import { serialize } from "../lib/serialize.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { ManufacturerCapability } from "../models/ManufacturerCapability.js";
import { ManufacturerDocument } from "../models/ManufacturerDocument.js";
import { ManufacturerMachine } from "../models/ManufacturerMachine.js";
import { ManufacturerProfile } from "../models/ManufacturerProfile.js";
import { MatchResult } from "../models/MatchResult.js";
import { Order } from "../models/Order.js";
import { Project } from "../models/Project.js";
import { QCReport } from "../models/QCReport.js";
import { Quotation } from "../models/Quotation.js";
import { User } from "../models/User.js";

const CLOSED_ORDER = ["DELIVERED", "CANCELLED"];

/** Builds engine input for every factory with a completed profile. */
export async function loadCandidates(session) {
  const users = await User.find({ profileCompleted: true, role: "MANUFACTURER" }, { _id: 1, status: 1 }).session(s(session)).lean();
  if (!users.length) return [];
  const profiles = await ManufacturerProfile.find({ userId: { $in: users.map((u) => u._id) } })
    .sort({ _id: 1 })
    .session(s(session))
    .lean();
  if (!profiles.length) return [];
  const userById = byId(users);
  const profileIds = profiles.map((p) => p._id);
  const ids = profiles.map((p) => p.userId);

  const capabilities = await ManufacturerCapability.find({ profileId: { $in: profileIds } }).sort({ _id: 1 }).session(s(session)).lean();
  const certificates = await ManufacturerDocument.find({ profileId: { $in: profileIds }, type: "CERTIFICATION", status: "VERIFIED" }, { profileId: 1, certificationName: 1 })
    .sort({ createdAt: 1, _id: 1 })
    .session(s(session))
    .lean();
  const activeOrders = await Order.find({ manufacturerId: { $in: ids }, status: { $nin: CLOSED_ORDER } }, { manufacturerId: 1, quantity: 1, quotationId: 1 })
    .session(s(session))
    .lean();
  const quotes = activeOrders.length
    ? await Quotation.find({ _id: { $in: activeOrders.map((o) => o.quotationId) } }, { productionDays: 1 }).session(s(session)).lean()
    : [];
  const allOrders = await Order.find({ manufacturerId: { $in: ids } }, { _id: 1, manufacturerId: 1, status: 1, deliveredAt: 1, expectedCompletionDate: 1 })
    .session(s(session))
    .lean();
  const reports = allOrders.length
    ? await QCReport.find({ orderId: { $in: allOrders.map((o) => o._id) } }, { orderId: 1, result: 1 }).session(s(session)).lean()
    : [];

  const capsByProfile = groupBy(capabilities, "profileId");
  const certsByProfile = groupBy(certificates, "profileId");
  const quoteById = byId(quotes);
  const orderOwner = new Map(allOrders.map((o) => [String(o._id), String(o.manufacturerId)]));

  return profiles.map((p) => {
    const uid = String(p.userId);
    const committed = activeOrders
      .filter((o) => String(o.manufacturerId) === uid)
      .reduce((sum, o) => sum + o.quantity / Math.max(1, (quoteById.get(String(o.quotationId))?.productionDays ?? 0) / 30), 0);
    const myQc = reports.filter((r) => orderOwner.get(String(r.orderId)) === uid);
    const myDelivered = allOrders.filter((o) => String(o.manufacturerId) === uid && o.status === "DELIVERED");
    const caps = capsByProfile.get(String(p._id)) ?? [];
    return {
      manufacturerId: uid,
      name: p.businessName,
      verified: p.verificationStatus === "VERIFIED",
      active: userById.get(uid)?.status === "ACTIVE",
      country: p.country,
      categories: p.categories,
      minOrderQuantity: p.minOrderQuantity,
      maxMonthlyCapacity: p.maxMonthlyCapacity,
      committedMonthlyUnits: Math.round(committed),
      typicalLeadTimeDays: p.typicalLeadTimeDays,
      capabilities: caps.filter((c) => c.kind !== "FABRIC").map((c) => c.name),
      fabrics: caps.filter((c) => c.kind === "FABRIC").map((c) => c.name),
      verifiedCertifications: (certsByProfile.get(String(p._id)) ?? []).map((d) => d.certificationName).filter((n) => !!n),
      history: {
        qcReports: myQc.length,
        qcPassed: myQc.filter((q) => q.result === "PASS").length,
        deliveredOrders: myDelivered.length,
        onTimeDeliveries: myDelivered.filter((o) => o.deliveredAt && o.deliveredAt <= o.expectedCompletionDate).length,
      },
    };
  });
}

/** Mongoose drops empty objects inside Mixed values on save; the stored summary always had all four keys. */
function summaryOf(metadata) {
  const m = metadata ?? {};
  return { reviewed: m.reviewed ?? 0, eligible: m.eligible ?? 0, newlyInvited: m.newlyInvited ?? 0, exclusionReasons: m.exclusionReasons ?? {} };
}

/**
 * Matches for a project, visible to the owning brand and to admins only (null otherwise).
 * @param {{ id: string, role: string }} actor
 */
export async function getProjectMatches(actor, projectId) {
  const project = await Project.exists({ _id: oid(projectId), ...(actor.role === "ADMIN" ? {} : { brandId: oid(actor.id) }) });
  if (!project) return null;
  const [matches, lastRun] = await Promise.all([
    MatchResult.find({ projectId: project._id }).sort({ score: -1, _id: 1 }).lean(),
    ActivityLog.findOne({ projectId: project._id, type: "MATCHING_RUN" }).sort({ createdAt: -1, _id: -1 }).lean(),
  ]);
  const manufacturerIds = matches.map((m) => m.manufacturerId);
  const profiles = manufacturerIds.length
    ? await ManufacturerProfile.find(
        { userId: { $in: manufacturerIds } },
        { userId: 1, businessName: 1, city: 1, country: 1, verificationStatus: 1, minOrderQuantity: 1, maxMonthlyCapacity: 1, typicalLeadTimeDays: 1 },
      ).lean()
    : [];
  const profileIds = profiles.map((p) => p._id);
  const [certificates, machinery] = profileIds.length
    ? await Promise.all([
        ManufacturerDocument.find({ profileId: { $in: profileIds }, type: "CERTIFICATION", status: "VERIFIED" }, { profileId: 1, certificationName: 1 })
          .sort({ createdAt: 1, _id: 1 })
          .lean(),
        ManufacturerMachine.find({ profileId: { $in: profileIds } }, { profileId: 1, type: 1, quantity: 1 }).sort({ sortOrder: 1, type: 1 }).lean(),
      ])
    : [[], []];
  const profileByUser = byId(profiles, "userId");
  const certsByProfile = groupBy(certificates, "profileId");
  const machinesByProfile = groupBy(machinery, "profileId");

  return {
    matches: matches.map((m) => {
      const p = profileByUser.get(String(m.manufacturerId));
      return {
        ...serialize(MatchResult, m),
        manufacturer: {
          manufacturerProfile: p
            ? {
                businessName: p.businessName,
                city: p.city,
                country: p.country,
                verificationStatus: p.verificationStatus,
                minOrderQuantity: p.minOrderQuantity,
                maxMonthlyCapacity: p.maxMonthlyCapacity,
                typicalLeadTimeDays: p.typicalLeadTimeDays,
                documents: (certsByProfile.get(String(p._id)) ?? []).map((d) => ({ certificationName: d.certificationName })),
                machinery: (machinesByProfile.get(String(p._id)) ?? []).map((x) => ({ type: x.type, quantity: x.quantity })),
              }
            : null,
        },
      };
    }),
    lastRun: lastRun ? { at: lastRun.createdAt, summary: summaryOf(lastRun.metadata) } : null,
  };
}

/** Groups exclusion reasons into short categories so brands see why factories were filtered out without exposing them. */
export function summariseExclusions(outcome) {
  /** @type {Record<string, number>} */
  const counts = {};
  const bucket = (r) =>
    r.startsWith("Factory is not verified")
      ? "Not yet verified"
      : r.startsWith("Factory account")
        ? "Account suspended"
        : r.startsWith("Does not produce")
          ? "Different product category"
          : r.startsWith("Minimum order")
            ? "MOQ above your quantity"
            : r.startsWith("Missing verified")
              ? "Missing a required certification"
              : r.startsWith("Typical lead time")
                ? "Lead time too long for your deadline"
                : "Not enough free capacity";
  for (const e of outcome.excluded) for (const r of e.reasons) counts[bucket(r)] = (counts[bucket(r)] ?? 0) + 1;
  return counts;
}

/**
 * Runs matching for a submitted project, stores eligible results and invites new matches.
 * Existing match rows are refreshed (score may change) but never removed, so a factory that
 * already started quoting keeps access.
 * @returns {Promise<{ reviewed: number, eligible: number, newlyInvited: number, exclusionReasons: Record<string, number> }>}
 */
export async function runMatchingForProject(session, projectId, actorId) {
  const project = await Project.findById(oid(projectId)).session(s(session)).orFail().lean();
  if (!project.quantity) throw new Error("Project quantity is required for matching.");
  const candidates = await loadCandidates(session);
  const outcome = matchFactories(
    {
      category: project.category,
      quantity: project.quantity,
      maxMoq: project.maxMoq,
      deadline: project.deadline,
      fabrics: project.fabrics,
      requiredCapabilities: project.requiredCapabilities,
      requiredCertifications: project.requiredCertifications,
      preferredCountry: project.preferredCountry,
    },
    candidates,
    DEFAULT_WEIGHTS,
  );
  const existing = new Set((await MatchResult.find({ projectId: project._id }, { manufacturerId: 1 }).session(s(session)).lean()).map((m) => String(m.manufacturerId)));
  const now = new Date();
  const pid = project._id.toHexString();
  let newlyInvited = 0;
  for (const m of outcome.eligible) {
    const data = { score: m.score.toFixed(2), breakdown: m.breakdown, reasons: m.reasons, algorithm: MATCHING_ALGORITHM };
    await MatchResult.updateOne(
      { projectId: project._id, manufacturerId: oid(m.manufacturerId) },
      { $set: data, $setOnInsert: { invitedAt: now } },
      opts(session, { upsert: true }),
    );
    if (!existing.has(m.manufacturerId)) {
      newlyInvited++;
      await notify(
        session,
        m.manufacturerId,
        "MATCH_FOUND",
        "New production opportunity",
        `“${project.name}” matches your factory (score ${m.score.toFixed(0)}/100). Review it and submit a quotation.`,
        `/opportunities/${pid}`,
      );
    }
  }
  const summary = { reviewed: candidates.length, eligible: outcome.eligible.length, newlyInvited, exclusionReasons: summariseExclusions(outcome) };
  await logActivity(session, {
    actorId,
    projectId: pid,
    type: "MATCHING_RUN",
    message: `Matching reviewed ${summary.reviewed} factories; ${summary.eligible} eligible.`,
    metadata: summary,
  });
  return summary;
}
