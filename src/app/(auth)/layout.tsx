import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const POINTS = [
  {
    title: "Matching you can read",
    text: "Every factory match shows the rules behind its score, and why others were excluded.",
  },
  {
    title: "One shared status",
    text: "Brands and manufacturers see the same quotations, milestones and quality reports.",
  },
  {
    title: "Manufacturers reviewed by a person",
    text: "Verification is a manual review of documents by a Fashinza administrator.",
  },
];

const STAGES = ["Fabric", "Sampling", "Cutting", "Stitching", "Finishing", "QC", "Shipping", "Delivery"];

/**
 * Editorial split: the form on ivory (left), and a contrasting value panel (ink in light, raised warm-dark in
 * dark mode) with the same three factual points. Below lg the panel is replaced by a ruled list under the form.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
      <main id="main" className="flex min-w-0 flex-col">
        <div className="flex h-16 items-center justify-between gap-3 border-b border-line px-4 sm:px-8 lg:border-b-0 lg:px-12">
          <Logo />
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to website
            </Link>
            <ThemeToggle className="lg:hidden" />
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-start px-4 pb-12 pt-10 sm:justify-center sm:px-8 sm:pt-10">
          <div className="w-full max-w-[27rem]">{children}</div>
          <ol className="mt-12 w-full max-w-[27rem] border-t border-line-strong lg:hidden" aria-label="About Fashinza">
            {POINTS.map((p, i) => (
              <li key={p.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b border-line py-4 text-[13px] leading-5">
                <span className="font-display text-base italic leading-5 text-accent-strong tabular" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-ink-muted">
                  <span className="font-medium text-ink">{p.title}.</span> {p.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="px-4 pb-4 text-center text-xs text-ink-muted sm:px-8">
          <Link href="/privacy" className="inline-flex min-h-10 items-center underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline">Privacy Policy</Link>
          <span aria-hidden> · </span>
          <Link href="/terms" className="inline-flex min-h-10 items-center underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline">Terms of Service</Link>
        </p>
      </main>
      <aside className="hidden bg-inverse text-ink-inverse lg:block" aria-label="About Fashinza">
        <div className="sticky top-0 flex h-dvh max-h-[62rem] flex-col justify-between overflow-hidden px-12 py-10 xl:px-16 xl:py-12">
          <div className="flex items-center justify-between gap-4 border-b border-ink-inverse/15 pb-5">
            <p className="eyebrow text-ink-inverse-muted">Apparel manufacturing, managed</p>
            <ThemeToggle className="text-ink-inverse-muted hover:bg-ink-inverse/10 hover:text-ink-inverse" />
          </div>
          <div className="max-w-[30rem] py-10">
            <h2 className="text-balance font-display text-[2.5rem] font-[420] leading-[1.06] tracking-[-0.03em] text-ink-inverse xl:text-[2.875rem]">
              Brief, quote, produce and inspect —{" "}
              <em className="font-display font-[380] italic text-ink-inverse-muted">in one workflow.</em>
            </h2>
            <ol className="mt-10 border-t border-ink-inverse/15">
              {POINTS.map((p, i) => (
                <li key={p.title} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 border-b border-ink-inverse/15 py-5">
                  <span className="font-display text-[1.75rem] font-light leading-none tracking-[-0.02em] text-accent tabular" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="font-display text-lg font-medium tracking-[-0.01em] text-ink-inverse">{p.title}</p>
                    <p className="mt-1 text-sm leading-6 text-ink-inverse-muted">{p.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-10" aria-hidden>
              <div className="flex items-baseline justify-between text-xs text-ink-inverse-muted">
                <span className="label-caps">Order stages · example</span>
                <span className="tabular">4 of 8</span>
              </div>
              <div className="mt-3 grid grid-cols-8 gap-1">
                {STAGES.map((s, i) => (
                  <span
                    key={s}
                    className={i < 3 ? "h-1 rounded-xs bg-ink-inverse" : i === 3 ? "h-1 rounded-xs bg-accent" : "h-1 rounded-xs bg-ink-inverse/20"}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-ink-inverse-muted">
                <span>Fabric sourcing</span>
                <span>Delivery</span>
              </div>
            </div>
          </div>
          <p className="border-t border-ink-inverse/15 pt-5 text-xs text-ink-inverse-muted">Final Year Project · The University of Lahore</p>
        </div>
      </aside>
    </div>
  );
}
