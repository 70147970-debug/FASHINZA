import { PageMeta } from "@/components/meta";

/**
 * Temporary body for a page that has not been ported yet. Each page file in src/pages renders this until its
 * port lands; the router, gates and layouts around it are final. Not part of the original design.
 */
export function Placeholder({ title, description, noindex, path, source }) {
  return (
    <>
      <PageMeta title={title} description={description} noindex={noindex} />
      <div className="mx-auto my-10 max-w-xl rounded-lg border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
        <p className="label-caps text-ink-muted">Not ported yet</p>
        <h1 className="mt-2 font-display text-2xl font-medium text-ink">{title ?? "Home"}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          <code className="font-mono text-xs">{path}</code> · port of <code className="font-mono text-xs">{source}</code>
        </p>
      </div>
    </>
  );
}
