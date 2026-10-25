"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown inside the app shell when a page fails to load; the shell and navigation stay usable. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-lg border border-line bg-white px-6 py-10 text-center shadow-card sm:mt-12 sm:px-8">
      <span className="mx-auto grid size-10 place-items-center rounded-lg bg-warning-50 text-warning-700">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <h1 className="type-heading mt-4 text-navy">This page could not be loaded</h1>
      <p className="mt-1.5 text-sm leading-6 text-muted">
        Something went wrong on our side. Nothing you entered was lost. Try again, or go back to your dashboard.
        {error.digest && <span className="mt-3 block font-mono text-xs text-muted">Reference: {error.digest}</span>}
      </p>
      <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
        <Button asChild variant="outline"><Link href="/dashboard">Dashboard</Link></Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
