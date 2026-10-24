import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, PageHero, Section } from "@/components/site/marketing";
import { FAQ } from "@/lib/faq";
import { FaqList } from "@/components/site/faq-list";

export const metadata: Metadata = { title: "FAQ", description: "Answers to common questions from brands and manufacturers using Fashinza." };

export default function FaqPage() {
  const groups = ["Brands", "Manufacturers", "Platform"] as const;
  return (
    <>
      <PageHero eyebrow="FAQ" title="Frequently asked questions" description="How matching, quotations, production tracking, quality control and payments work on Fashinza." />
      <Section>
        <div className="mx-auto max-w-3xl space-y-10">
          {groups.map((g) => (
            <section key={g} aria-labelledby={`faq-${g}`}>
              <h2 id={`faq-${g}`} className="mb-4 text-xl font-semibold">For {g === "Platform" ? "everyone" : g.toLowerCase()}</h2>
              <FaqList items={FAQ.filter((f) => f.group === g)} />
            </section>
          ))}
          <p className="text-sm text-muted">Still have a question? <Link href="/contact" className="font-medium text-teal-700 hover:underline">Contact the Fashinza team</Link>.</p>
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
