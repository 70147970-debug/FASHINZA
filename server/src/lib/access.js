/**
 * Tenant isolation (port of src/server/access.ts). Every query for business records is scoped with one of
 * these MongoDB filters, so a brand only reaches its own records and a manufacturer only reaches projects it
 * was matched to or quoted on, and orders it is producing. Admins see everything.
 *
 * Prisma relation filters (`some`, nested `where`) are resolved with preliminary id queries; pass the
 * transaction `session` when called inside one.
 */
import mongoose from "mongoose";
import { MatchResult } from "../models/MatchResult.js";
import { Order } from "../models/Order.js";
import { Project } from "../models/Project.js";
import { Quotation } from "../models/Quotation.js";
import { forbidden } from "./errors.js";

const oid = (id) => new mongoose.Types.ObjectId(String(id));

/** Throws FORBIDDEN ("You do not have permission to do that.") unless the actor has one of the roles. */
export function assertRole(actor, ...roles) {
  if (!roles.flat().includes(actor.role)) throw forbidden();
}

/** Ids of the projects a manufacturer was matched to or quoted on. */
export async function manufacturerProjectIds(manufacturerId, session) {
  const [matched, quoted] = await Promise.all([
    MatchResult.distinct("projectId", { manufacturerId: oid(manufacturerId) }).session(session ?? null),
    Quotation.distinct("projectId", { manufacturerId: oid(manufacturerId) }).session(session ?? null),
  ]);
  const seen = new Map();
  for (const id of [...matched, ...quoted]) seen.set(String(id), id);
  return [...seen.values()];
}

/** Ids of a brand's own projects. */
export async function brandProjectIds(brandId, session) {
  return Project.distinct("_id", { brandId: oid(brandId) }).session(session ?? null);
}

/** projectScope: filter on the `project` collection. */
export async function projectFilter(actor, session) {
  switch (actor.role) {
    case "ADMIN":
      return {};
    case "BRAND":
      return { brandId: oid(actor.id) };
    case "MANUFACTURER":
      return { status: { $ne: "DRAFT" }, _id: { $in: await manufacturerProjectIds(actor.id, session) } };
    default:
      return { _id: { $in: [] } };
  }
}

/** orderScope: filter on the `order` collection. */
export function orderFilter(actor) {
  switch (actor.role) {
    case "ADMIN":
      return {};
    case "BRAND":
      return { brandId: oid(actor.id) };
    case "MANUFACTURER":
      return { manufacturerId: oid(actor.id) };
    default:
      return { _id: { $in: [] } };
  }
}

/** quotationScope: filter on the `quotation` collection. Brands never see a manufacturer's unsent drafts. */
export async function quotationFilter(actor, session) {
  switch (actor.role) {
    case "ADMIN":
      return {};
    case "BRAND":
      return { projectId: { $in: await brandProjectIds(actor.id, session) }, status: { $ne: "DRAFT" } };
    case "MANUFACTURER":
      return { manufacturerId: oid(actor.id) };
    default:
      return { _id: { $in: [] } };
  }
}

/** disputeScope: filter on the `issue_report` collection. */
export async function disputeFilter(actor, session) {
  if (actor.role === "ADMIN") return {};
  const orderIds = await Order.distinct("_id", orderFilter(actor)).session(session ?? null);
  const or = [{ reporterId: oid(actor.id) }, { orderId: { $in: orderIds } }];
  if (actor.role === "BRAND") or.push({ projectId: { $in: await brandProjectIds(actor.id, session) } });
  return { $or: or };
}
