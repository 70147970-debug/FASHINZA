import { FileText, Image as ImageIcon } from "lucide-react";
import type { ProjectAttachment } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatDate } from "@/lib/format";
import { DeleteAttachmentButton } from "./project-buttons";

/** Tech packs grouped with their version history; the newest version is marked current. */
export function AttachmentList({ items, canDelete = false, projectId }: { items: ProjectAttachment[]; canDelete?: boolean; projectId: string }) {
  if (!items.length) return <p className="text-sm text-ink-muted">No files uploaded yet.</p>;
  const techPacks = items.filter((a) => a.kind === "TECH_PACK").sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  const others = items.filter((a) => a.kind !== "TECH_PACK");
  const row = (a: ProjectAttachment, current = false) => (
    <li key={a.id} className="flex items-start gap-3 py-2.5">
      {a.mimeType.startsWith("image/") ? <ImageIcon className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden /> : <FileText className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/files/${a.fileKey}`} target="_blank" rel="noopener" className="truncate text-sm font-medium text-ink underline-offset-4 transition-colors duration-150 hover:text-accent-strong hover:underline">{a.fileName}</a>
          {a.version && <Badge tone={current ? "success" : "neutral"}>v{a.version}{current ? " · current" : ""}</Badge>}
          {a.kind === "SKETCH" && <Badge>Sketch</Badge>}
        </div>
        <p className="text-xs text-ink-muted">{formatBytes(a.size)} · {formatDate(a.createdAt)}{a.notes ? ` · ${a.notes}` : ""}</p>
      </div>
      {canDelete && <DeleteAttachmentButton id={a.id} name={a.fileName} projectId={projectId} />}
    </li>
  );
  return (
    <div className="space-y-4">
      {techPacks.length > 0 && (
        <div>
          <h3 className="label-caps text-ink-muted">Tech pack versions</h3>
          <ul className="mt-1 divide-y divide-line-subtle">{techPacks.map((a, i) => row(a, i === 0))}</ul>
        </div>
      )}
      {others.length > 0 && (
        <div>
          <h3 className="label-caps text-ink-muted">Sketches and other files</h3>
          <ul className="mt-1 divide-y divide-line-subtle">{others.map((a) => row(a))}</ul>
        </div>
      )}
    </div>
  );
}
