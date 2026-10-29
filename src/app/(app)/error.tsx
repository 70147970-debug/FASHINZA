"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown inside the app shell when a page fails to load; the shell and navigation stay usable. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-lg border border-line bg-surface px-6 py-12 text-center sm:mt-12 sm:px-10">
      <span className="mx-auto grid size-11 place-items-center rounded-md border border-warning-line bg-warning-soft text-warning-strong">
        <AlertTriangle className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="mt-5 font-display text-2xl font-medium tracking-[-0.02em] text-ink">This page could not be loaded</h1>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        Something went wrong on our side. Nothing you entered was lost. Try again, or go back to your dashboard.
        {error.digest && <span className="mt-3 block font-mono text-xs text-ink-muted">Reference: {error.digest}</span>}
      </p>
      <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
        <Button asChild variant="outline"><Link href="/dashboard">Dashboard</Link></Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
