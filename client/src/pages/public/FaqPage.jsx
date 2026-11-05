import { Link } from "react-router";
import { MessageSquare } from "lucide-react";
import { CtaBand, PageHero } from "@/components/site/marketing";
import { FAQ } from "@fashinza/shared/faq.js";
import { FaqList } from "@/components/site/faq-list";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/meta";

export default function FaqPage() {
  const groups = ["Brands", "Manufacturers", "Platform"];
  const title = (g) => `For ${g === "Platform" ? "everyone" : g.toLowerCase()}`;
  return (
    <>
      <PageMeta
        title="FAQ"
        description="Answers to common questions from fashion brands and garment manufacturers about sourcing, quotations, sampling, quality inspection and payments on Fashinza."
      />
      <PageHero
        eyebrow="FAQ"
        title="Frequently asked questions"
        description="How factory sourcing, quotations, sample development, production tracking, quality inspection and payments work on Fashinza."
      />
      <section className="bg-canvas py-12 lg:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-12 lg:gap-10">
          <aside className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-24 space-y-8">
              <nav aria-label="FAQ sections">
                <p className="label-caps border-t border-line-strong py-4 text-ink-muted">Sections</p>
                <ul className="border-t border-line text-sm">
                  {groups.map((g) => (
                    <li key={g}>
                      <a
                        href={`#faq-${g}`}
                        className="flex min-h-11 items-center justify-between gap-2 border-b border-line text-ink transition-colors duration-150 hover:text-accent-strong"
                      >
                        {title(g)}
                        <span className="tabular font-display italic text-ink-muted">{FAQ.filter((f) => f.group === g).length}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </aside>
          <div className="min-w-0 space-y-14 lg:col-span-8 lg:col-start-5">
            {groups.map((g) => (
              <section key={g} aria-labelledby={`faq-${g}`} className="scroll-mt-24">
                <h2 id={`faq-${g}`} className="mb-5 flex scroll-mt-24 items-baseline gap-3 font-display text-[1.75rem] font-medium tracking-[-0.02em] text-ink">
                  <span className="font-display text-base italic text-accent-strong tabular" aria-hidden>
                    {String(groups.indexOf(g) + 1).padStart(2, "0")}
                  </span>
                  {title(g)}
                </h2>
                <FaqList items={FAQ.filter((f) => f.group === g)} />
              </section>
            ))}
            <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex gap-3.5">
                <MessageSquare className="mt-1 size-5 shrink-0 text-accent" strokeWidth={1.5} aria-hidden />
                <div>
                  <p className="font-display text-lg font-medium text-ink">Still have a question?</p>
                  <p className="text-sm text-ink-muted">Ask about briefing a garment, listing your factory or verification. The team replies by email.</p>
                </div>
              </div>
              <Button asChild variant="outline">
                <Link to="/contact">Contact the Fashinza team</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  );
}
