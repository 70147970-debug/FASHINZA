import { formatDateTime } from "@/lib/format";

export function ActivityTimeline({ items }: { items: { id: string; message: string; createdAt: Date; actor: { name: string } | null }[] }) {
  if (!items.length) return <p className="text-sm text-muted">No activity yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {items.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-white bg-slate-blue" aria-hidden />
          <p className="text-sm text-ink">{a.message}</p>
          <p className="text-xs text-muted">{formatDateTime(a.createdAt)}{a.actor ? ` · ${a.actor.name}` : " · System"}</p>
        </li>
      ))}
    </ol>
  );
}
