"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown inside the app shell when a page fails to load; the shell and navigation stay usable. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border border-line bg-white p-8 text-center shadow-card">
      <AlertTriangle className="mx-auto size-8 text-warning" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold">This page could not be loaded</h1>
      <p className="mt-2 text-sm text-muted">
        Something went wrong on our side. Nothing you entered was lost. Try again, or go back to your dashboard.
        {error.digest && <span className="mt-2 block font-mono text-xs">Reference: {error.digest}</span>}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline"><Link href="/dashboard">Dashboard</Link></Button>
      </div>
    </div>
  );
}
