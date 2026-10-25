import Link from "next/link";
import { ArrowLeft, BadgeCheck, Layers, ListChecks } from "lucide-react";
import { Logo } from "@/components/site/logo";

const POINTS = [
  {
    icon: ListChecks,
    title: "Matching you can read",
    text: "Every factory match shows the rules behind its score, and why others were excluded.",
  },
  {
    icon: Layers,
    title: "One shared status",
    text: "Brands and manufacturers see the same quotations, milestones and quality reports.",
  },
  {
    icon: BadgeCheck,
    title: "Manufacturers reviewed by a person",
    text: "Verification is a manual review of documents by a Fashinza administrator.",
  },
];

const STAGES = ["Fabric", "Sampling", "Cutting", "Stitching", "Finishing", "QC", "Shipping", "Delivery"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <main id="main" className="flex min-w-0 flex-col">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
          <Logo />
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md text-sm font-medium text-slate-blue transition-colors duration-150 hover:text-navy"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to website
          </Link>
        </div>
        <div className="flex flex-1 flex-col items-center justify-start px-4 pb-12 pt-4 sm:justify-center sm:px-8 sm:pt-8">
          <div className="w-full max-w-[28rem] rounded-xl border border-line bg-white p-6 shadow-raised sm:p-8">{children}</div>
          <ul className="mt-8 w-full max-w-[28rem] space-y-3 px-1 lg:hidden" aria-label="About Fashinza">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-3 text-[13px] leading-5 text-muted">
                <p.icon className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
                <span>
                  <span className="font-medium text-navy">{p.title}.</span> {p.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="px-4 pb-4 text-center text-xs text-muted sm:px-8">
          <Link href="/privacy" className="inline-flex min-h-10 items-center hover:text-navy hover:underline">Privacy Policy</Link>
          <span aria-hidden> · </span>
          <Link href="/terms" className="inline-flex min-h-10 items-center hover:text-navy hover:underline">Terms of Service</Link>
        </p>
      </main>
      <aside className="hidden bg-navy text-white lg:block" aria-label="About Fashinza">
        <div className="sticky top-0 flex h-dvh max-h-[60rem] flex-col justify-between overflow-hidden p-12 xl:p-16">
          <p className="eyebrow text-teal-100">Apparel manufacturing, managed</p>
          <div className="max-w-md">
            <h2 className="text-balance font-display text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-white">
              Brief, quote, produce and inspect — in one workflow.
            </h2>
            <ul className="mt-10 space-y-7">
              {POINTS.map((p) => (
                <li key={p.title} className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-white/10 text-teal-100">
                    <p.icon className="size-[18px]" aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-[0.9375rem] font-semibold text-white">{p.title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/70">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-12 rounded-lg border border-white/10 bg-white/5 p-5" aria-hidden>
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>Order stages · example</span>
                <span className="tabular">4 of 8</span>
              </div>
              <div className="mt-3 grid grid-cols-8 gap-1">
                {STAGES.map((s, i) => (
                  <span key={s} className={i < 3 ? "h-1.5 rounded-full bg-teal" : i === 3 ? "h-1.5 rounded-full bg-white" : "h-1.5 rounded-full bg-white/15"} />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-white/60">
                <span>Fabric sourcing</span>
                <span>Delivery</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-white/60">Final Year Project · The University of Lahore</p>
        </div>
      </aside>
    </div>
  );
}
