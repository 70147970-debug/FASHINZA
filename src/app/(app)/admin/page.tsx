import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, Ban, CircleDollarSign, PackageSearch, ScanSearch, ShieldAlert, Users, Webhook } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { adminDashboard } from "@/server/services/dashboard";
import { PageHeader, Panel, StatCard } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS, PROJECT_STATUS, ROLE_LABEL } from "@/lib/labels";
import { formatDateTime, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Admin overview" };

function Breakdown({ rows, map }: { rows: { key: string; count: number }[]; map: Record<string, { label: string }> }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (!total) return <p className="text-sm text-muted">No records yet.</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.sort((a, b) => b.count - a.count).map((r) => (
          <tr key={r.key}>
            <th scope="row" className="w-40 py-1.5 pr-3 text-left font-normal text-ink">{map[r.key]?.label ?? r.key}</th>
            <td className="py-1.5">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-50" aria-hidden>
                  <div className="h-full rounded-full bg-slate-blue" style={{ width: `${(r.count / max) * 100}%` }} />
                </div>
                <span className="tabular w-10 text-right text-xs text-muted">{r.count}</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AdminOverviewPage() {
  const actor = await requireUser(["ADMIN"]);
  const d = await adminDashboard(actor);
  const users = Object.fromEntries(d.usersByRole.map((u) => [u.role, u._count]));
  const activeOrders = d.ordersByStatus.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status)).reduce((s, o) => s + o._count, 0);

  return (
    <>
      <PageHeader title="Platform overview" description="Live figures counted from the database." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Factories awaiting verification" value={d.pendingFactories} href="/admin/factories?status=PENDING" icon={BadgeCheck} tone={d.pendingFactories ? "warning" : "neutral"} hint={`${d.verifiedFactories} verified`} />
        <StatCard label="Active orders" value={activeOrders} href="/admin/orders?status=ACTIVE" icon={PackageSearch} />
        <StatCard label="Delayed orders" value={d.delayedOrders} href="/admin/orders?delayed=1" icon={AlertTriangle} tone={d.delayedOrders ? "danger" : "neutral"} />
        <StatCard label="Open disputes" value={d.openDisputes} href="/admin/disputes" icon={ShieldAlert} tone={d.openDisputes ? "warning" : "neutral"} />
        <StatCard label="Failed inspections (30 days)" value={d.failedQc30} href="/admin/qc" icon={ScanSearch} tone={d.failedQc30 ? "warning" : "neutral"} />
        <StatCard label="Users" value={(users.BRAND ?? 0) + (users.MANUFACTURER ?? 0)} href="/admin/users" icon={Users} hint={`${users.BRAND ?? 0} brands · ${users.MANUFACTURER ?? 0} factories`} />
        <StatCard label="Suspended accounts" value={d.suspended} href="/admin/users?status=SUSPENDED" icon={Ban} />
        <StatCard label="Unprocessed webhook errors" value={d.webhookErrors} href="/admin/payments" icon={Webhook} tone={d.webhookErrors ? "danger" : "neutral"} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Orders by status"><Breakdown rows={d.ordersByStatus.map((o) => ({ key: o.status, count: o._count }))} map={ORDER_STATUS} /></Panel>
        <Panel title="Projects by status"><Breakdown rows={d.projectsByStatus.map((p) => ({ key: p.status, count: p._count }))} map={PROJECT_STATUS} /></Panel>
        <Panel title="Payments received" actions={<Button asChild variant="link" size="sm"><Link href="/admin/payments">Payment events</Link></Button>}>
          {d.paidByCurrency.length === 0 ? (
            <p className="text-sm text-muted">No paid milestones yet.</p>
          ) : (
            d.paidByCurrency.map((p) => <p key={p.currency} className="tabular font-display text-2xl font-semibold text-navy">{formatMoney(p._sum.amount ?? 0, p.currency)}</p>)
          )}
          <p className="mt-2 flex items-center gap-1 text-xs text-muted"><CircleDollarSign className="size-3.5" aria-hidden />Sandbox provider — no real funds.</p>
        </Panel>
      </div>
      <Panel className="mt-6" title="Recent administrative actions" actions={<Button asChild variant="link" size="sm"><Link href="/admin/audit">Audit log</Link></Button>}>
        {d.recentAudit.length === 0 ? (
          <p className="text-sm text-muted">No administrative actions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {d.recentAudit.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><span className="font-medium text-navy">{a.action.replaceAll("_", " ").toLowerCase()}</span> · {a.targetType} · {a.actor.name}{a.reason ? ` — ${a.reason}` : ""}</span>
                <span className="text-xs text-muted">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <p className="mt-6 text-xs text-muted">Signed in as {actor.email} ({ROLE_LABEL[actor.role]}).</p>
    </>
  );
}
