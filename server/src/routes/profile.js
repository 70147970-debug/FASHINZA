/**
 * Profiles, factory documents, verification requests (mounted at /api/profile) — owner: SERVER-A
 * (docs/api.md §3.2, §6.1). Port of src/app/(app)/profile-actions.ts and the profile/factory/onboarding page data.
 *   GET    /brand                                user BRAND
 *   PUT    /brand                                user BRAND
 *   GET    /factory                              user MANUFACTURER
 *   PUT    /factory                              user MANUFACTURER
 *   POST   /factory/documents (multipart)        user MANUFACTURER
 *   DELETE /factory/documents/:documentId        user MANUFACTURER
 *   POST   /factory/verification-request         user MANUFACTURER
 *   POST   /check-link                           user BRAND, MANUFACTURER (live check of one social link)
 *
 * Social links arrive as two parallel repeated keys `socialPlatform` / `socialUrl` (multipart; empty rows kept so
 * error keys `socialLinks.<row>.url` line up with the rows on screen) or as a JSON `socialLinks` array. A PUT
 * always replaces the list (no rows = no links), like machinery.
 */
import { Router } from "express";
import { brandProfileSchema, documentSchema, manufacturerProfileSchema } from "@fashinza/shared/validation/profile.js";
import { checkLinkSchema, socialLinksFromBody } from "@fashinza/shared/social.js";
import { invalid } from "../lib/errors.js";
import { filesOf, ok, readForm, uploadFields, validateForm } from "../lib/form.js";
import { checkLink } from "../lib/link-check.js";
import { enforceRateLimit } from "../lib/rate-limit.js";
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
const member = requireUser(["BRAND", "MANUFACTURER"]);

/** Form fields of a profile PUT with the social link rows gathered into `socialLinks`. */
function profileForm(req, arrayKeys = []) {
  const socialLinks = socialLinksFromBody(req.body);
  const form = readForm(req, arrayKeys);
  delete form.socialPlatform;
  delete form.socialUrl;
  return { ...form, socialLinks };
}

router.get("/brand", brand, async (req, res) => {
  res.json({ profile: await getBrandProfile(req.actor) });
});

router.put("/brand", brand, async (req, res) => {
  const data = validateForm(brandProfileSchema, profileForm(req));
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
  const form = profileForm(req, ["categories", "production", "fabrics", "finishing"]);
  delete form.machineType;
  delete form.machineQuantity;
  const data = validateForm(manufacturerProfileSchema, { ...form, machinery });
  const wasOnboarding = !req.actor.profileCompleted;
  await saveManufacturerProfile(req.actor, data);
  if (wasOnboarding) return ok(res, { redirectTo: "/factory?welcome=1" });
  ok(res, { message: "Factory profile saved." });
});

// "Check link" button: { platform, url } → { status, message, url (normalised), checkedAt }. Each check makes
// outbound requests, so it is limited per account.
router.post("/check-link", member, async (req, res) => {
  enforceRateLimit(`link-check:${req.actor.id}`, 30, 10 * 60_000, "Too many link checks. Please wait a few minutes and try again.");
  const data = validateForm(checkLinkSchema, readForm(req));
  const result = await checkLink(data);
  res.json({ status: result.status, message: result.message, url: data.url, checkedAt: result.checkedAt });
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
