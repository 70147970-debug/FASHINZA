import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Used when a record does not exist or belongs to another organisation (the two are indistinguishable by design). */
export default function AppNotFound() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border border-line bg-white p-8 text-center shadow-card">
      <SearchX className="mx-auto size-8 text-slate-blue" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted">This record does not exist or you do not have access to it.</p>
      <Button asChild className="mt-6"><Link href="/dashboard">Back to dashboard</Link></Button>
    </div>
  );
}
