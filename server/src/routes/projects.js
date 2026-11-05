/**
 * Projects (mounted at /api/projects) — owner: SERVER-A (docs/mern/api.md §3.3, §6.1).
 * Port of src/app/(app)/projects/actions.ts, api/projects/[id]/attachments/route.ts and the project pages' data.
 *   GET    /                               onboarded BRAND, ADMIN
 *   GET    /:id                            onboarded BRAND   (edit page: project + submit checklist)
 *   GET    /:id/detail                     onboarded BRAND, ADMIN
 *   POST   /save-step                      onboarded BRAND
 *   POST   /:id/submit                     onboarded BRAND
 *   POST   /:id/rerun-matching             onboarded BRAND
 *   POST   /:id/cancel                     onboarded BRAND
 *   DELETE /:id                            onboarded BRAND
 *   POST   /:id/attachments (multipart)    user (the service asserts the BRAND owner)
 *   DELETE /:id/attachments/:attachmentId  onboarded BRAND
 */
import { Router } from "express";
import { ATTACHMENT_KIND_VALUES, UPLOAD_LIMITS } from "@fashinza/shared/constants.js";
import { PROJECT_STATUS } from "@fashinza/shared/labels.js";
import { ARRAY_FIELDS, PROJECT_STEPS } from "@fashinza/shared/validation/project.js";
import { reasonSchema } from "@fashinza/shared/validation/operations.js";
import { invalid } from "../lib/errors.js";
import { filesOf, ok, readForm, uploadFields, validateForm } from "../lib/form.js";
import { enforceRateLimit, RATE_LIMIT_MESSAGES } from "../lib/rate-limit.js";
import { requireOnboardedUser, requireUser } from "../middleware/auth.js";
import { routeHandlerErrors } from "../middleware/errors.js";
import { getProjectMatches } from "../services/matching.js";
import {
  addAttachment,
  cancelProject,
  deleteAttachment,
  deleteDraft,
  getProject,
  getProjectForEdit,
  listProjectActivities,
  listProjects,
  rerunMatching,
  saveProject,
  submitProject,
} from "../services/projects.js";
import { listProjectQuotations } from "../services/quotations.js";

const router = Router();
const brand = requireOnboardedUser(["BRAND"]);

/** `status` query: ACTIVE or a ProjectStatus, anything else ignored (projects page). */
export function projectStatusFilter(value) {
  return typeof value === "string" && (value === "ACTIVE" || Object.hasOwn(PROJECT_STATUS, value)) ? value : undefined;
}

/**
 * The fields of one wizard step, read like saveProjectStepAction: array fields as non-blank strings,
 * everything else as `String(value ?? "")`. Returns null for an unknown step.
 * @param {Record<string, unknown>} form readForm(req, ARRAY_FIELDS)
 */
export function stepInput(form) {
  const step = Number(form.step);
  const def = PROJECT_STEPS.find((s) => s.step === step);
  if (!def) return null;
  /** @type {Record<string, unknown>} */
  const raw = {};
  for (const field of def.fields) {
    raw[field] = ARRAY_FIELDS.includes(field)
      ? (Array.isArray(form[field]) ? form[field] : []).map(String).filter((v) => v.trim())
      : String(form[field] ?? "");
  }
  return { step, raw };
}

/** Where the wizard goes after a successful save (first matching rule wins). */
export function saveStepOutcome({ id, step, projectId, intent, submitted }) {
  if (String(submitted) === "1") return { redirectTo: `/projects/${id}?updated=1` };
  if (intent === "next") return { redirectTo: `/projects/${id}/edit?step=${step + 1}` };
  if (!projectId) return { redirectTo: `/projects/${id}/edit?step=${step}&saved=1` };
  return { message: "Draft saved." };
}

router.get("/", requireOnboardedUser(["BRAND", "ADMIN"]), async (req, res) => {
  const pageSize = Number(req.query.pageSize) || undefined;
  const data = await listProjects(req.actor, {
    q: typeof req.query.q === "string" ? req.query.q : undefined,
    status: projectStatusFilter(req.query.status),
    page: Number(req.query.page) || 1,
    pageSize,
  });
  res.json(data);
});

router.post("/save-step", brand, async (req, res) => {
  const form = readForm(req, ARRAY_FIELDS);
  const input = stepInput(form);
  if (!input) throw invalid("Unknown step.");
  const projectId = String(form.projectId ?? "") || null;
  const intent = String(form.intent ?? "next");
  const id = await saveProject(req.actor, projectId, input.raw, input.step);
  ok(res, saveStepOutcome({ id, step: input.step, projectId, intent, submitted: form.submitted }));
});

router.get("/:id", brand, async (req, res) => {
  res.json(await getProjectForEdit(req.actor, req.params.id));
});

router.get("/:id/detail", requireOnboardedUser(["BRAND", "ADMIN"]), async (req, res) => {
  const project = await getProject(req.actor, req.params.id);
  const [matchData, quotations, activities] = await Promise.all([
    getProjectMatches(req.actor, project.id),
    listProjectQuotations(req.actor, project.id),
    listProjectActivities(project.id),
  ]);
  res.json({ project, matchData, quotations, activities });
});

router.post("/:id/submit", brand, async (req, res) => {
  const summary = await submitProject(req.actor, req.params.id);
  ok(res, { redirectTo: `/projects/${req.params.id}?submitted=1`, summary });
});

router.post("/:id/rerun-matching", brand, async (req, res) => {
  const s = await rerunMatching(req.actor, req.params.id);
  ok(res, { message: `Matching reviewed ${s.reviewed} factories: ${s.eligible} eligible, ${s.newlyInvited} newly invited.` });
});

router.post("/:id/cancel", brand, async (req, res) => {
  const form = readForm(req);
  const data = validateForm(reasonSchema, { reason: form.reason ?? null });
  await cancelProject(req.actor, req.params.id, data.reason);
  ok(res, { message: "Project cancelled." });
});

router.delete("/:id", brand, async (req, res) => {
  await deleteDraft(req.actor, req.params.id);
  ok(res, { redirectTo: "/projects?deleted=1" });
});

/**
 * Multipart upload for project files, used with XMLHttpRequest so the browser can show upload progress.
 * Order of checks as today: sign-in → rate limit → declared size → file present → kind → service.
 */
router.post("/:id/attachments", routeHandlerErrors, requireUser(), uploadFields({ file: 1 }), async (req, res) => {
  const actor = req.actor;
  enforceRateLimit(`upload:${actor.id}`, 60, 10 * 60 * 1000, RATE_LIMIT_MESSAGES.uploads);
  const length = Number(req.get("content-length") ?? 0);
  if (length > UPLOAD_LIMITS.maxBytes + 64 * 1024) throw invalid(`Files must be ${UPLOAD_LIMITS.maxBytes / 1024 / 1024} MB or smaller.`);
  const [file] = filesOf(req, "file");
  const form = readForm(req);
  const kind = String(form.kind ?? "OTHER");
  if (!file) throw invalid("Choose a file to upload.");
  if (!ATTACHMENT_KIND_VALUES.includes(kind)) throw invalid("Unknown file type.");
  const notes =
    String(form.notes ?? "")
      .trim()
      .slice(0, 300) || undefined;
  const att = await addAttachment(actor, req.params.id, file, kind, notes);
  res.status(201).json({ id: att.id, kind: att.kind, version: att.version, fileName: att.fileName });
});

router.delete("/:id/attachments/:attachmentId", brand, async (req, res) => {
  await deleteAttachment(req.actor, req.params.attachmentId);
  ok(res, { message: "File removed." });
});

export default router;
