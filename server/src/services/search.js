/**
 * Workspace search (port of the data loading in src/app/(app)/search/page.tsx). Searches only what the signed-in
 * user can already access: the list services apply tenant scoping.
 */
import { listOpportunities } from "./opportunities.js";
import { listProjects } from "./projects.js";

/** SERVER-B's listOrders, loaded on first use so this module also loads before orders.js exists. */
async function listOrders(actor, f) {
  const orders = await import("./orders.js");
  return orders.listOrders(actor, f);
}

/** The search term as the page used it: trimmed, at most 100 characters. */
export function searchTerm(raw) {
  return (typeof raw === "string" ? raw : "").trim().slice(0, 100);
}

/**
 * @param {{ id: string, role: string }} actor
 * @param {string} q already normalised with searchTerm()
 */
export async function search(actor, q) {
  if (!q) return { q: "", projects: null, orders: null, opportunities: null, total: 0 };
  const [projects, orders, opportunities] = await Promise.all([
    actor.role === "MANUFACTURER" ? null : listProjects(actor, { q, pageSize: 10 }),
    listOrders(actor, { q, pageSize: 10 }),
    actor.role === "MANUFACTURER" ? listOpportunities(actor, { q, filter: "all" }) : null,
  ]);
  const total = (projects?.total ?? 0) + orders.total + (opportunities?.total ?? 0);
  return { q, projects, orders, opportunities, total };
}
