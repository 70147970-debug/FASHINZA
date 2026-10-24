import { PageHero, Section } from "./marketing";

/** Layout for long-form legal text with readable line length. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: { heading: string; body: React.ReactNode }[] }) {
  return (
    <>
      <PageHero eyebrow="Legal" title={title} description={intro} />
      <Section>
        <article className="mx-auto max-w-3xl space-y-8 text-sm leading-relaxed text-ink">
          <p className="text-xs text-muted">Last updated {updated}</p>
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="mb-2 text-lg font-semibold">{s.heading}</h2>
              <div className="space-y-2 text-muted [&_li]:ml-5 [&_li]:list-disc">{s.body}</div>
            </section>
          ))}
        </article>
      </Section>
    </>
  );
}
