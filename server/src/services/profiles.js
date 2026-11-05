/**
 * Organisation profiles, factory documents and verification requests (port of src/server/services/profiles.ts).
 * The admin decisions (reviewDocument, decideVerification, revokeVerification) live in services/admin.js (SERVER-B).
 */
import { withTransaction } from "../db.js";
import { assertRole } from "../lib/access.js";
import { conflict, invalid, notFound } from "../lib/errors.js";
import { notifyAdmins } from "../lib/events.js";
import { defined, oid, opts, s } from "../lib/records.js";
import { serialize } from "../lib/serialize.js";
import { deleteStoredFile, saveUpload } from "../lib/storage.js";
import { BrandProfile } from "../models/BrandProfile.js";
import { ManufacturerCapability } from "../models/ManufacturerCapability.js";
import { ManufacturerDocument } from "../models/ManufacturerDocument.js";
import { ManufacturerMachine } from "../models/ManufacturerMachine.js";
import { ManufacturerProfile } from "../models/ManufacturerProfile.js";
import { User } from "../models/User.js";

/**
 * @param {{ id: string, role: string }} actor
 * @param {{ companyName: string, country: string, city?: string, website?: string, phone?: string, description?: string }} input
 */
export async function saveBrandProfile(actor, input) {
  assertRole(actor, "BRAND");
  const userId = oid(actor.id);
  // Prisma upsert: undefined (cleared optional) fields are left as they are, exactly like today.
  const fields = defined(input);
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
 */
export async function saveManufacturerProfile(actor, input) {
  assertRole(actor, "MANUFACTURER");
  const { production = [], fabrics = [], finishing = [], machinery, ...rest } = input;
  const fields = defined(rest);
  const capabilities = capabilityRows(production, fabrics, finishing);
  const userId = oid(actor.id);
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

/** GET /api/profile/brand */
export async function getBrandProfile(actor) {
  assertRole(actor, "BRAND");
  const profile = await BrandProfile.findOne({ userId: oid(actor.id) }).lean();
  return serialize(BrandProfile, profile);
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
    ...serialize(ManufacturerProfile, profile),
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
