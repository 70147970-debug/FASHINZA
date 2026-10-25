import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Used when a record does not exist or belongs to another organisation (the two are indistinguishable by design). */
export default function AppNotFound() {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-lg border border-line bg-white px-6 py-10 text-center shadow-card sm:mt-12 sm:px-8">
      <span className="mx-auto grid size-10 place-items-center rounded-lg bg-teal-50 text-teal-700">
        <SearchX className="size-5" aria-hidden />
      </span>
      <h1 className="type-heading mt-4 text-navy">Not found</h1>
      <p className="mt-1.5 text-sm leading-6 text-muted">This record does not exist or you do not have access to it.</p>
      <Button asChild className="mt-6"><Link href="/dashboard">Back to dashboard</Link></Button>
    </div>
  );
}
