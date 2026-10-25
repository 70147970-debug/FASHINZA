import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, ChevronRight, CircleDollarSign, PackageSearch, ScanSearch, ShieldAlert, Users, Webhook } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { adminDashboard } from "@/server/services/dashboard";
import { DescriptionList, Metric, MetricStrip, PageHeader, Panel, Timeline } from "@/components/app/primitives";
import { auditTimelineItem } from "@/components/admin/audit-parts";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS, PROJECT_STATUS } from "@/lib/labels";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin overview" };

type QueueTone = "warning" | "danger";

/** Horizontal bar breakdown of records by status (counts straight from the database). */
function Breakdown({ rows, map }: { rows: { key: string; count: number }[]; map: Record<string, { label: string }> }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (!total) return <p className="text-sm text-muted">No records yet.</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {[...rows].sort((a, b) => b.count - a.count).map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-ink">{map[r.key]?.label ?? r.key}</span>
            <span className="tabular shrink-0 text-muted">
              <span className="font-medium text-ink">{formatNumber(r.count)}</span> · {Math.round((r.count / total) * 100)}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
            <div className="h-full rounded-full bg-slate-blue" style={{ width: `${Math.max((r.count / max) * 100, 2)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One work queue: label, what it means, how many are waiting. Zero reads as "Clear". */
function QueueRow({ href, icon: Icon, label, description, count, tone }: { href: string; icon: LucideIcon; label: string; description: string; count: number; tone: QueueTone }) {
  const open = count > 0;
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-muted sm:px-5">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-md",
            !open ? "bg-surface-muted text-neutral-500" : tone === "danger" ? "bg-danger-50 text-danger-700" : "bg-warning-50 text-warning-700",
          )}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">{label}</span>
          <span className="block text-xs leading-5 text-muted">{description}</span>
        </span>
        {open ? (
          <span className={cn("tabular shrink-0 font-display text-lg font-semibold", tone === "danger" ? "text-danger-700" : "text-warning-700")}>
            {formatNumber(count)}
            <span className="sr-only"> waiting</span>
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted">
            <CheckCircle2 className="size-3.5 text-success" aria-hidden />
            <span className="max-sm:sr-only">Clear</span>
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-subtle transition-colors duration-150 group-hover:text-neutral-600" aria-hidden />
      </Link>
    </li>
  );
}

export default async function AdminOverviewPage() {
  const actor = await requireUser(["ADMIN"]);
  const d = await adminDashboard(actor);
  const users = Object.fromEntries(d.usersByRole.map((u) => [u.role, u._count]));
  const activeOrders = d.ordersByStatus.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status)).reduce((s, o) => s + o._count, 0);
  const delivered = d.ordersByStatus.find((o) => o.status === "DELIVERED")?._count ?? 0;
  const accounts = (users.BRAND ?? 0) + (users.MANUFACTURER ?? 0);
  const [firstPaid, ...otherPaid] = d.paidByCurrency;

  const queues = [
    { key: "factories", href: "/admin/factories?status=PENDING", icon: BadgeCheck, label: "Factories awaiting verification", description: "Check documents, then approve or reject.", count: d.pendingFactories, tone: "warning" as const },
    { key: "delayed", href: "/admin/orders?delayed=1", icon: AlertTriangle, label: "Delayed orders", description: "A stage or the agreed date has passed.", count: d.delayedOrders, tone: "danger" as const },
    { key: "disputes", href: "/admin/disputes", icon: ShieldAlert, label: "Open disputes", description: "Open or in review; record a resolution.", count: d.openDisputes, tone: "warning" as const },
    { key: "qc", href: "/admin/qc", icon: ScanSearch, label: "Failed inspections (30 days)", description: "Inspections that exceeded the AQL limits.", count: d.failedQc30, tone: "warning" as const },
    { key: "webhooks", href: "/admin/payments", icon: Webhook, label: "Unprocessed webhook errors", description: "Provider events that could not be applied.", count: d.webhookErrors, tone: "danger" as const },
  ].sort((a, b) => Number(b.count > 0) - Number(a.count > 0));
  const waiting = queues.filter((q) => q.count > 0).length;

  return (
    <>
      <PageHeader eyebrow="Administration" title="Platform overview" description="Live figures counted from the database." />

      <MetricStrip label="Platform metrics" columns={4}>
        <Metric label="Active orders" value={activeOrders} href="/admin/orders?status=ACTIVE" icon={PackageSearch} hint={`${formatNumber(delivered)} delivered`} />
        <Metric
          label="Verified factories"
          value={d.verifiedFactories}
          href="/admin/factories?status=VERIFIED"
          icon={BadgeCheck}
          hint={d.pendingFactories ? `${d.pendingFactories} awaiting review` : "None awaiting review"}
        />
        <Metric label="Users" value={accounts} href="/admin/users" icon={Users} hint={`${users.BRAND ?? 0} brands · ${users.MANUFACTURER ?? 0} factories`} />
        <Metric
          label="Payments received"
          value={firstPaid ? formatMoney(firstPaid._sum.amount ?? 0, firstPaid.currency) : 0}
          href="/admin/payments"
          icon={CircleDollarSign}
          hint={otherPaid.length ? `+ ${otherPaid.map((p) => formatMoney(p._sum.amount ?? 0, p.currency)).join(" · ")}` : "Sandbox provider — no real funds."}
        />
      </MetricStrip>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel
            title="Needs attention"
            description={waiting ? `${waiting} of ${queues.length} queues have work waiting.` : "Every queue is clear."}
            bodyClassName="p-0 sm:p-0"
          >
            <ul className="divide-y divide-line-subtle">
              {queues.map(({ key, ...q }) => (
                <QueueRow key={key} {...q} />
              ))}
            </ul>
          </Panel>

          <Panel
            title="Recent administrative actions"
            actions={
              <Button asChild variant="link" size="sm">
                <Link href="/admin/audit">Audit log <ArrowRight /></Link>
              </Button>
            }
          >
            <Timeline items={d.recentAudit.map((a) => auditTimelineItem(a, formatDateTime(a.createdAt)))} empty="No administrative actions recorded yet." />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Orders by status">
            <Breakdown rows={d.ordersByStatus.map((o) => ({ key: o.status, count: o._count }))} map={ORDER_STATUS} />
          </Panel>
          <Panel title="Projects by status">
            <Breakdown rows={d.projectsByStatus.map((p) => ({ key: p.status, count: p._count }))} map={PROJECT_STATUS} />
          </Panel>
          <Panel
            title="Accounts"
            actions={
              <Button asChild variant="link" size="sm">
                <Link href="/admin/users">Manage users <ArrowRight /></Link>
              </Button>
            }
          >
            <DescriptionList
              layout="rows"
              items={[
                { label: "Brands", value: <span className="tabular">{formatNumber(users.BRAND ?? 0)}</span> },
                { label: "Factories", value: <span className="tabular">{formatNumber(users.MANUFACTURER ?? 0)}</span> },
                { label: "Administrators", value: <span className="tabular">{formatNumber(users.ADMIN ?? 0)}</span> },
                {
                  label: "Suspended accounts",
                  value: (
                    <Link href="/admin/users?status=SUSPENDED" className={cn("tabular rounded-sm hover:underline hover:underline-offset-4", d.suspended ? "text-danger-700" : "text-muted")}>
                      {formatNumber(d.suspended)}
                    </Link>
                  ),
                },
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
