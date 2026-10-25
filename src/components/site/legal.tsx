import { PageHero } from "./marketing";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Layout for long-form legal text: readable ~70ch prose with a sticky table of contents on desktop. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: { heading: string; body: React.ReactNode }[] }) {
  return (
    <>
      <PageHero eyebrow="Legal" title={title} description={intro} />
      <section className="bg-canvas py-12 lg:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-24">
              <p className="label-caps mb-3 text-muted">On this page</p>
              <ol className="space-y-0.5 border-l border-line text-[13px]">
                {sections.map((s, i) => (
                  <li key={s.heading}>
                    <a
                      href={`#${slug(s.heading)}`}
                      className="-ml-px flex gap-2 border-l-2 border-transparent py-1.5 pl-3 text-muted transition-colors duration-150 hover:border-line-strong hover:text-navy"
                    >
                      <span className="tabular text-subtle">{String(i + 1).padStart(2, "0")}</span>
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>
          <article className="max-w-[70ch] rounded-lg border border-line bg-white px-5 py-8 shadow-card sm:px-10 sm:py-10">
            <p className="label-caps text-muted">Last updated {updated}</p>
            <div className="mt-8 space-y-10">
              {sections.map((s, i) => (
                <section key={s.heading} id={slug(s.heading)} aria-labelledby={`${slug(s.heading)}-title`} className="scroll-mt-24">
                  <h2 id={`${slug(s.heading)}-title`} className="flex items-baseline gap-3 font-display text-lg font-semibold text-navy">
                    <span className="tabular text-sm font-medium text-subtle" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                    {s.heading}
                  </h2>
                  <div className="mt-3 space-y-3 text-[0.9375rem] leading-7 text-ink [&_li]:relative [&_li]:pl-5 [&_li]:before:absolute [&_li]:before:left-1 [&_li]:before:top-[0.7rem] [&_li]:before:size-1.5 [&_li]:before:rounded-full [&_li]:before:bg-teal [&_ul]:space-y-2">
                    {s.body}
                  </div>
                </section>
              ))}
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
