import { FileText, Image as ImageIcon } from "lucide-react";
import type { ProjectAttachment } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { ATTACHMENT_KINDS } from "@/lib/constants";
import { formatBytes, formatDate } from "@/lib/format";
import { DeleteAttachmentButton } from "./project-buttons";

/**
 * Project files grouped by kind, in a fixed order: tech pack versions (newest marked current), measurement
 * charts, reference images, design sketches, then anything else. Used on the wizard's files step, the
 * project and opportunity file tabs and the order's Terms & files tab.
 */
export function AttachmentList({ items, canDelete = false, projectId }: { items: ProjectAttachment[]; canDelete?: boolean; projectId: string }) {
  if (!items.length) return <p className="text-sm text-ink-muted">No files uploaded yet.</p>;
  const known = new Set<string>(ATTACHMENT_KINDS.map((k) => k.value));
  const groups = ATTACHMENT_KINDS.map((k) => ({
    ...k,
    files: items
      .filter((a) => (k.value === "OTHER" ? a.kind === "OTHER" || !known.has(a.kind) : a.kind === k.value))
      .sort((a, b) => (b.version ?? 0) - (a.version ?? 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  })).filter((g) => g.files.length > 0);

  const row = (a: ProjectAttachment, current = false) => (
    <li key={a.id} className="flex items-start gap-3 py-2.5">
      {a.mimeType.startsWith("image/") ? <ImageIcon className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden /> : <FileText className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/files/${a.fileKey}`} target="_blank" rel="noopener" className="min-w-0 truncate text-sm font-medium text-ink underline-offset-4 transition-colors duration-150 hover:text-accent-strong hover:underline">{a.fileName}</a>
          {a.version && <Badge tone={current ? "success" : "neutral"}>v{a.version}{current ? " · current" : ""}</Badge>}
        </div>
        <p className="break-words text-xs text-ink-muted">{formatBytes(a.size)} · {formatDate(a.createdAt)}{a.notes ? ` · ${a.notes}` : ""}</p>
      </div>
      {canDelete && <DeleteAttachmentButton id={a.id} name={a.fileName} projectId={projectId} />}
    </li>
  );

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.value}>
          <h3 className="label-caps flex items-baseline gap-1.5 text-ink-muted">
            {g.group}
            <span className="tabular font-normal normal-case tracking-normal">({g.files.length})</span>
          </h3>
          <ul className="mt-1 divide-y divide-line-subtle">{g.files.map((a, i) => row(a, g.value === "TECH_PACK" && i === 0))}</ul>
        </div>
      ))}
    </div>
  );
}
