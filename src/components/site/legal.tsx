import { PageHero } from "./marketing";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * Long-form legal text set like a document: a paper sheet with hanging section numbers, ~68ch prose and
 * terracotta en-dash list markers, beside a sticky ruled table of contents on desktop.
 */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: { heading: string; body: React.ReactNode }[] }) {
  return (
    <>
      <PageHero eyebrow="Legal" title={title} description={intro} />
      <section className="bg-canvas py-12 lg:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-12 lg:gap-10">
          <aside className="hidden lg:col-span-3 lg:block">
            <nav aria-label="On this page" className="sticky top-24">
              <p className="label-caps border-t border-line-strong py-4 text-ink-muted">On this page</p>
              <ol className="border-t border-line text-[13px]">
                {sections.map((s, i) => (
                  <li key={s.heading} className="border-b border-line">
                    <a
                      href={`#${slug(s.heading)}`}
                      className="flex min-h-10 items-baseline gap-3 py-2.5 leading-5 text-ink transition-colors duration-150 hover:text-accent-strong"
                    >
                      <span className="w-5 shrink-0 font-display text-[0.8125rem] italic text-ink-muted tabular">{String(i + 1).padStart(2, "0")}</span>
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>
          <article className="min-w-0 rounded-lg border border-line bg-surface px-5 py-9 sm:px-12 sm:py-14 lg:col-span-9 xl:col-span-8">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line-strong pb-4">
              <p className="font-display text-lg font-medium tracking-[-0.01em] text-ink">{title}</p>
              <p className="label-caps text-ink-muted">Last updated {updated}</p>
            </div>
            <div className="divide-y divide-line">
              {sections.map((s, i) => (
                <section
                  key={s.heading}
                  id={slug(s.heading)}
                  aria-labelledby={`${slug(s.heading)}-title`}
                  className="grid scroll-mt-24 gap-x-6 py-8 sm:grid-cols-[3rem_minmax(0,1fr)] sm:py-10"
                >
                  <span className="font-display text-[1.75rem] font-light leading-none tracking-[-0.02em] text-accent-strong tabular max-sm:mb-3" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 max-w-[68ch]">
                    <h2 id={`${slug(s.heading)}-title`} className="font-display text-[1.375rem] font-medium leading-7 tracking-[-0.015em] text-ink">
                      {s.heading}
                    </h2>
                    <div className="mt-4 space-y-3 text-[0.9375rem] leading-7 text-ink [&_li]:relative [&_li]:pl-6 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.85rem] [&_li]:before:h-px [&_li]:before:w-3 [&_li]:before:bg-accent [&_ul]:space-y-2.5">
                      {s.body}
                    </div>
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
