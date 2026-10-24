import { db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { orderScope, projectScope } from "@/server/access";
import { notFound } from "@/server/errors";

/**
 * Resolves a stored file key to its owning record and checks that the actor may see it.
 * Unknown keys and keys the actor cannot access produce the same "not found" error so that
 * the existence of other organisations' files is not revealed.
 */
export async function authorizeFile(actor: Actor, fileKey: string): Promise<{ fileName: string; mimeType: string }> {
  const [attachment, document, evidence, samplePhoto, qcPhoto] = await Promise.all([
    db.projectAttachment.findFirst({ where: { fileKey, project: projectScope(actor) }, select: { fileName: true, mimeType: true } }),
    db.manufacturerDocument.findFirst({
      where: { fileKey, ...(actor.role === "ADMIN" ? {} : { profile: { userId: actor.id } }) },
      select: { fileName: true, mimeType: true },
    }),
    db.milestoneEvidence.findFirst({ where: { fileKey, milestone: { order: orderScope(actor) } }, select: { fileName: true, mimeType: true } }),
    db.samplePhoto.findFirst({ where: { fileKey, sample: { order: orderScope(actor) } }, select: { fileName: true, mimeType: true } }),
    db.qCReportPhoto.findFirst({ where: { fileKey, report: { order: orderScope(actor) } }, select: { fileName: true, mimeType: true } }),
  ]);
  const found = attachment ?? document ?? evidence ?? samplePhoto ?? qcPhoto;
  if (!found) throw notFound("File");
  return found;
}
