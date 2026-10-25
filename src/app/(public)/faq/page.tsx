import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { CtaBand, PageHero } from "@/components/site/marketing";
import { FAQ } from "@/lib/faq";
import { FaqList } from "@/components/site/faq-list";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "FAQ", description: "Answers to common questions from brands and manufacturers using Fashinza." };

export default function FaqPage() {
  const groups = ["Brands", "Manufacturers", "Platform"] as const;
  const title = (g: (typeof groups)[number]) => `For ${g === "Platform" ? "everyone" : g.toLowerCase()}`;
  return (
    <>
      <PageHero eyebrow="FAQ" title="Frequently asked questions" description="How matching, quotations, production tracking, quality control and payments work on Fashinza." />
      <section className="bg-canvas py-12 lg:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-8">
              <nav aria-label="FAQ sections">
                <p className="label-caps mb-3 text-muted">Sections</p>
                <ul className="space-y-0.5 border-l border-line text-[13px]">
                  {groups.map((g) => (
                    <li key={g}>
                      <a href={`#faq-${g}`} className="-ml-px flex justify-between gap-2 border-l-2 border-transparent py-1.5 pl-3 text-muted transition-colors duration-150 hover:border-line-strong hover:text-navy">
                        {title(g)}
                        <span className="tabular text-subtle">{FAQ.filter((f) => f.group === g).length}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </aside>
          <div className="max-w-3xl space-y-12">
            {groups.map((g) => (
              <section key={g} aria-labelledby={`faq-${g}`} className="scroll-mt-24">
                <h2 id={`faq-${g}`} className="mb-4 scroll-mt-24 font-display text-xl font-semibold text-navy">{title(g)}</h2>
                <FaqList items={FAQ.filter((f) => f.group === g)} />
              </section>
            ))}
            <div className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-700"><MessageSquare className="size-[18px]" aria-hidden /></span>
                <div>
                  <p className="font-display text-base font-semibold text-navy">Still have a question?</p>
                  <p className="text-sm text-muted">The team replies by email.</p>
                </div>
              </div>
              <Button asChild variant="outline"><Link href="/contact">Contact the Fashinza team</Link></Button>
            </div>
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  );
}
