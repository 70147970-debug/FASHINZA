import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_WEIGHTS, MATCHING_ALGORITHM, matchFactories, type MatchCandidate, type MatchOutcome } from "@/lib/matching";
import { notify, logActivity } from "@/server/events";

type Tx = Prisma.TransactionClient;

const ACTIVE_ORDER = { status: { notIn: ["DELIVERED", "CANCELLED"] as ("DELIVERED" | "CANCELLED")[] } };

/** Builds engine input for every factory with a completed profile. */
export async function loadCandidates(tx: Tx): Promise<MatchCandidate[]> {
  const profiles = await tx.manufacturerProfile.findMany({
    where: { user: { profileCompleted: true, role: "MANUFACTURER" } },
    include: {
      user: { select: { id: true, status: true } },
      capabilities: true,
      documents: { where: { type: "CERTIFICATION", status: "VERIFIED" }, select: { certificationName: true } },
    },
  });
  if (!profiles.length) return [];
  const ids = profiles.map((p) => p.userId);
  // Sequential on purpose: a transaction holds one connection, which must not run queries concurrently.
  const activeOrders = await tx.order.findMany({ where: { manufacturerId: { in: ids }, ...ACTIVE_ORDER }, select: { manufacturerId: true, quantity: true, quotation: { select: { productionDays: true } } } });
  const qc = await tx.qCReport.groupBy({ by: ["orderId", "result"], where: { order: { manufacturerId: { in: ids } } }, _count: true });
  const delivered = await tx.order.findMany({ where: { manufacturerId: { in: ids }, status: "DELIVERED" }, select: { id: true, manufacturerId: true, deliveredAt: true, expectedCompletionDate: true } });
  const orderOwner = new Map<string, string>();
  if (qc.length) {
    const owners = await tx.order.findMany({ where: { id: { in: qc.map((q) => q.orderId) } }, select: { id: true, manufacturerId: true } });
    owners.forEach((o) => orderOwner.set(o.id, o.manufacturerId));
  }

  return profiles.map((p) => {
    const committed = activeOrders
      .filter((o) => o.manufacturerId === p.userId)
      .reduce((sum, o) => sum + o.quantity / Math.max(1, o.quotation.productionDays / 30), 0);
    const myQc = qc.filter((q) => orderOwner.get(q.orderId) === p.userId);
    const myDelivered = delivered.filter((o) => o.manufacturerId === p.userId);
    return {
      manufacturerId: p.userId,
      name: p.businessName,
      verified: p.verificationStatus === "VERIFIED",
      active: p.user.status === "ACTIVE",
      country: p.country,
      categories: p.categories,
      minOrderQuantity: p.minOrderQuantity,
      maxMonthlyCapacity: p.maxMonthlyCapacity,
      committedMonthlyUnits: Math.round(committed),
      typicalLeadTimeDays: p.typicalLeadTimeDays,
      capabilities: p.capabilities.filter((c) => c.kind !== "FABRIC").map((c) => c.name),
      fabrics: p.capabilities.filter((c) => c.kind === "FABRIC").map((c) => c.name),
      verifiedCertifications: p.documents.map((d) => d.certificationName).filter((n): n is string => !!n),
      history: {
        qcReports: myQc.reduce((s, q) => s + q._count, 0),
        qcPassed: myQc.filter((q) => q.result === "PASS").reduce((s, q) => s + q._count, 0),
        deliveredOrders: myDelivered.length,
        onTimeDeliveries: myDelivered.filter((o) => o.deliveredAt && o.deliveredAt <= o.expectedCompletionDate).length,
      },
    };
  });
}

/** Matches for a project, visible to the owning brand and to admins only. */
export async function getProjectMatches(actor: { id: string; role: string }, projectId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, ...(actor.role === "ADMIN" ? {} : { brandId: actor.id }) }, select: { id: true } });
  if (!project) return null;
  const [matches, lastRun] = await Promise.all([
    db.matchResult.findMany({
      where: { projectId },
      orderBy: { score: "desc" },
      include: {
        manufacturer: {
          select: {
            manufacturerProfile: {
              select: {
                businessName: true, city: true, country: true, verificationStatus: true, minOrderQuantity: true, maxMonthlyCapacity: true, typicalLeadTimeDays: true,
                documents: { where: { type: "CERTIFICATION", status: "VERIFIED" }, select: { certificationName: true } },
              },
            },
          },
        },
      },
    }),
    db.activityLog.findFirst({ where: { projectId, type: "MATCHING_RUN" }, orderBy: { createdAt: "desc" } }),
  ]);
  return { matches, lastRun: lastRun ? { at: lastRun.createdAt, summary: lastRun.metadata as unknown as MatchingSummary } : null };
}

export type MatchingSummary ={ reviewed: number; eligible: number; newlyInvited: number; exclusionReasons: Record<string, number> };

/** Groups exclusion reasons into short categories so brands see why factories were filtered out without exposing them. */
function summariseExclusions(outcome: MatchOutcome) {
  const counts: Record<string, number> = {};
  const bucket = (r: string) =>
    r.startsWith("Factory is not verified") ? "Not yet verified"
    : r.startsWith("Factory account") ? "Account suspended"
    : r.startsWith("Does not produce") ? "Different product category"
    : r.startsWith("Minimum order") ? "MOQ above your quantity"
    : r.startsWith("Missing verified") ? "Missing a required certification"
    : r.startsWith("Typical lead time") ? "Lead time too long for your deadline"
    : "Not enough free capacity";
  for (const e of outcome.excluded) for (const r of e.reasons) counts[bucket(r)] = (counts[bucket(r)] ?? 0) + 1;
  return counts;
}

/**
 * Runs matching for a submitted project, stores eligible results and invites new matches.
 * Existing match rows are refreshed (score may change) but never removed, so a factory that
 * already started quoting keeps access.
 */
export async function runMatchingForProject(tx: Tx, projectId: string, actorId: string): Promise<MatchingSummary> {
  const project = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!project.quantity) throw new Error("Project quantity is required for matching.");
  const candidates = await loadCandidates(tx);
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
  const existing = new Set((await tx.matchResult.findMany({ where: { projectId }, select: { manufacturerId: true } })).map((m) => m.manufacturerId));
  const now = new Date();
  let newlyInvited = 0;
  for (const m of outcome.eligible) {
    const data = { score: m.score.toFixed(2), breakdown: m.breakdown as unknown as Prisma.InputJsonValue, reasons: m.reasons, algorithm: MATCHING_ALGORITHM };
    await tx.matchResult.upsert({
      where: { projectId_manufacturerId: { projectId, manufacturerId: m.manufacturerId } },
      create: { projectId, manufacturerId: m.manufacturerId, invitedAt: now, ...data },
      update: data,
    });
    if (!existing.has(m.manufacturerId)) {
      newlyInvited++;
      await notify(tx, m.manufacturerId, "MATCH_FOUND", "New production opportunity", `“${project.name}” matches your factory (score ${m.score.toFixed(0)}/100). Review it and submit a quotation.`, `/opportunities/${projectId}`);
    }
  }
  const summary: MatchingSummary = { reviewed: candidates.length, eligible: outcome.eligible.length, newlyInvited, exclusionReasons: summariseExclusions(outcome) };
  await logActivity(tx, { actorId, projectId, type: "MATCHING_RUN", message: `Matching reviewed ${summary.reviewed} factories; ${summary.eligible} eligible.`, metadata: summary as unknown as Prisma.InputJsonValue });
  return summary;
}
