import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Used when a record does not exist or belongs to another organisation (the two are indistinguishable by design). */
export default function AppNotFound() {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-lg border border-line bg-surface px-6 py-12 text-center sm:mt-12 sm:px-10">
      <span className="mx-auto grid size-11 place-items-center rounded-md border border-line bg-canvas text-ink-muted">
        <SearchX className="size-5" strokeWidth={1.5} aria-hidden />
      </span>
      <h1 className="mt-5 font-display text-2xl font-medium tracking-[-0.02em] text-ink">Not found</h1>
      <p className="mt-2 text-sm leading-6 text-ink-muted">This record does not exist or you do not have access to it.</p>
      <Button asChild className="mt-6"><Link href="/dashboard">Back to dashboard</Link></Button>
    </div>
  );
}
