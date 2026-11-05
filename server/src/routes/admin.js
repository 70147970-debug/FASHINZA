/**
 * Admin (mounted at /api/admin; every endpoint requireUser(["ADMIN"])) — owner: SERVER-B (docs/mern/api.md
 * §6.1). Ports the admin pages' data loading and the server actions in src/app/(app)/admin/actions.ts.
 */
import { Router } from "express";
import { z } from "zod";
import { InquiryStatus, OrderStatus, Role, UserStatus, VerificationStatus } from "@fashinza/shared/enums.js";
import { disputeUpdateSchema, reasonSchema } from "@fashinza/shared/validation/operations.js";
import { ok, parseForm, readForm } from "../lib/form.js";
import { oneOf, pageParam, queryString } from "../lib/query.js";
import { requireUser } from "../middleware/auth.js";
import { deliverSandboxEvent, getPaymentProvider } from "../payments/provider.js";
import {
  countFactoriesByStatus,
  decideVerification,
  getFactory,
  listAudit,
  listEnquiries,
  listFactories,
  listUsers,
  paymentOverview,
  qcOverview,
  reviewDocument,
  revokeVerification,
  setEnquiryStatus,
  setUserStatus,
} from "../services/admin.js";
import { adminDashboard } from "../services/dashboard.js";
import { updateDispute } from "../services/disputes.js";
import { listOrders, refreshDelays } from "../services/orders.js";
import { requestRefund } from "../services/payments.js";
import { listMachinery } from "../services/profiles.js";

const router = Router();
const admin = requireUser(["ADMIN"]);

const validated = (schema, data) => {
  const parsed = parseForm(schema, data);
  if (!parsed.ok) throw parsed.error;
  return parsed.data;
};

/** `parseForm(reasonSchema, { reason: fd.get("reason") })` */
const reasonOf = (req) => validated(reasonSchema, { reason: readForm(req).reason ?? null }).reason;

// ───────────── overview ─────────────

router.get("/overview", admin, async (req, res) => {
  res.json(await adminDashboard(req.actor));
});

// ───────────── factories ─────────────

router.get("/factories", admin, async (req, res) => {
  const raw = queryString(req, "status");
  const q = queryString(req, "q") || undefined;
  // Absent → the pending queue; a VerificationStatus → that; anything else (e.g. ALL) → every status.
  const status = oneOf(VerificationStatus, raw) ?? (raw === undefined ? "PENDING" : undefined);
  const [data, counts] = await Promise.all([listFactories(req.actor, { status, q, page: pageParam(req) }), countFactoriesByStatus(req.actor, { q })]);
  res.json({ ...data, counts, status: status ?? null });
});

router.get("/factories/:id", admin, async (req, res) => {
  const { profile, history } = await getFactory(req.actor, req.params.id);
  const machinery = await listMachinery(profile.id);
  res.json({ profile, history, machinery });
});

router.post("/documents/:documentId/review", admin, async (req, res) => {
  const form = readForm(req);
  const status = form.status === "VERIFIED" ? "VERIFIED" : "REJECTED";
  const note = (typeof form.note === "string" ? form.note.trim() : "") || undefined;
  await reviewDocument(req.actor, req.params.documentId, status, note);
  ok(res, { message: status === "VERIFIED" ? "Document verified." : "Document rejected." });
});

router.post("/factories/:id/verification", admin, async (req, res) => {
  const reason = reasonOf(req);
  const decision = readForm(req).decision === "VERIFIED" ? "VERIFIED" : "REJECTED";
  await decideVerification(req.actor, req.params.id, decision, reason);
  ok(res, { message: decision === "VERIFIED" ? "Factory verified. It can now be matched to projects." : "Verification rejected. The factory has been told why." });
});

router.post("/factories/:id/revoke", admin, async (req, res) => {
  const reason = reasonOf(req);
  await revokeVerification(req.actor, req.params.id, reason);
  ok(res, { message: "Verification revoked." });
});

// ───────────── users ─────────────

router.get("/users", admin, async (req, res) => {
  res.json(
    await listUsers(req.actor, {
      q: queryString(req, "q") || undefined,
      role: oneOf(Role, queryString(req, "role")),
      status: oneOf(UserStatus, queryString(req, "status")),
      page: pageParam(req),
    }),
  );
});

router.post("/users/:id/status", admin, async (req, res) => {
  const reason = reasonOf(req);
  const status = readForm(req).status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  await setUserStatus(req.actor, req.params.id, status, reason);
  ok(res, { message: status === "SUSPENDED" ? "Account suspended and signed out." : "Account reactivated." });
});

// ───────────── orders, QC, disputes ─────────────

router.get("/orders", admin, async (req, res) => {
  await refreshDelays();
  const status = queryString(req, "status");
  res.json(
    await listOrders(req.actor, {
      q: queryString(req, "q") || undefined,
      status: status === "ACTIVE" ? "ACTIVE" : oneOf(OrderStatus, status),
      delayed: queryString(req, "delayed") === "1",
      page: pageParam(req),
      pageSize: 20,
    }),
  );
});

router.get("/qc", admin, async (req, res) => {
  res.json(await qcOverview(req.actor));
});

router.post("/disputes/:id", admin, async (req, res) => {
  const data = validated(disputeUpdateSchema, readForm(req));
  await updateDispute(req.actor, req.params.id, data);
  ok(res, { message: "Dispute updated and the parties notified." });
});

// ───────────── payments ─────────────

router.get("/payments", admin, async (req, res) => {
  res.json(await paymentOverview(req.actor, { page: pageParam(req), errorsOnly: queryString(req, "events") === "errors" }));
});

router.post("/payments/milestones/:id/refund", admin, async (req, res) => {
  const reason = reasonOf(req);
  const refund = await requestRefund(req.actor, req.params.id, reason);
  // The sandbox provider settles refunds immediately by sending its webhook; a real provider
  // would send it asynchronously once the refund clears.
  if (getPaymentProvider().isSandbox) await deliverSandboxEvent("refund.succeeded", { providerRef: refund.providerRef, amount: refund.amount, currency: refund.currency });
  ok(res, { message: "Refund issued through the payment provider (test mode)." });
});

// ───────────── audit, enquiries ─────────────

router.get("/audit", admin, async (req, res) => {
  res.json(await listAudit(req.actor, { q: queryString(req, "q") || undefined, targetType: queryString(req, "targetType") || undefined, page: pageParam(req) }));
});

router.get("/enquiries", admin, async (req, res) => {
  res.json(await listEnquiries(req.actor, { status: oneOf(InquiryStatus, queryString(req, "status")), page: pageParam(req) }));
});

const enquiry = z.object({ id: z.string(), status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED"]) });

router.post("/enquiries/:id/status", admin, async (req, res) => {
  const data = validated(enquiry, { ...readForm(req), id: req.params.id });
  await setEnquiryStatus(req.actor, data.id, data.status);
  ok(res, { message: "Enquiry updated." });
});

export default router;
