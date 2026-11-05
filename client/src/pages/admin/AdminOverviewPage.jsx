import { Fragment } from "react";
import { Link, useLoaderData } from "react-router";
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, ChevronRight, CircleDollarSign, PackageSearch, ScanSearch, ShieldAlert, Users, Webhook } from "lucide-react";
import { DescriptionList, Metric, MetricStrip, PageHeader, Panel, Timeline } from "@/components/app/primitives";
import { auditTimelineItem } from "@/components/admin/audit-parts";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/meta";
import { loadData } from "@/lib/data";
import { ORDER_STATUS, PROJECT_STATUS } from "@fashinza/shared/labels.js";
import { formatDateTime, formatMoney, formatNumber } from "@fashinza/shared/format.js";
import { cn } from "@fashinza/shared/utils.js";

/** /admin — port of src/app/(app)/admin/page.tsx (gate: user ADMIN). */

export async function loader({ request }) {
  return { d: await loadData("/api/admin/overview", { request }) };
}

/** Horizontal bar breakdown of records by status (counts straight from the database). */
function Breakdown({ rows, map }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (!total) return <p className="text-sm text-ink-muted">No records yet.</p>;
  return (
    <ul className="space-y-3">
      {[...rows]
        .sort((a, b) => b.count - a.count)
        .map((r) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate text-ink">{map[r.key]?.label ?? r.key}</span>
              <span className="tabular shrink-0 text-ink-muted">
                <span className="font-medium text-ink">{formatNumber(r.count)}</span> · {Math.round((r.count / total) * 100)}%
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-xs bg-line" aria-hidden>
              <div className="h-full rounded-xs bg-ink" style={{ width: `${Math.max((r.count / total) * 100, 2)}%` }} />
            </div>
          </li>
        ))}
    </ul>
  );
}

/** One work queue with work waiting: label, what it means, how many. Clear queues are listed on one line instead. */
function QueueRow({ href, icon: Icon, label, description, count, tone }) {
  return (
    <li>
      <Link to={href} className="group flex items-center gap-4 px-4 py-4 transition-colors duration-150 hover:bg-surface-hover sm:px-5">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-md border",
            tone === "danger" ? "border-danger-line bg-danger-soft text-danger-strong" : "border-warning-line bg-warning-soft text-warning-strong",
          )}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">{label}</span>
          <span className="block text-xs leading-5 text-ink-muted">{description}</span>
        </span>
        <span
          className={cn(
            "tabular shrink-0 font-sans text-2xl font-medium leading-none tracking-[-0.02em]",
            tone === "danger" ? "text-danger-strong" : "text-warning-strong",
          )}
        >
          {formatNumber(count)}
          <span className="sr-only"> waiting</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink-subtle transition-colors duration-150 group-hover:text-ink-muted" aria-hidden />
      </Link>
    </li>
  );
}

export default function AdminOverviewPage() {
  const { d } = useLoaderData();
  const users = Object.fromEntries(d.usersByRole.map((u) => [u.role, u._count]));
  const activeOrders = d.ordersByStatus.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status)).reduce((s, o) => s + o._count, 0);
  const delivered = d.ordersByStatus.find((o) => o.status === "DELIVERED")?._count ?? 0;
  const accounts = (users.BRAND ?? 0) + (users.MANUFACTURER ?? 0);
  const [firstPaid, ...otherPaid] = d.paidByCurrency;

  const queues = [
    {
      key: "factories",
      href: "/admin/factories?status=PENDING",
      icon: BadgeCheck,
      label: "Factories awaiting verification",
      short: "Factory verification",
      description: "Check documents, then approve or reject.",
      count: d.pendingFactories,
      tone: "warning",
    },
    {
      key: "delayed",
      href: "/admin/orders?delayed=1",
      icon: AlertTriangle,
      label: "Delayed orders",
      short: "Delayed orders",
      description: "A stage or the agreed date has passed.",
      count: d.delayedOrders,
      tone: "danger",
    },
    {
      key: "disputes",
      href: "/admin/disputes",
      icon: ShieldAlert,
      label: "Open disputes",
      short: "Open disputes",
      description: "Open or in review; record a resolution.",
      count: d.openDisputes,
      tone: "warning",
    },
    {
      key: "qc",
      href: "/admin/qc#failed",
      icon: ScanSearch,
      label: "Failed inspections (30 days)",
      short: "Failed inspections",
      description: "Inspections with more defects than the sampling limit allows.",
      count: d.failedQc30,
      tone: "warning",
    },
    {
      key: "webhooks",
      href: "/admin/payments?events=errors",
      icon: Webhook,
      label: "Unprocessed webhook errors",
      short: "Webhook errors",
      description: "Provider events that could not be applied.",
      count: d.webhookErrors,
      tone: "danger",
    },
  ];
  const open = queues.filter((q) => q.count > 0);
  const clear = queues.filter((q) => q.count === 0);
  const waiting = open.length;

  return (
    <>
      <PageMeta title="Admin overview" />
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
          hint={otherPaid.length ? `+ ${otherPaid.map((p) => formatMoney(p._sum.amount ?? 0, p.currency)).join(" · ")}` : "Test payments, no real money."}
        />
      </MetricStrip>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Needs attention" description={waiting ? `${waiting} of ${queues.length} queues have work waiting.` : "Every queue is clear."} bodyClassName="p-0 sm:p-0">
            {open.length > 0 && (
              <ul className="divide-y divide-line-subtle">
                {open.map((q) => (
                  <QueueRow key={q.key} href={q.href} icon={q.icon} label={q.label} description={q.description} count={q.count} tone={q.tone} />
                ))}
              </ul>
            )}
            {clear.length > 0 && (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-x-1.5 gap-y-1 px-4 py-2.5 text-xs text-ink-muted sm:px-5",
                  open.length > 0 && "border-t border-line-subtle",
                )}
              >
                <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden />
                <span className="font-medium text-ink">{open.length ? "Clear:" : "All clear:"}</span>
                {clear.map((q, i) => (
                  <Fragment key={q.key}>
                    {i > 0 && <span aria-hidden>·</span>}
                    <Link to={q.href} className="inline-flex min-h-8 items-center rounded-sm underline-offset-4 hover:text-ink hover:underline max-sm:min-h-10">
                      {q.short}
                    </Link>
                  </Fragment>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Recent administrative actions"
            actions={
              <Button asChild variant="link" size="sm">
                <Link to="/admin/audit">
                  Audit log <ArrowRight />
                </Link>
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
                <Link to="/admin/users">
                  Manage users <ArrowRight />
                </Link>
              </Button>
            }
          >
            <DescriptionList
              layout="rows"
              items={[
                { label: "Administrators", value: <span className="tabular">{formatNumber(users.ADMIN ?? 0)}</span> },
                {
                  label: "Suspended accounts",
                  value: (
                    <Link
                      to="/admin/users?status=SUSPENDED"
                      className={cn("tabular rounded-sm hover:underline hover:underline-offset-4", d.suspended ? "text-danger-strong" : "text-ink-muted")}
                    >
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
