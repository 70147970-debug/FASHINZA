/**
 * Every URL of the Next.js app, unchanged (React Router 7, data mode).
 *
 * Layout routes mirror the Next route groups:
 *   root            src/app/layout.tsx          theme sync, toaster, scroll restoration
 *   ├─ public       src/app/(public)/layout.tsx site header + footer
 *   ├─ auth         src/app/(auth)/layout.tsx   form beside the photographic panel
 *   ├─ app          src/app/(app)/layout.tsx    app shell (requires a signed-in user)
 *   │   └─ (pages)  error boundary inside the shell: (app)/not-found.tsx and (app)/error.tsx
 *   ├─ /sandbox-checkout/:ref and /notifications/:id (no layout, as today)
 *   └─ *            src/app/not-found.tsx
 *
 * Page modules (src/pages/**) are loaded lazily. Each one `export default`s its component and may export
 * `loader({ request, params, user })`, `action`, `shouldRevalidate` and `handle`. The router runs the path's
 * gate (docs/mern/api.md §2) and the role redirects listed there *before* the page loader, and passes the
 * gate's user to it, so page modules only load their data. One file per page: CLIENT-A and CLIENT-B never
 * need to edit this file to port a page.
 */
import { createBrowserRouter, redirect } from "react-router";
import RootLayout from "@/layouts/RootLayout";
import PublicLayout from "@/layouts/PublicLayout";
import AuthLayout from "@/layouts/AuthLayout";
import AppLayout, { appLayoutLoader } from "@/layouts/AppLayout";
import NotFoundPage from "@/pages/errors/NotFoundPage";
import { AppErrorBoundary, RootErrorBoundary } from "@/pages/errors/boundaries";
import { fetchSession, homeFor, requireOnboardedUser, requireUser, rootLoader, rootShouldRevalidate } from "@/lib/session";

/** Gate: no session needed. The user (or null) is still passed to the page loader. */
const PUBLIC = { kind: "public" };
/** `requireUser(roles?)` */
const user = (roles) => ({ kind: "user", roles });
/** `requireOnboardedUser(roles?)` */
const onboarded = (roles) => ({ kind: "onboarded", roles });

async function runGate(gate, request) {
  if (gate.kind === "user") return requireUser(request, gate.roles);
  if (gate.kind === "onboarded") return requireOnboardedUser(request, gate.roles);
  return (await fetchSession()).user;
}

/**
 * A lazily loaded page route.
 * @param {string | null} path relative path; null for the index route
 * @param {() => Promise<any>} load dynamic import of the page module
 * @param {{ kind: string, roles?: string[] }} gate
 * @param {(user: any, params: Record<string, string>) => string | null | undefined} [redirectIf] role redirects made
 *   before any data is loaded (e.g. ADMIN on /dashboard → /admin)
 */
function page(path, load, gate, redirectIf) {
  return {
    ...(path === null ? { index: true } : { path }),
    lazy: async () => {
      const mod = await load();
      return {
        Component: mod.default,
        loader: async (args) => {
          const current = await runGate(gate, args.request);
          const to = redirectIf?.(current, args.params);
          if (to) throw redirect(to);
          return mod.loader ? mod.loader({ ...args, user: current }) : null;
        },
        ...(mod.action ? { action: mod.action } : {}),
        ...(mod.shouldRevalidate ? { shouldRevalidate: mod.shouldRevalidate } : {}),
        ...(mod.handle ? { handle: mod.handle } : {}),
      };
    },
  };
}

/** Login and Register: signed-in visitors go to their workspace. */
const signedInHome = (u) => (u ? homeFor(u.role) : null);

