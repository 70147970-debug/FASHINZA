/**
 * Profiles, factory documents, verification requests (mounted at /api/profile) — owner: SERVER-A
 * (docs/mern/api.md §3.2, §6.1). Port of src/app/(app)/profile-actions.ts and the profile/factory/onboarding page data.
 *   GET    /brand                                user BRAND
 *   PUT    /brand                                user BRAND
 *   GET    /factory                              user MANUFACTURER
 *   PUT    /factory                              user MANUFACTURER
 *   POST   /factory/documents (multipart)        user MANUFACTURER
 *   DELETE /factory/documents/:documentId        user MANUFACTURER
 *   POST   /factory/verification-request         user MANUFACTURER
 */
import { Router } from "express";
import { brandProfileSchema, documentSchema, manufacturerProfileSchema } from "@fashinza/shared/validation/profile.js";
import { invalid } from "../lib/errors.js";
import { filesOf, ok, readForm, uploadFields, validateForm } from "../lib/form.js";
import { requireUser } from "../middleware/auth.js";
import {
  addManufacturerDocument,
  deleteManufacturerDocument,
  getBrandProfile,
  getFactoryProfile,
  machineryFromBody,
  requestVerification,
  saveBrandProfile,
  saveManufacturerProfile,
} from "../services/profiles.js";

const router = Router();
const brand = requireUser(["BRAND"]);
const manufacturer = requireUser(["MANUFACTURER"]);

router.get("/brand", brand, async (req, res) => {
  res.json({ profile: await getBrandProfile(req.actor) });
});

router.put("/brand", brand, async (req, res) => {
  const data = validateForm(brandProfileSchema, readForm(req));
  const wasOnboarding = !req.actor.profileCompleted;
  await saveBrandProfile(req.actor, data);
  if (wasOnboarding) return ok(res, { redirectTo: "/dashboard?welcome=1" });
  ok(res, { message: "Company profile saved." });
});

router.get("/factory", manufacturer, async (req, res) => {
  res.json({ profile: await getFactoryProfile(req.actor) });
});

router.put("/factory", manufacturer, async (req, res) => {
  // Machinery rows arrive as parallel lists; empty rows are kept so error keys line up with the rows on screen.
  const machinery = machineryFromBody(req.body);
  const form = readForm(req, ["categories", "production", "fabrics", "finishing"]);
  delete form.machineType;
  delete form.machineQuantity;
  const data = validateForm(manufacturerProfileSchema, { ...form, machinery });
  const wasOnboarding = !req.actor.profileCompleted;
  await saveManufacturerProfile(req.actor, data);
  if (wasOnboarding) return ok(res, { redirectTo: "/factory?welcome=1" });
  ok(res, { message: "Factory profile saved." });
});

router.post("/factory/documents", manufacturer, uploadFields({ file: 1 }), async (req, res) => {
  const data = validateForm(documentSchema, readForm(req));
  const [file] = filesOf(req, "file");
  if (!file) throw invalid("Choose a file to upload.", { file: "Choose a PDF or image file." });
  await addManufacturerDocument(req.actor, file, data.type, data.certificationName);
  ok(res, { message: "Document uploaded. It will be reviewed with your verification request." });
});

router.delete("/factory/documents/:documentId", manufacturer, async (req, res) => {
  await deleteManufacturerDocument(req.actor, req.params.documentId);
  ok(res, { message: "Document deleted." });
});

router.post("/factory/verification-request", manufacturer, async (req, res) => {
  await requestVerification(req.actor);
  ok(res, { message: "Verification requested. An administrator will review your documents." });
});

export default router;
