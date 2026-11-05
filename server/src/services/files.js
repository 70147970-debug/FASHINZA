/**
 * Private file access (port of src/server/services/files.ts).
 */
import { orderFilter, projectFilter } from "../lib/access.js";
import { notFound } from "../lib/errors.js";
import { and, oid } from "../lib/records.js";
import { ManufacturerDocument } from "../models/ManufacturerDocument.js";
import { ManufacturerProfile } from "../models/ManufacturerProfile.js";
import { MilestoneEvidence } from "../models/MilestoneEvidence.js";
import { Order } from "../models/Order.js";
import { ProductionMilestone } from "../models/ProductionMilestone.js";
import { Project } from "../models/Project.js";
import { ProjectAttachment } from "../models/ProjectAttachment.js";
import { QCReport } from "../models/QCReport.js";
import { QCReportPhoto } from "../models/QCReportPhoto.js";
import { Sample } from "../models/Sample.js";
import { SamplePhoto } from "../models/SamplePhoto.js";

const META = { fileName: 1, mimeType: 1 };
const meta = (f) => (f ? { fileName: f.fileName, mimeType: f.mimeType } : null);

async function orderVisible(actor, orderId) {
  return orderId ? Boolean(await Order.exists(and({ _id: orderId }, orderFilter(actor)))) : false;
}

async function attachmentFor(actor, fileKey) {
  const att = await ProjectAttachment.findOne({ fileKey }, { ...META, projectId: 1 }).lean();
  if (!att) return null;
  return (await Project.exists(and({ _id: att.projectId }, await projectFilter(actor)))) ? meta(att) : null;
}

async function documentFor(actor, fileKey) {
  const doc = await ManufacturerDocument.findOne({ fileKey }, { ...META, profileId: 1 }).lean();
  if (!doc) return null;
  if (actor.role === "ADMIN") return meta(doc);
  return (await ManufacturerProfile.exists({ _id: doc.profileId, userId: oid(actor.id) })) ? meta(doc) : null;
}

async function evidenceFor(actor, fileKey) {
  const ev = await MilestoneEvidence.findOne({ fileKey }, { ...META, milestoneId: 1 }).lean();
  if (!ev) return null;
  const milestone = await ProductionMilestone.findById(ev.milestoneId, { orderId: 1 }).lean();
  return (await orderVisible(actor, milestone?.orderId)) ? meta(ev) : null;
}

async function samplePhotoFor(actor, fileKey) {
  const photo = await SamplePhoto.findOne({ fileKey }, { ...META, sampleId: 1 }).lean();
  if (!photo) return null;
  const sample = await Sample.findById(photo.sampleId, { orderId: 1 }).lean();
  return (await orderVisible(actor, sample?.orderId)) ? meta(photo) : null;
}

async function qcPhotoFor(actor, fileKey) {
  const photo = await QCReportPhoto.findOne({ fileKey }, { ...META, reportId: 1 }).lean();
  if (!photo) return null;
  const report = await QCReport.findById(photo.reportId, { orderId: 1 }).lean();
  return (await orderVisible(actor, report?.orderId)) ? meta(photo) : null;
}

/**
 * Resolves a stored file key to its owning record and checks that the actor may see it.
 * Unknown keys and keys the actor cannot access produce the same "not found" error so that
 * the existence of other organisations' files is not revealed.
 * @returns {Promise<{ fileName: string, mimeType: string }>}
 */
export async function authorizeFile(actor, fileKey) {
  const key = String(fileKey);
  const [attachment, document, evidence, samplePhoto, qcPhoto] = await Promise.all([
    attachmentFor(actor, key),
    documentFor(actor, key),
    evidenceFor(actor, key),
    samplePhotoFor(actor, key),
    qcPhotoFor(actor, key),
  ]);
  const found = attachment ?? document ?? evidence ?? samplePhoto ?? qcPhoto;
  if (!found) throw notFound("File");
  return found;
}
