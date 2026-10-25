import { formatDateTime } from "@/lib/format";
import { Timeline } from "./primitives";

/** Audit-style activity feed for a record (newest first, as passed in). */
export function ActivityTimeline({ items }: { items: { id: string; message: string; createdAt: Date; actor: { name: string } | null }[] }) {
  return (
    <Timeline
      items={items.map((a) => ({
        id: a.id,
        title: a.message,
        meta: `${formatDateTime(a.createdAt)}${a.actor ? ` · ${a.actor.name}` : " · System"}`,
        tone: a.actor ? "info" : "neutral",
      }))}
    />
  );
}
