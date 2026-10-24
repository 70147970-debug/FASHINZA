"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { UPLOAD_LIMITS } from "@/lib/constants";
import { formatBytes } from "@/lib/format";

type Upload = { name: string; size: number; progress: number; error?: string };

/**
 * Uploads project files through /api/projects/[id]/attachments with XMLHttpRequest so that real
 * byte-level progress can be shown. Type and size are checked here for fast feedback and again
 * on the server (including the file signature) before anything is stored.
 */
export function FileUploader({ projectId, defaultKind = "TECH_PACK" }: { projectId: string; defaultKind?: "TECH_PACK" | "SKETCH" | "OTHER" }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState(defaultKind);
  const [notes, setNotes] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const busy = uploads.some((u) => u.progress < 100 && !u.error);
  const accept = kind === "SKETCH" ? UPLOAD_LIMITS.allowedMime.filter((m) => m.startsWith("image/")) : UPLOAD_LIMITS.allowedMime;

  const update = (i: number, patch: Partial<Upload>) => setUploads((u) => u.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function send(file: File, index: number) {
    return new Promise<void>((resolve) => {
      if (!accept.includes(file.type)) {
        update(index, { error: kind === "SKETCH" ? "Sketches must be PNG, JPEG or WebP images." : "Use a PDF, PNG, JPEG or WebP file." });
        return resolve();
      }
      if (file.size > UPLOAD_LIMITS.maxBytes) {
        update(index, { error: `Larger than ${UPLOAD_LIMITS.maxBytes / 1024 / 1024} MB.` });
        return resolve();
      }
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      if (notes.trim()) body.append("notes", notes.trim());
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/projects/${projectId}/attachments`);
      xhr.upload.onprogress = (e) => e.lengthComputable && update(index, { progress: Math.min(99, Math.round((e.loaded / e.total) * 100)) });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          update(index, { progress: 100 });
          const res = JSON.parse(xhr.responseText) as { version: number | null; fileName: string };
          toast.success(res.version ? `Tech pack version ${res.version} uploaded.` : `${res.fileName} uploaded.`);
        } else {
          let msg = "Upload failed.";
          try { msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg; } catch { /* keep default */ }
          update(index, { error: msg });
        }
        resolve();
      };
      xhr.onerror = () => {
        update(index, { error: "Network error. Check your connection and try again." });
        resolve();
      };
      xhr.send(body);
    });
  }

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list).slice(0, 10);
    const start = uploads.length;
    setUploads((u) => [...u, ...files.map((f) => ({ name: f.name, size: f.size, progress: 0 }))]);
    for (let i = 0; i < files.length; i++) await send(files[i], start + i);
    if (input.current) input.current.value = "";
    setNotes("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <div>
          <label htmlFor="upload-kind" className="mb-1.5 block text-sm font-medium text-ink">File type</label>
          <Select id="upload-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} disabled={busy}>
            <option value="TECH_PACK">Tech pack (versioned)</option>
            <option value="SKETCH">Design sketch</option>
            <option value="OTHER">Other document</option>
          </Select>
        </div>
        <div>
          <label htmlFor="upload-notes" className="mb-1.5 block text-sm font-medium text-ink">Version note <span className="font-normal text-muted">(optional)</span></label>
          <input
            id="upload-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            placeholder={kind === "TECH_PACK" ? "What changed in this version?" : "Short description"}
            disabled={busy}
            className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
        </div>
      </div>
      <label
        className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line bg-canvas px-4 py-8 text-center hover:border-teal/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) void onFiles(e.dataTransfer.files);
        }}
      >
        <UploadCloud className="size-7 text-teal" aria-hidden />
        <span className="text-sm font-medium text-navy">Drop files here or choose files</span>
        <span className="text-xs text-muted">{kind === "SKETCH" ? "PNG, JPEG or WebP" : "PDF, PNG, JPEG or WebP"} · up to {UPLOAD_LIMITS.maxBytes / 1024 / 1024} MB each · stored privately</span>
        <input ref={input} type="file" multiple accept={accept.join(",")} className="sr-only" disabled={busy} onChange={(e) => void onFiles(e.target.files)} />
      </label>
      {uploads.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {uploads.map((u, i) => (
            <li key={`${u.name}-${i}`} className="rounded-md border border-line bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{u.name} <span className="text-xs text-muted">· {formatBytes(u.size)}</span></span>
                {u.error ? (
                  <Button variant="ghost" size="sm" onClick={() => setUploads((x) => x.filter((_, j) => j !== i))} aria-label={`Dismiss ${u.name}`}><X /></Button>
                ) : (
                  <span className="tabular text-xs text-muted">{u.progress === 100 ? "Uploaded" : `${u.progress}%`}</span>
                )}
              </div>
              {u.error ? (
                <p className="mt-1 text-xs text-danger" role="alert">{u.error}</p>
              ) : (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-50" role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${u.name}`}>
                  <div className="h-full rounded-full bg-teal transition-[width]" style={{ width: `${u.progress}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
