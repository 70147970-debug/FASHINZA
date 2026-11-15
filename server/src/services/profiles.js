/**
 * Organisation profiles, factory documents and verification requests (port of src/server/services/profiles.ts).
 * The admin decisions (reviewDocument, decideVerification, revokeVerification) live in services/admin.js (SERVER-B).
 */
import { withTransaction } from "../db.js";
import { assertRole } from "../lib/access.js";
import { conflict, invalid, notFound } from "../lib/errors.js";
import { notifyAdmins } from "../lib/events.js";
import { checkLink, linkChecksEnabled } from "../lib/link-check.js";
import { defined, oid, opts, s } from "../lib/records.js";
import { serialize } from "../lib/serialize.js";
import { deleteStoredFile, saveUpload } from "../lib/storage.js";
import { BrandProfile } from "../models/BrandProfile.js";
import { ManufacturerCapability } from "../models/ManufacturerCapability.js";
import { ManufacturerDocument } from "../models/ManufacturerDocument.js";
import { ManufacturerMachine } from "../models/ManufacturerMachine.js";
import { ManufacturerProfile } from "../models/ManufacturerProfile.js";
import { User } from "../models/User.js";
import { LINK_NOT_FOUND_MESSAGE } from "@fashinza/shared/social.js";

/** A stored check older than this is repeated when the profile is saved again. */
export const LINK_RECHECK_AFTER_MS = 30 * 86_400_000;

/**
 * Live-checks the links of a profile that is being saved (decision 5), before anything is written:
 * - the website, when it changed: NOT_FOUND → field error `website`;
 * - each social link that is new or changed (or whose stored check is old, or was SKIPPED while checks are now
 *   on): NOT_FOUND → field error `socialLinks.<row>.url`; FOUND / UNCONFIRMED / SKIPPED are stored with the link.
 * Unchanged links keep their stored check. Links pointing to a private network address are refused with their
 * own message. Throws INVALID with every field error at once.
 * @param {{ website?: string | null, socialLinks?: { platform: string, url: string, check?: { status: string, checkedAt: Date | null } }[] } | null} existing
 * @param {{ website?: string, socialLinks?: { platform: string, url: string, row: number }[] }} input
 * @param {{ check?: typeof checkLink }} [deps]
 * @returns {Promise<{ socialLinks?: { platform: string, url: string, check: { status: string, checkedAt: Date } }[] }>}
 */
export async function verifyProfileLinks(existing, input, { check = checkLink } = {}) {
  /** @type {Record<string, string>} */
  const fieldErrors = {};
  const refusal = (r) => (r.reason === "BLOCKED_ADDRESS" ? r.message : LINK_NOT_FOUND_MESSAGE);
  const enabled = linkChecksEnabled();
  const websiteCheck =
    input.website && input.website !== existing?.website
      ? check({ url: input.website }).then((r) => {
          if (r.status === "NOT_FOUND") fieldErrors.website = refusal(r);
        })
      : null;
  let socialLinks;
  if (input.socialLinks) {
    const stored = new Map((existing?.socialLinks ?? []).map((l) => [`${l.platform} ${l.url}`, l.check]));
    socialLinks = await Promise.all(
      input.socialLinks.map(async (l) => {
        const prev = stored.get(`${l.platform} ${l.url}`);
        const age = prev?.checkedAt ? Date.now() - new Date(prev.checkedAt).getTime() : Infinity;
        const keep = prev?.status && prev.status !== "NOT_FOUND" && age < LINK_RECHECK_AFTER_MS && (prev.status !== "SKIPPED" || !enabled);
        if (keep) return { platform: l.platform, url: l.url, check: { status: prev.status, checkedAt: prev.checkedAt } };
        const r = await check({ platform: l.platform, url: l.url });
        if (r.status === "NOT_FOUND") fieldErrors[`socialLinks.${l.row}.url`] = refusal(r);
        return { platform: l.platform, url: l.url, check: { status: r.status, checkedAt: r.checkedAt } };
      }),
    );
  }
  await websiteCheck;
  if (Object.keys(fieldErrors).length) throw invalid("Please correct the highlighted fields.", fieldErrors);
  return { socialLinks };
}

/**
 * Website and social links are checked live first (verifyProfileLinks); `socialLinks` undefined keeps the stored list.
 * @param {{ id: string, role: string }} actor
 * @param {{ companyName: string, country: string, city?: string, website?: string, phone?: string, description?: string, socialLinks?: { platform: string, url: string, row: number }[] }} input
 * @param {{ check?: typeof checkLink }} [deps] replaces the live link check (tests)
 */