export const routes = [
  {
    id: "root",
    path: "/",
    Component: RootLayout,
    loader: rootLoader,
    shouldRevalidate: rootShouldRevalidate,
    ErrorBoundary: RootErrorBoundary,
    HydrateFallback: () => null,
    children: [
      {
        id: "public",
        Component: PublicLayout,
        children: [
          page(null, () => import("@/pages/public/HomePage"), PUBLIC),
          page("about", () => import("@/pages/public/AboutPage"), PUBLIC),
          page("contact", () => import("@/pages/public/ContactPage"), PUBLIC),
          page("faq", () => import("@/pages/public/FaqPage"), PUBLIC),
          page("for-brands", () => import("@/pages/public/ForBrandsPage"), PUBLIC),
          page("for-manufacturers", () => import("@/pages/public/ForManufacturersPage"), PUBLIC),
          page("how-it-works", () => import("@/pages/public/HowItWorksPage"), PUBLIC),
          page("privacy", () => import("@/pages/public/PrivacyPage"), PUBLIC),
          page("sustainability", () => import("@/pages/public/SustainabilityPage"), PUBLIC),
          page("terms", () => import("@/pages/public/TermsPage"), PUBLIC),
        ],
      },
      {
        id: "auth",
        Component: AuthLayout,
        children: [
          page("login", () => import("@/pages/auth/LoginPage"), PUBLIC, signedInHome),
          page("register", () => import("@/pages/auth/RegisterPage"), PUBLIC, signedInHome),
          page("forgot-password", () => import("@/pages/auth/ForgotPasswordPage"), PUBLIC),
          page("reset-password", () => import("@/pages/auth/ResetPasswordPage"), PUBLIC),
        ],
      },
      {
        id: "app",
        Component: AppLayout,
        loader: appLayoutLoader,
        children: [
          {
            id: "app-pages",
            ErrorBoundary: AppErrorBoundary,
            children: [
              page("onboarding", () => import("@/pages/app/onboarding/OnboardingPage"), user(), (u) =>
                u.role === "ADMIN" ? "/admin" : u.profileCompleted ? (u.role === "BRAND" ? "/dashboard" : "/factory") : null,
              ),
              page("dashboard", () => import("@/pages/app/dashboard/DashboardPage"), onboarded(), (u) => (u.role === "ADMIN" ? "/admin" : null)),

              page("projects", () => import("@/pages/app/projects/ProjectsPage"), onboarded(["BRAND", "ADMIN"])),
              page("projects/new", () => import("@/pages/app/projects/NewProjectPage"), onboarded(["BRAND"])),
              page("projects/:id", () => import("@/pages/app/projects/ProjectDetailPage"), onboarded(), (u, p) =>
                u.role === "MANUFACTURER" ? `/opportunities/${p.id}` : null,
              ),
              page("projects/:id/edit", () => import("@/pages/app/projects/EditProjectPage"), onboarded(["BRAND"])),

              page("opportunities", () => import("@/pages/app/opportunities/OpportunitiesPage"), onboarded(["MANUFACTURER"])),
              page("opportunities/:id", () => import("@/pages/app/opportunities/OpportunityDetailPage"), onboarded(["MANUFACTURER"])),
              page("quotations", () => import("@/pages/app/quotations/QuotationsPage"), onboarded(["MANUFACTURER"])),

              page("orders", () => import("@/pages/app/orders/OrdersPage"), onboarded(), (u) => (u.role === "ADMIN" ? "/admin/orders" : null)),
              page("orders/:id", () => import("@/pages/app/orders/OrderDetailPage"), onboarded()),
              page("payments", () => import("@/pages/app/payments/PaymentsPage"), onboarded(["BRAND", "MANUFACTURER"])),
              page("disputes", () => import("@/pages/app/disputes/DisputesPage"), onboarded(), (u) => (u.role === "ADMIN" ? "/admin/disputes" : null)),
              page("disputes/:id", () => import("@/pages/app/disputes/DisputeDetailPage"), onboarded()),

              page("notifications", () => import("@/pages/app/notifications/NotificationsPage"), user()),
              page("profile", () => import("@/pages/app/profile/ProfilePage"), onboarded(["BRAND"])),
              page("factory", () => import("@/pages/app/factory/FactoryPage"), onboarded(["MANUFACTURER"])),
              page("settings", () => import("@/pages/app/settings/SettingsPage"), user()),
              page("search", () => import("@/pages/app/search/SearchPage"), onboarded()),

              page("admin", () => import("@/pages/admin/AdminOverviewPage"), user(["ADMIN"])),
              page("admin/factories", () => import("@/pages/admin/AdminFactoriesPage"), user(["ADMIN"])),
              page("admin/factories/:id", () => import("@/pages/admin/AdminFactoryReviewPage"), user(["ADMIN"])),
              page("admin/users", () => import("@/pages/admin/AdminUsersPage"), user(["ADMIN"])),
              page("admin/orders", () => import("@/pages/admin/AdminOrdersPage"), user(["ADMIN"])),
              page("admin/qc", () => import("@/pages/admin/AdminQcPage"), user(["ADMIN"])),
              page("admin/disputes", () => import("@/pages/admin/AdminDisputesPage"), user(["ADMIN"])),
              page("admin/payments", () => import("@/pages/admin/AdminPaymentsPage"), user(["ADMIN"])),
              page("admin/audit", () => import("@/pages/admin/AdminAuditPage"), user(["ADMIN"])),
              page("admin/enquiries", () => import("@/pages/admin/AdminEnquiriesPage"), user(["ADMIN"])),
            ],
          },
        ],
      },
      // Outside the app shell, as today: the checkout page has its own minimal frame, and opening a
      // notification is a redirect (a route handler today) that renders nothing.
      page("sandbox-checkout/:ref", () => import("@/pages/sandbox-checkout/SandboxCheckoutPage"), user(["BRAND"])),
      page("notifications/:id", () => import("@/pages/app/notifications/OpenNotificationPage"), user()),
      { path: "*", Component: NotFoundPage },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
