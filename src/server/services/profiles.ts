import { db } from "@/lib/db";
import type { z } from "zod";
import type { brandProfileSchema, ManufacturerProfileInput } from "@/lib/validation/profile";
import type { Actor } from "@/server/actor";
import { assertRole } from "@/server/access";
import { conflict, invalid, notFound } from "@/server/errors";
import { audit, notify, notifyAdmins } from "@/server/events";
import { deleteStoredFile, saveUpload } from "@/server/storage";
import type { DocumentType } from "@/generated/prisma/enums";

export async function saveBrandProfile(actor: Actor, input: z.infer<typeof brandProfileSchema>) {
  assertRole(actor, "BRAND");
  await db.$transaction([
    db.brandProfile.upsert({ where: { userId: actor.id }, create: { userId: actor.id, ...input }, update: input }),
    db.user.update({ where: { id: actor.id }, data: { profileCompleted: true } }),
  ]);
}

export async function saveManufacturerProfile(actor: Actor, input: ManufacturerProfileInput) {
  assertRole(actor, "MANUFACTURER");
  const { production, fabrics, finishing, ...fields } = input;
  const capabilities = [
    ...production.map((name) => ({ kind: "PRODUCTION" as const, name })),
    ...fabrics.map((name) => ({ kind: "FABRIC" as const, name })),
    ...finishing.map((name) => ({ kind: "FINISHING" as const, name })),
  ];
  await db.$transaction(async (tx) => {
    const profile = await tx.manufacturerProfile.upsert({ where: { userId: actor.id }, create: { userId: actor.id, ...fields }, update: fields });
    await tx.manufacturerCapability.deleteMany({ where: { profileId: profile.id } });
    await tx.manufacturerCapability.createMany({ data: capabilities.map((c) => ({ ...c, profileId: profile.id })), skipDuplicates: true });
    await tx.user.update({ where: { id: actor.id }, data: { profileCompleted: true } });
  });
}

export async function addManufacturerDocument(actor: Actor, file: File, type: DocumentType, certificationName?: string) {
  assertRole(actor, "MANUFACTURER");
  const profile = await db.manufacturerProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
  if (!profile) throw notFound("Factory profile");
  const stored = await saveUpload(file, "factory-docs");
  try {
    return await db.manufacturerDocument.create({ data: { profileId: profile.id, type, certificationName: type === "CERTIFICATION" ? certificationName : null, ...stored } });
  } catch (e) {
    await deleteStoredFile(stored.fileKey);
    throw e;
  }
}

export async function deleteManufacturerDocument(actor: Actor, documentId: string) {
  assertRole(actor, "MANUFACTURER");
  const doc = await db.manufacturerDocument.findFirst({ where: { id: documentId, profile: { userId: actor.id } } });
  if (!doc) throw notFound("Document");
  if (doc.status === "VERIFIED") throw conflict("Verified documents are part of your verification record and cannot be deleted.");
  await db.manufacturerDocument.delete({ where: { id: doc.id } });
  await deleteStoredFile(doc.fileKey);
}

export async function requestVerification(actor: Actor) {
  assertRole(actor, "MANUFACTURER");
  await db.$transaction(async (tx) => {
    const profile = await tx.manufacturerProfile.findUnique({ where: { userId: actor.id }, include: { documents: true, user: { select: { profileCompleted: true } } } });
    if (!profile || !profile.user.profileCompleted) throw invalid("Complete your factory profile before requesting verification.");
    if (profile.verificationStatus === "PENDING") throw conflict("Your verification request is already being reviewed.");
    if (profile.verificationStatus === "VERIFIED") throw conflict("Your factory is already verified.");
    if (!profile.documents.some((d) => d.type === "BUSINESS_REGISTRATION" && d.status !== "REJECTED")) {
      throw invalid("Upload your business registration document before requesting verification.");
    }
    await tx.manufacturerProfile.update({ where: { id: profile.id }, data: { verificationStatus: "PENDING", verificationRequestedAt: new Date(), verificationNote: null } });
    await notifyAdmins(tx, "VERIFICATION_DECISION", "Factory awaiting verification", `${profile.businessName} has requested verification.`, `/admin/factories/${profile.id}`);
  });
}

/** Admin review of one uploaded document (e.g. confirming a GOTS certificate is genuine). */
export async function reviewDocument(actor: Actor, documentId: string, status: "VERIFIED" | "REJECTED", note?: string) {
  assertRole(actor, "ADMIN");
  if (status === "REJECTED" && !note) throw invalid("Give a reason for rejecting the document.", { note: "Give a reason for rejecting the document." });
  await db.$transaction(async (tx) => {
    const doc = await tx.manufacturerDocument.findUnique({ where: { id: documentId }, include: { profile: { select: { userId: true } } } });
    if (!doc) throw notFound("Document");
    await tx.manufacturerDocument.update({ where: { id: doc.id }, data: { status, reviewNote: note ?? null, reviewedAt: new Date() } });
    await audit(tx, { actorId: actor.id, action: `DOCUMENT_${status}`, targetType: "ManufacturerDocument", targetId: doc.id, reason: note, metadata: { fileName: doc.fileName, certification: doc.certificationName } });
    await notify(tx, doc.profile.userId, "VERIFICATION_DECISION", `Document ${status === "VERIFIED" ? "verified" : "rejected"}`, `${doc.certificationName ?? doc.fileName}${note ? `: ${note}` : ""}`, "/factory");
  });
}

export async function decideVerification(actor: Actor, profileId: string, decision: "VERIFIED" | "REJECTED", reason: string) {
  assertRole(actor, "ADMIN");
  await db.$transaction(async (tx) => {
    const profile = await tx.manufacturerProfile.findUnique({ where: { id: profileId }, include: { documents: true } });
    if (!profile) throw notFound("Factory");
    if (profile.verificationStatus !== "PENDING") throw conflict("Only factories awaiting review can be verified or rejected.");
    if (decision === "VERIFIED" && !profile.documents.some((d) => d.type === "BUSINESS_REGISTRATION" && d.status === "VERIFIED")) {
      throw invalid("Verify the business registration document before approving the factory.");
    }
    await tx.manufacturerProfile.update({
      where: { id: profileId },
      data: { verificationStatus: decision, verificationNote: reason, verifiedAt: decision === "VERIFIED" ? new Date() : null },
    });
    await audit(tx, { actorId: actor.id, action: `FACTORY_${decision}`, targetType: "ManufacturerProfile", targetId: profileId, reason });
    await notify(
      tx,
      profile.userId,
      "VERIFICATION_DECISION",
      decision === "VERIFIED" ? "Your factory is verified" : "Verification not approved",
      decision === "VERIFIED" ? "You can now be matched to brand projects and submit quotations." : reason,
      "/factory",
    );
  });
}

/** Admin: withdraw verification (e.g. an expired certificate). */
export async function revokeVerification(actor: Actor, profileId: string, reason: string) {
  assertRole(actor, "ADMIN");
  await db.$transaction(async (tx) => {
    const profile = await tx.manufacturerProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw notFound("Factory");
    if (profile.verificationStatus !== "VERIFIED") throw conflict("Only verified factories can have verification revoked.");
    await tx.manufacturerProfile.update({ where: { id: profileId }, data: { verificationStatus: "REJECTED", verificationNote: reason, verifiedAt: null } });
    await audit(tx, { actorId: actor.id, action: "FACTORY_VERIFICATION_REVOKED", targetType: "ManufacturerProfile", targetId: profileId, reason });
    await notify(tx, profile.userId, "VERIFICATION_DECISION", "Verification revoked", reason, "/factory");
  });
}
