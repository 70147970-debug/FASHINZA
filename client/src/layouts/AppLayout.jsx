import { Outlet, useLocation, useNavigate, useNavigation } from "react-router";
import { AppShell } from "@/components/app/app-shell";
import { PageSkeleton } from "@/components/app/primitives";
import { requireUser, useSessionUser } from "@/lib/session";
import { apiPost } from "@/lib/api";

/** Every app page needs a signed-in user (src/app/(app)/layout.tsx calls requireUser()). */
export async function appLayoutLoader({ request }) {
  await requireUser(request);
  return null;
}

/**
 * Signed-in workspace (src/app/(app)/layout.tsx): the app shell with the user's name, email, role,
 * organisation and unread count from GET /api/auth/me (refreshed on every navigation and after every
 * mutation). While the next page loads, the shell shows the skeleton of src/app/(app)/loading.tsx.
 */
export default function AppLayout() {
  const user = useSessionUser();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const location = useLocation();
  // loading.tsx: a new page (another path) is loading; same-page updates (filters, tabs) keep the page.
  const loadingPage = navigation.state === "loading" && navigation.location && navigation.location.pathname !== location.pathname;

  // The loader already redirected signed-out visitors; this covers a session that ended in the meantime.
  if (!user) return null;

  async function signOut() {
    // signOutAction: delete the session, then `/login?signedOut=1`.
    let to = "/login?signedOut=1";
    try {
      const res = await apiPost("/api/auth/logout");
      if (res?.redirectTo) to = res.redirectTo;
    } catch {
      // The cookie may already be gone; the login page is still the right place.
    }
    navigate(to);
  }

  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role, org: user.org ?? null }} unread={user.unread ?? 0} signOut={signOut}>
      {loadingPage ? <PageSkeleton /> : <Outlet />}
    </AppShell>
  );
}
