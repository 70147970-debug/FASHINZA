import type { TimelineItem, TimelineTone } from "@/components/app/primitives";

/*
 * Presentation helpers for audit-log entries, shared by the admin overview, the audit log and the factory
 * review page. The raw action code (e.g. DISPUTE_UPDATED) stays visible on the audit log itself.
 */

/** "FACTORY_VERIFICATION_REVOKED" → "Factory verification revoked". */
export function auditActionLabel(action: string) {
  const s = action.replaceAll("_", " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Tone by what the action did: approvals green, removals red, money amber, everything else informational. */
export function auditTone(action: string): Exclude<TimelineTone, "accent"> {
  if (/REVOKED|REJECTED|SUSPENDED|DELETED|CANCELLED/.test(action)) return "danger";
  if (/REFUND|PAYMENT/.test(action)) return "warning";
  if (/VERIFIED|APPROVED|REACTIVATED|RESOLVED|ACTIVATED/.test(action)) return "success";
  if (/CHANGED|UPDATED/.test(action)) return "info";
  return "neutral";
}

/** "ManufacturerProfile" → "Manufacturer profile". */
export function targetLabel(type: string) {
  const s = type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function auditTimelineItem(a: { id: string; action: string; targetType: string; reason: string | null; actor: { name: string } }, when: string): TimelineItem {
  return {
    id: a.id,
    title: (
      <>
        <span className="font-medium text-navy">{auditActionLabel(a.action)}</span>
        <span className="text-muted"> · {targetLabel(a.targetType)}</span>
      </>
    ),
    description: a.reason ?? undefined,
    meta: `${a.actor.name} · ${when}`,
    tone: auditTone(a.action),
  };
}
