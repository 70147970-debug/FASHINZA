import { isRouteErrorResponse, useMatches, useRevalidator, useRouteError } from "react-router";
import { PageMeta } from "@/components/meta";
import { ThemeSync } from "@/components/theme/theme-sync";
import { Toaster } from "@/components/ui/toaster";
import NotFoundPage from "./NotFoundPage";
import RootError from "./RootError";
import AppNotFound from "./AppNotFound";
import AppError from "./AppError";

function useReset() {
  const revalidator = useRevalidator();
  return () => revalidator.revalidate();
}

/**
 * Root error boundary: a 404 (unknown record on a public page) renders the site's not-found page
 * (src/app/not-found.tsx); anything else renders src/app/error.tsx. It replaces the root layout, so it
 * mounts ThemeSync and the toaster itself.
 */
export function RootErrorBoundary() {
  const error = useRouteError();
  const reset = useReset();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (!notFound) console.error(error);
  return (
    <>
      <ThemeSync />
      {notFound ? <NotFoundPage /> : <RootError error={error} reset={reset} />}
      <Toaster />
    </>
  );
}

/**
 * Error boundary for app pages, rendered inside the app shell (the shell and navigation stay usable):
 * `notFound()` → src/app/(app)/not-found.tsx, other failures → src/app/(app)/error.tsx.
 * The page's static title still applies, as Next resolved `export const metadata` even when the page called
 * notFound(): pages that can fail export `handle = { title }` (e.g. "Edit project | Fashinza").
 */
export function AppErrorBoundary() {
  const error = useRouteError();
  const reset = useReset();
  const title = useMatches().findLast((m) => m.handle?.title)?.handle.title;
  const meta = title ? <PageMeta title={title} /> : null;
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <>
        {meta}
        <AppNotFound />
      </>
    );
  }
  console.error(error);
  return (
    <>
      {meta}
      <AppError error={error} reset={reset} />
    </>
  );
}
