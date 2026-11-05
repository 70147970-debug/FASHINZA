import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Photo } from "@/components/ui/photo";
import { PhotoCredit } from "@/components/site/marketing";

const POINTS = [
  {
    title: "Factories that fit your garment",
    text: "Matching checks category, MOQ, capacity and certifications, and shows the reasons for every factory.",
  },
  {
    title: "One shared production record",
    text: "Brands and manufacturers see the same quotations, samples, milestones and inspection reports.",
  },
  {
    title: "Manufacturers reviewed by a person",
    text: "An administrator reviews every factory's documents before it is verified.",
  },
];

/**
 * Editorial split: the form on ivory (left), and a photographic panel (lg+) — designers fitting a sample, under a
 * scrim that deepens towards the bottom where the ivory copy sits. Below lg the panel is replaced by a ruled list
 * under the form.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
      <main id="main" className="flex min-w-0 flex-col">
        <div className="flex h-16 items-center justify-between gap-2 border-b border-line px-4 sm:px-8 lg:border-b-0 lg:px-12">
          <Logo />
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              <ArrowLeft className="size-4" aria-hidden />
              <span className="max-[359px]:hidden">Back to website</span>
              <span className="min-[360px]:hidden">Website</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-start px-4 pb-12 pt-10 sm:justify-center sm:px-8 sm:pt-10">
          <div className="w-full max-w-[27rem]">{children}</div>
          <ol className="mt-12 w-full max-w-[27rem] border-t border-line-strong lg:hidden" aria-label="Why Fashinza">
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
      <aside className="hidden bg-inverse text-ink-inverse lg:block" aria-label="Why Fashinza">
        <div className="sticky top-0 isolate h-dvh max-h-[62rem] overflow-hidden">
          <Photo photo="designersSampleFitting" sizes="46vw" fill rounded="none" position="55% center" decorative />
          {/* ≥74% scrim across the lower 64% of the panel, where the copy sits; muted text stays in the ≥85% band. */}
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-scrim/95 via-scrim/85 via-55% to-scrim/30" />
          <PhotoCredit photo="designersSampleFitting" decorative />
          <div className="relative flex h-full flex-col justify-end px-12 py-10 xl:px-16 xl:py-12">
            <div className="max-w-[30rem]">
              <p className="eyebrow flex items-center gap-3 text-ink-inverse">
                <span className="h-px w-8 bg-taupe" aria-hidden />
                Garment manufacturing, managed
              </p>
              <h2 className="mt-6 text-balance font-display text-[2.375rem] font-medium leading-[1.08] tracking-[-0.025em] text-ink-inverse xl:text-[2.75rem]">
                Brief, sample, produce and inspect,{" "}
                <em className="font-normal italic">in one shared record.</em>
              </h2>
              <ol className="mt-9 border-t border-ink-inverse/20">
                {POINTS.map((p, i) => (
                  <li key={p.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 border-b border-ink-inverse/20 py-4">
                    <span className="font-display text-[1.5rem] font-normal leading-none tracking-[-0.02em] text-accent-inverse tabular" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="font-display text-[1.0625rem] font-medium tracking-[-0.01em] text-ink-inverse">{p.title}</p>
                      <p className="mt-1 text-sm leading-6 text-ink-inverse-muted">{p.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-xs text-ink-inverse-muted">Final Year Project · The University of Lahore</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
