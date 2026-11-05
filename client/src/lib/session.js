/**
 * The signed-in user (GET /api/auth/me) and the page gates that replace `requireUser` /
 * `requireOnboardedUser` from src/server/auth/session.ts and the optimistic redirect in src/proxy.ts.
 *
 * Route loaders call the gates *before* loading page data (docs/mern/api.md §2); the server checks the
 * same rules again on every endpoint. All loaders of one navigation share a single /api/auth/me request.
 *
 *   export async function loader({ request }) {
 *     const user = await requireOnboardedUser(request, ["BRAND"]);
 *     return loadJson("/api/projects", { request, query: … });
 *   }
 */
import { redirect, useRouteLoaderData } from "react-router";
import { homeFor } from "@/components/app/nav";
import { api, loginPath, requestPath } from "./api";

/**
 * @typedef {"BRAND" | "MANUFACTURER" | "ADMIN"} Role
 * @typedef {{ id: string, name: string, email: string, role: Role, profileCompleted: boolean, org: string | null, unread: number }} SessionUser
 */

/** @type {Promise<{ user: SessionUser | null, unavailable: boolean }> | null} */
let inFlight = null;

/**
 * GET /api/auth/me, de-duplicated while a request is in flight (the root loader and the page's gate run in
 * parallel on every navigation). Never throws: when the API cannot be reached the result is
 * `{ user: null, unavailable: true }` so public pages still render; gates turn that into an error.
 * @returns {Promise<{ user: SessionUser | null, unavailable: boolean }>}
 */
export function fetchSession() {
  if (!inFlight) {
    inFlight = api("/api/auth/me")
      .then((res) => ({ user: res?.user ?? null, unavailable: false }))
      .catch(() => ({ user: null, unavailable: true }))
      .finally(() => {
        // Let the parallel loaders of this navigation reuse the answer, then forget it.
        setTimeout(() => {
          inFlight = null;
        }, 0);
      });
  }
  return inFlight;
}

/** Root route loader: `{ user }` for the header, the app shell and `useSessionUser()`. */
export async function rootLoader() {
  const { user } = await fetchSession();
  return { user };
}

/** Re-run the root loader on every navigation, as the Next layouts re-rendered (keeps the unread badge fresh). */
export function rootShouldRevalidate() {
  return true;
}

/** The signed-in user from the root loader, or null when signed out. */
export function useSessionUser() {
  return useRouteLoaderData("root")?.user ?? null;
}

/** Where a role starts: `/admin` for ADMIN, else `/dashboard` (re-exported from components/app/nav). */
export { homeFor };

/** The current user for a loader, or null; throws when the API is unreachable (route error boundary). */
export async function getCurrentUser() {
  const { user, unavailable } = await fetchSession();
  if (unavailable) throw new Error("The Fashinza API could not be reached.");
  return user;
}

/**
 * `requireUser(roles?)`: signed out → `/login?next=<path+search>`; role not allowed → `/dashboard?denied=1`.
 * @param {Request} request the loader's request (for `?next=`)
 * @param {Role[]} [roles]
 * @returns {Promise<SessionUser>}
 */
export async function requireUser(request, roles) {
  const user = await getCurrentUser();
  if (!user) throw redirect(loginPath(requestPath(request)));
  if (roles && !roles.includes(user.role)) throw redirect("/dashboard?denied=1");
  return user;
}

/**
 * `requireOnboardedUser(roles?)`: `requireUser(roles)`, then a non-admin whose profile is not complete goes
 * to `/onboarding`. Check order as today: authentication, role, onboarding.
 * @param {Request} request
 * @param {Role[]} [roles]
 * @returns {Promise<SessionUser>}
 */
export async function requireOnboardedUser(request, roles) {
  const user = await requireUser(request, roles);
  if (!user.profileCompleted && user.role !== "ADMIN") throw redirect("/onboarding");
  return user;
}
