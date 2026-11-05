import { redirect } from "react-router";
import { apiPost } from "@/lib/api";

/**
 * /notifications/:id — port of src/app/(app)/notifications/[id]/route.ts (gate: user). Not a visual page: the
 * loader marks the notification read (only if it belongs to the caller) and redirects to its link (same-site
 * relative links only, else /notifications), as the route handler did. Nothing renders.
 */
export async function loader({ params }) {
  let res;
  try {
    res = await apiPost(`/api/notifications/${params.id}/open`);
  } catch (err) {
    // Signed out meanwhile: the route handler sent the visitor to /login.
    if (err?.code === "UNAUTHENTICATED") throw redirect("/login");
    throw err;
  }
  const target = typeof res?.redirectTo === "string" && res.redirectTo.startsWith("/") && !res.redirectTo.startsWith("//") ? res.redirectTo : "/notifications";
  throw redirect(target);
}

// Kept for the router's page contract (a module with a default export); never rendered because the loader redirects.
export default function OpenNotificationPage() {
  return null;
}
