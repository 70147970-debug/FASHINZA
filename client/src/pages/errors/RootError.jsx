import { Link } from "react-router";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Root error page (src/app/error.tsx): an unexpected error outside the app shell. */
export default function RootError({ reset }) {
  return (
    <main id="main" className="grid min-h-[60vh] place-items-center bg-canvas px-4 py-16">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-8 text-center sm:p-10">
        <span className="mx-auto grid size-11 place-items-center rounded-md border border-danger-line bg-danger-soft text-danger-strong">
          <AlertTriangle className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="mt-5 font-display text-[1.75rem] font-medium leading-tight tracking-[-0.02em] text-ink">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">An unexpected error occurred. No details have been shared. Please try again.</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset}>
            <RotateCcw /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Go to home page</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
