import { fieldLabel, formatRevisionValue } from "@fashinza/shared/labels.js";

/** The fields that changed in one ProjectRevision, as "Label: old → new" lines. Server component. */
export function RevisionChanges({ changes, currency, className }) {
  const entries = Object.entries(changes ?? {});
  if (!entries.length) return null;
  return (
    <ul className={className ?? "space-y-0.5"}>
      {entries.map(([field, c]) => (
        <li key={field} className="break-words">
          <span className="font-medium text-ink">{fieldLabel(field)}</span>:{" "}
          <span className="text-ink-muted line-through">{formatRevisionValue(field, c?.from, currency)}</span>
          <span aria-hidden> → </span>
          <span className="sr-only"> changed to </span>
          <span className="text-ink">{c?.to === null || c?.to === undefined || c?.to === "" ? "removed" : formatRevisionValue(field, c.to, currency)}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Quantity, Target price changed" for a revision's title. */
export function revisionTitle(changes) {
  return `${Object.keys(changes ?? {})
    .map(fieldLabel)
    .join(", ")} changed`;
}
