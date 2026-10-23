import { Logo } from "@/components/site/logo";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="hidden flex-col justify-between bg-navy p-10 text-white lg:flex">
        <Logo inverted />
        <div className="max-w-md">
          <h2 className="text-2xl font-semibold text-white">Brief, quote, produce and inspect — in one workflow.</h2>
          <p className="mt-3 text-white/75">
            Brands and manufacturers share the same project status, quotations, milestones and quality reports.
          </p>
        </div>
        <p className="text-xs text-white/50">Final Year Project · The University of Lahore</p>
      </aside>
      <main id="main" className="flex flex-col">
        <div className="flex h-16 items-center justify-between px-4 sm:px-8">
          <span className="lg:invisible"><Logo /></span>
          <Link href="/" className="text-sm text-slate-blue hover:text-navy">Back to website</Link>
        </div>
        <div className="flex flex-1 items-start justify-center px-4 pb-12 pt-6 sm:items-center sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
