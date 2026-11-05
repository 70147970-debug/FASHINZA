import Link from "next/link";
import type { TimelineItem, TimelineTone } from "@/components/app/primitives";

/*
 * Presentation helpers for audit-log entries, shared by the admin overview, the audit log and the factory
 * review page. Entries name the record they affected (resolved on the server, see resolveAuditTargets) and
 * link to it; the raw action code stays visible on the audit log itself so it can be searched for.
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

const TARGET_LABEL: Record<string, string> = {
  User: "Account",
  ManufacturerProfile: "Factory",
  ManufacturerDocument: "Factory document",
  IssueReport: "Dispute",
  PaymentMilestone: "Payment milestone",
  ContactInquiry: "Contact enquiry",
};

/** "ManufacturerProfile" → "Factory"; unknown types are split into words ("SomeRecord" → "Some record"). */
export function targetLabel(type: string) {
  if (TARGET_LABEL[type]) return TARGET_LABEL[type];
  const s = type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type AuditTargetView = { name?: string; href?: string };

/** The affected record as a link (its name, or its type when the name is unknown). */
export function AuditTargetLink({ type, target, className }: { type: string; target?: AuditTargetView; className?: string }) {
  const text = target?.name ?? targetLabel(type);
  if (!target?.href) return <span className={className}>{text}</span>;
  return (
    <Link href={target.href} className={className ?? "rounded-sm font-medium text-accent-strong underline-offset-4 hover:underline"}>
      {text}
    </Link>
  );
}

/**
 * Timeline row for an audit entry: "Action · Type: <linked record name>", the reason, then who and when.
 * On a record's own page pass `here`: entries about that record (`selfIds`) leave the target out, and targets
 * that link to the page being viewed (`href`) are shown as plain text.
 */
export function auditTimelineItem(
  a: { id: string; action: string; targetType: string; targetId?: string; reason: string | null; actor: { name: string }; target?: AuditTargetView },
  when: string,
  here?: { selfIds?: string[]; href?: string },
): TimelineItem {
  const self = !!a.targetId && !!here?.selfIds?.includes(a.targetId);
  const target = a.target?.href && a.target.href === here?.href ? { name: a.target.name } : a.target;
  return {
    id: a.id,
    title: (
      <>
        <span className="font-medium text-ink">{auditActionLabel(a.action)}</span>
        {!self && (
          <span className="text-ink-muted">
            {" · "}
            {target?.name ? `${targetLabel(a.targetType)}: ` : null}
            <AuditTargetLink type={a.targetType} target={target} className={target?.href ? undefined : "text-ink"} />
          </span>
        )}
      </>
    ),
    description: a.reason ?? undefined,
    meta: `${a.actor.name} · ${when}`,
    tone: auditTone(a.action),
  };
}