export async function saveBrandProfile(actor, input, deps) {
  assertRole(actor, "BRAND");
  const userId = oid(actor.id);
  const { socialLinks, ...rest } = input;
  const existing = rest.website !== undefined || socialLinks !== undefined ? await BrandProfile.findOne({ userId }, { website: 1, socialLinks: 1 }).lean() : null;
  const links = await verifyProfileLinks(existing, { website: rest.website, socialLinks }, deps);
  // Prisma upsert: undefined (cleared optional) fields are left as they are, exactly like today.
  const fields = defined({ ...rest, socialLinks: links.socialLinks });
  await withTransaction(async (session) => {
    await BrandProfile.findOneAndUpdate({ userId }, { $set: fields }, opts(session, { upsert: true, setDefaultsOnInsert: true }));
    await User.updateOne({ _id: userId }, { $set: { profileCompleted: true } }, opts(session));
  });
}

/** Capability rows from the three lists, without duplicates (Prisma createMany skipDuplicates). */
export function capabilityRows(production = [], fabrics = [], finishing = []) {
  const rows = [
    ...production.map((name) => ({ kind: "PRODUCTION", name })),
    ...fabrics.map((name) => ({ kind: "FABRIC", name })),
    ...finishing.map((name) => ({ kind: "FINISHING", name })),
  ];
  const seen = new Set();
  return rows.filter((r) => {
    const key = `${r.kind}\u0000${r.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Saves the factory profile with its capabilities and machinery. Capabilities and machinery are replaced as
 * a whole; when `machinery` is omitted (older callers such as the seed script) the stored list is kept.
 * Website and social links are checked live first (verifyProfileLinks); `socialLinks` undefined keeps the stored list.
 * @param {{ check?: typeof checkLink }} [deps] replaces the live link check (tests)
 */
export async function saveManufacturerProfile(actor, input, deps) {
  assertRole(actor, "MANUFACTURER");
  const { production = [], fabrics = [], finishing = [], machinery, socialLinks, ...rest } = input;
  const userId = oid(actor.id);
  const existing =
    rest.website !== undefined || socialLinks !== undefined ? await ManufacturerProfile.findOne({ userId }, { website: 1, socialLinks: 1 }).lean() : null;
  const links = await verifyProfileLinks(existing, { website: rest.website, socialLinks }, deps);
  const fields = defined({ ...rest, socialLinks: links.socialLinks });
  const capabilities = capabilityRows(production, fabrics, finishing);
  await withTransaction(async (session) => {
    const profile = await ManufacturerProfile.findOneAndUpdate(
      { userId },
      { $set: fields },
      opts(session, { upsert: true, new: true, setDefaultsOnInsert: true, projection: { _id: 1 } }),
    ).lean();
    await ManufacturerCapability.deleteMany({ profileId: profile._id }, opts(session));
    if (capabilities.length) await ManufacturerCapability.insertMany(capabilities.map((c) => ({ ...c, profileId: profile._id })), opts(session));
    if (machinery) {
      await ManufacturerMachine.deleteMany({ profileId: profile._id }, opts(session));
      if (machinery.length) {
        await ManufacturerMachine.insertMany(
          machinery.map((m, i) => ({ profileId: profile._id, type: m.type, quantity: m.quantity, sortOrder: i })),
          opts(session),
        );
      }
    }
    await User.updateOne({ _id: userId }, { $set: { profileCompleted: true } }, opts(session));
  });
}

/**
 * @param {{ id: string, role: string }} actor
 * @param {{ originalname: string, mimetype: string, size: number, buffer: Buffer }} file multer-like file
 * @param {"CERTIFICATION" | "BUSINESS_REGISTRATION" | "OTHER"} type
 * @param {string} [certificationName]
 */
export async function addManufacturerDocument(actor, file, type, certificationName) {
  assertRole(actor, "MANUFACTURER");
  const profile = await ManufacturerProfile.findOne({ userId: oid(actor.id) }, { _id: 1 }).lean();
  if (!profile) throw notFound("Factory profile");
  const stored = await saveUpload(file, "factory-docs");
  try {
    const doc = await ManufacturerDocument.create({ profileId: profile._id, type, certificationName: type === "CERTIFICATION" ? (certificationName ?? null) : null, ...stored });
    return serialize(ManufacturerDocument, doc);
  } catch (e) {
    await deleteStoredFile(stored.fileKey);
    throw e;
  }
}

export async function deleteManufacturerDocument(actor, documentId) {
  assertRole(actor, "MANUFACTURER");
  const doc = await ManufacturerDocument.findOne({ _id: oid(documentId) }).lean();
  const owner = doc ? await ManufacturerProfile.exists({ _id: doc.profileId, userId: oid(actor.id) }) : null;
  if (!doc || !owner) throw notFound("Document");
  if (doc.status === "VERIFIED") throw conflict("Verified documents are part of your verification record and cannot be deleted.");
  await ManufacturerDocument.deleteOne({ _id: doc._id });
  await deleteStoredFile(doc.fileKey);
}

export async function requestVerification(actor) {
  assertRole(actor, "MANUFACTURER");
  await withTransaction(async (session) => {
    const profile = await ManufacturerProfile.findOne({ userId: oid(actor.id) }).session(s(session)).lean();
    const user = profile ? await User.findById(profile.userId, { profileCompleted: 1 }).session(s(session)).lean() : null;
    if (!profile || !user?.profileCompleted) throw invalid("Complete your factory profile before requesting verification.");
    if (profile.verificationStatus === "PENDING") throw conflict("Your verification request is already being reviewed.");
    if (profile.verificationStatus === "VERIFIED") throw conflict("Your factory is already verified.");
    const documents = await ManufacturerDocument.find({ profileId: profile._id }, { type: 1, status: 1 }).session(s(session)).lean();
    if (!documents.some((d) => d.type === "BUSINESS_REGISTRATION" && d.status !== "REJECTED")) {
      throw invalid("Upload your business registration document before requesting verification.");
    }
    await ManufacturerProfile.updateOne(
      { _id: profile._id },
      { $set: { verificationStatus: "PENDING", verificationRequestedAt: new Date(), verificationNote: null } },
      opts(session),
    );
    const profileId = profile._id.toHexString();
    await notifyAdmins(session, "VERIFICATION_DECISION", "Factory awaiting verification", `${profile.businessName} has requested verification.`, `/admin/factories/${profileId}`);
  });
}

/**
 * Machinery listed on a factory profile, in the order the factory entered it.
 * @returns {Promise<{ type: string, quantity: number }[]>}
 */
export async function listMachinery(profileId, session) {
  const rows = await ManufacturerMachine.find({ profileId: oid(profileId) }, { _id: 0, type: 1, quantity: 1 })
    .sort({ sortOrder: 1, type: 1 })
    .session(s(session))
    .lean();
  return rows.map((r) => ({ type: r.type, quantity: r.quantity }));
}

/** Profiles saved before social links existed have no `socialLinks` field: always answer with a list. */
const withLinks = (profile) => (profile ? { ...profile, socialLinks: profile.socialLinks ?? [] } : profile);

/** GET /api/profile/brand */
export async function getBrandProfile(actor) {
  assertRole(actor, "BRAND");
  const profile = await BrandProfile.findOne({ userId: oid(actor.id) }).lean();
  return withLinks(serialize(BrandProfile, profile));
}

/** GET /api/profile/factory: profile + capabilities + documents (newest first) + machinery (factory order). */
export async function getFactoryProfile(actor) {
  assertRole(actor, "MANUFACTURER");
  const profile = await ManufacturerProfile.findOne({ userId: oid(actor.id) }).lean();
  if (!profile) return null;
  const [capabilities, documents, machinery] = await Promise.all([
    ManufacturerCapability.find({ profileId: profile._id }).sort({ _id: 1 }).lean(),
    ManufacturerDocument.find({ profileId: profile._id }).sort({ createdAt: -1, _id: -1 }).lean(),
    listMachinery(profile._id),
  ]);
  return {
    ...withLinks(serialize(ManufacturerProfile, profile)),
    capabilities: serialize(ManufacturerCapability, capabilities),
    documents: serialize(ManufacturerDocument, documents),
    machinery,
  };
}

/**
 * Builds the machinery rows from the profile form: two parallel repeated keys `machineType` / `machineQuantity`
 * (empty rows kept so error keys line up with the rows on screen), or a JSON `machinery` array.
 * @param {Record<string, unknown>} body raw request body
 */
export function machineryFromBody(body) {
  if (Array.isArray(body?.machinery)) return body.machinery;
  const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).map(String);
  const types = list(body?.machineType);
  const quantities = list(body?.machineQuantity);
  return types.map((type, i) => ({ type, quantity: quantities[i] ?? "" }));
}
