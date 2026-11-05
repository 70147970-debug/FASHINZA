/**
 * Page metadata, replacing Next's `export const metadata` (src/app/layout.tsx and each page). Rendered with
 * React 19's <title>/<meta> elements, which React places in <head>.
 *
 *   <PageMeta title="Orders" />                      → "Orders | Fashinza"
 *   <PageMeta title="Login" description="Sign in…" />
 *   <PageMeta title="Sandbox checkout" noindex />    → <meta name="robots" content="noindex">
 *   <PageMeta />                                     → the site default (home page)
 *
 * The title template and defaults are the root layout's: `%s | Fashinza`, default title
 * "Fashinza — Garment manufacturing for fashion brands", default description below.
 */
export const DEFAULT_TITLE = "Fashinza — Garment manufacturing for fashion brands";
export const DEFAULT_DESCRIPTION =
  "Fashinza connects fashion brands, clothing startups and designers with garment manufacturers: share tech packs, develop samples, compare quotations, and follow apparel production and quality inspection in one place.";

/** "%s | Fashinza" (the root layout's title template). */
export function pageTitle(title) {
  return title ? `${title} | Fashinza` : DEFAULT_TITLE;
}

/** @param {{ title?: string, description?: string, noindex?: boolean }} props */
export function PageMeta({ title, description, noindex = false }) {
  return (
    <>
      <title>{pageTitle(title)}</title>
      <meta name="description" content={description ?? DEFAULT_DESCRIPTION} />
      {noindex && <meta name="robots" content="noindex" />}
    </>
  );
}
