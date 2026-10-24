import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle, ArrowRight, BadgeCheck, CircleDollarSign, ClipboardCheck, ClipboardList, FilePen, FileSearch, FileText, PackageSearch, Plus, Shirt, Timer,
} from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/session";
import { brandDashboard, manufacturerDashboard } from "@/server/services/dashboard";
import { listProjects } from "@/server/services/projects";
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import { NotificationList } from "@/components/app/notification-list";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PAYMENT_STATUS, PROJECT_STATUS, VERIFICATION_STATUS } from "@/lib/labels";
import { formatDate, formatMoney, relativeDays } from "@/lib/format";
import { stageLabel } from "@/lib/workflow";
import type { Actor } from "@/server/actor";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string; denied?: string }> }) {
  const actor = await requireOnboardedUser();
  if (actor.role === "ADMIN") redirect("/admin");
  const sp = await searchParams;
  return (
    <>
      {sp.denied && <Alert tone="error" className="mb-6">That page is not available for your account type.</Alert>}
      {actor.role === "BRAND" ? <BrandHome actor={actor} welcome={!!sp.welcome} /> : <ManufacturerHome actor={actor} />}
    </>
  );
}

async function BrandHome({ actor, welcome }: { actor: Actor; welcome: boolean }) {
  const [d, recent] = await Promise.all([brandDashboard(actor), listProjects(actor, { pageSize: 5 })]);
  const create = (
    <Button asChild variant="accent">
      <Link href="/projects/new"><Plus /> Create production project</Link>
    </Button>
  );
  return (
    <>
      <PageHeader title={`Welcome, ${actor.name.split(" ")[0]}`} description="Your projects, orders and decisions waiting for you." actions={create} />
      {welcome && <Alert tone="success" className="mb-6">Your company profile is saved. Create your first production project to get matched with verified factories.</Alert>}

      {d.isNew ? (
        <Panel>
          <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Start your first production run</h2>
                <p className="mt-1 max-w-xl text-sm text-muted">Nothing to show yet. Once you submit a project, its matches, quotations, orders and payments appear here.</p>
              </div>
              {create}
            </div>
            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: FilePen, t: "Brief the product", d: "Category, fabric, sizes, quantity, deadline and your tech pack." },
                { icon: FileSearch, t: "Get matched", d: "Verified factories that meet every requirement are invited to quote." },
                { icon: FileText, t: "Compare & accept", d: "Accepting a quotation creates the order and its production plan." },
              ].map((s, i) => (
                <li key={s.t} className="rounded-md border border-line p-4">
                  <s.icon className="size-5 text-teal" aria-hidden />
                  <p className="mt-2 text-sm font-semibold text-navy">{i + 1}. {s.t}</p>
                  <p className="mt-1 text-xs text-muted">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </Panel>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Projects seeking quotes" value={d.activeProjects} href="/projects?status=QUOTING" icon={ClipboardList} hint={d.drafts ? `${d.drafts} draft${d.drafts === 1 ? "" : "s"}` : undefined} />
            <StatCard label="Quotations to review" value={d.pendingQuotations} href="/projects?status=QUOTING" icon={FileText} tone={d.pendingQuotations ? "warning" : "neutral"} />
            <StatCard label="Active orders" value={d.activeOrders} href="/orders?status=ACTIVE" icon={PackageSearch} />
            <StatCard label="Delayed orders" value={d.delayedOrders} href="/orders?delayed=1" icon={AlertTriangle} tone={d.delayedOrders ? "danger" : "neutral"} />
            <StatCard label="Samples awaiting review" value={d.samplesToReview} href="/orders?attention=samples" icon={Shirt} tone={d.samplesToReview ? "warning" : "neutral"} />
            <StatCard label="QC decisions pending" value={d.pendingQc} href="/orders?attention=qc" icon={ClipboardCheck} tone={d.pendingQc ? "warning" : "neutral"} />
            <StatCard label="Payments due" value={d.payments.filter((p) => p.status !== "PROCESSING").length} href="/payments" icon={CircleDollarSign} tone={d.payments.length ? "warning" : "neutral"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Panel title="Recent projects" actions={<Button asChild variant="link" size="sm"><Link href="/projects">All projects <ArrowRight /></Link></Button>} bodyClassName="p-0">
              <ul className="divide-y divide-line">
                {recent.items.map((p) => (
                  <li key={p.id}>
                    <Link href={p.order ? `/orders/${p.order.id}` : `/projects/${p.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-canvas sm:px-5">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy">{p.name}</span>
                      {p._count.quotations > 0 && <span className="text-xs text-muted">{p._count.quotations} quote{p._count.quotations === 1 ? "" : "s"}</span>}
                      <StatusBadge map={PROJECT_STATUS} value={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
            <div className="space-y-6">
              <Panel title="Upcoming payments" actions={<Button asChild variant="link" size="sm"><Link href="/payments">All payments</Link></Button>}>
                {d.payments.length === 0 ? (
                  <p className="text-sm text-muted">No payments are due.</p>
                ) : (
                  <ul className="space-y-3">
                    {d.payments.map((p) => (
                      <li key={p.id} className="flex items-start justify-between gap-3 text-sm">
                        <Link href={`/orders/${p.order.id}#payments`} className="min-w-0 hover:underline">
                          <span className="block truncate font-medium text-navy">{p.label}</span>
                          <span className="block truncate text-xs text-muted">{p.order.reference} · {p.order.project.name}{p.dueAt ? ` · due ${relativeDays(p.dueAt)}` : ""}</span>
                        </Link>
                        <span className="text-right">
                          <span className="tabular block font-medium">{formatMoney(p.amount, p.currency)}</span>
                          <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Recent notifications" actions={<Button asChild variant="link" size="sm"><Link href="/notifications">View all</Link></Button>}>
                <NotificationList items={d.notifications} compact />
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}

async function ManufacturerHome({ actor }: { actor: Actor }) {
  const d = await manufacturerDashboard(actor);
  const verified = d.profile?.verificationStatus === "VERIFIED";
  return (
    <>
      <PageHeader
        title={d.profile?.businessName ?? "Dashboard"}
        description="Opportunities, quotations and the production work waiting for you."
        meta={d.profile && <StatusBadge map={VERIFICATION_STATUS} value={d.profile.verificationStatus} />}
        actions={<Button asChild variant="accent"><Link href="/opportunities"><FileSearch /> View opportunities</Link></Button>}
      />
      {!verified && (
        <Alert tone={d.profile?.verificationStatus === "REJECTED" ? "error" : "info"} className="mb-6">
          {d.profile?.verificationStatus === "PENDING"
            ? "Your verification request is being reviewed. You will start receiving matched projects once it is approved."
            : d.profile?.verificationStatus === "REJECTED"
              ? `Verification was not approved: ${d.profile.verificationNote ?? "see your factory profile"}. `
              : "Your factory is not verified yet, so you are not matched to projects. "}
          {d.profile?.verificationStatus !== "PENDING" && <Link href="/factory#verification" className="font-medium underline">Go to verification</Link>}
        </Alert>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="New opportunities" value={d.newOpportunities} href="/opportunities?filter=new" icon={FileSearch} tone={d.newOpportunities ? "warning" : "neutral"} />
        <StatCard label="Quotes awaiting brand" value={d.openQuotes} href="/quotations?status=SUBMITTED" icon={FileText} />
        <StatCard label="Revision requests" value={d.revisionRequests} href="/quotations?status=REVISION_REQUESTED" icon={FilePen} tone={d.revisionRequests ? "warning" : "neutral"} />
        <StatCard label="Active orders" value={d.activeOrders} href="/orders?status=ACTIVE" icon={PackageSearch} />
        <StatCard label="Delayed orders" value={d.delayedOrders} href="/orders?delayed=1" icon={Timer} tone={d.delayedOrders ? "danger" : "neutral"} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Production work" description="Active orders, soonest delivery first." bodyClassName="p-0">
          {d.actionOrders.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={PackageSearch} title="No active orders" description={verified ? "When a brand accepts one of your quotations, the order and its production plan appear here." : "Get verified to start receiving matched projects."} className="border-0" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {d.actionOrders.map((o) => {
                const current = o.milestones.find((m) => m.stage === o.currentStage);
                return (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-canvas sm:px-5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-navy">{o.project.name}</span>
                        <span className="block text-xs text-muted">{o.reference} · {stageLabel(o.currentStage)}{current?.plannedEnd ? ` · stage due ${formatDate(current.plannedEnd)}` : ""}</span>
                      </span>
                      {current?.isDelayed && <span className="text-xs font-medium text-danger">Delayed</span>}
                      {current?.status === "AWAITING_APPROVAL" && <span className="text-xs font-medium text-warning-700">Awaiting brand</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="Payments received" actions={<Button asChild variant="link" size="sm"><Link href="/payments">Details</Link></Button>}>
            {d.paid.length === 0 ? (
              <p className="text-sm text-muted">No payments received yet.</p>
            ) : (
              <ul className="space-y-1">
                {d.paid.map((p) => <li key={p.currency} className="tabular font-display text-xl font-semibold text-navy">{formatMoney(p._sum.amount ?? 0, p.currency)}</li>)}
              </ul>
            )}
            <p className="mt-2 flex items-center gap-1 text-xs text-muted"><BadgeCheck className="size-3.5" aria-hidden /> Sandbox payments — no real money is transferred in this build.</p>
          </Panel>
          <Panel title="Recent notifications" actions={<Button asChild variant="link" size="sm"><Link href="/notifications">View all</Link></Button>}>
            <NotificationList items={d.notifications} compact />
          </Panel>
        </div>
      </div>
    </>
  );
}
