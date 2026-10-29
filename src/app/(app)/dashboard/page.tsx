import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle, ArrowRight, BadgeCheck, CircleDollarSign, ClipboardCheck, ClipboardList, FilePen, FileSearch, FileText, PackageSearch, Plus, ShieldCheck, Shirt, Timer,
} from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/session";
import { brandDashboard, manufacturerDashboard } from "@/server/services/dashboard";
import { listProjects } from "@/server/services/projects";
import { EmptyState, Metric, MetricStrip, PageHeader, Panel, ProgressBar, StatusBadge } from "@/components/app/primitives";
import { ProjectProgress } from "@/components/projects/project-progress";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUS, PROJECT_STATUS, VERIFICATION_STATUS, categoryLabel } from "@/lib/labels";
import { formatDate, formatMoney, relativeDays } from "@/lib/format";
import { STAGES, stageLabel } from "@/lib/workflow";
import type { Actor } from "@/server/actor";
import { AttentionList, type AttentionItem } from "./attention-list";
import { RecentNotifications } from "./recent-notifications";

export const metadata: Metadata = { title: "Dashboard" };

const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
function compact<T>(xs: (T | false)[]): T[] {
  return xs.filter((x): x is T => x !== false);
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

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

function viewAll(href: string, label: string) {
  return (
    <Button asChild variant="link" size="sm">
      <Link href={href}>{label} <ArrowRight /></Link>
    </Button>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Brand
 * -----------------------------------------------------------------------------------------------*/

async function BrandHome({ actor, welcome }: { actor: Actor; welcome: boolean }) {
  const [d, recent] = await Promise.all([brandDashboard(actor), listProjects(actor, { pageSize: 5 })]);
  const create = (
    <Button asChild variant="accent">
      <Link href="/projects/new"><Plus /> Create production project</Link>
    </Button>
  );
  const header = (
    <PageHeader
      eyebrow={today.format(new Date())}
      title={`Welcome, ${actor.name.split(" ")[0]}`}
      description="Your projects, orders and decisions waiting for you."
      actions={create}
    />
  );
  const welcomeAlert = welcome && (
    <Alert tone="success" className="mb-6">Your company profile is saved. Create your first production project to get matched with verified factories.</Alert>
  );

  if (d.isNew) {
    return (
      <>
        {header}
        {welcomeAlert}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <BrandOnboarding create={create} />
          <Panel title="Recent notifications" actions={viewAll("/notifications", "View all")} bodyClassName="p-0 sm:p-0">
            <RecentNotifications items={d.notifications.slice(0, 4)} />
          </Panel>
        </div>
      </>
    );
  }

  const due = d.payments.filter((p) => p.status !== "PROCESSING");
  const failed = d.payments.filter((p) => p.status === "FAILED");
  const attention = compact<AttentionItem>([
    d.delayedOrders > 0 && {
      key: "delayed", icon: Timer, tone: "danger", href: "/orders?delayed=1",
      title: `${plural(d.delayedOrders, "order")} behind schedule`,
      description: "A production stage or the delivery date has slipped. Check the plan with the factory.",
    },
    failed.length > 0 && {
      key: "failed", icon: CircleDollarSign, tone: "danger", href: "/payments",
      title: `${plural(failed.length, "payment")} failed`,
      description: "Retry the payment so production is not held up.",
    },
    d.pendingQuotations > 0 && {
      key: "quotes", icon: FileText, tone: "warning", href: "/projects?status=QUOTING",
      title: `Review ${plural(d.pendingQuotations, "quotation")}`,
      description: "Compare cost breakdowns, then accept, request a revision or decline.",
    },
    d.samplesToReview > 0 && {
      key: "samples", icon: Shirt, tone: "warning", href: "/orders?attention=samples",
      title: `${plural(d.samplesToReview, "sample")} awaiting your review`,
      description: "Production pauses until you approve or request changes.",
    },
    d.pendingQc > 0 && {
      key: "qc", icon: ClipboardCheck, tone: "warning", href: "/orders?attention=qc",
      title: `${plural(d.pendingQc, "QC report")} to accept`,
      description: "The factory's inspection passed and is waiting for your decision.",
    },
    due.length - failed.length > 0 && {
      key: "due", icon: CircleDollarSign, tone: "warning", href: "/payments",
      title: `${plural(due.length - failed.length, "payment milestone")} due`,
      description: "Milestone payments are released as production stages complete.",
    },
    d.drafts > 0 && {
      key: "drafts", icon: FilePen, tone: "neutral", href: "/projects?status=DRAFT",
      title: `Finish ${plural(d.drafts, "draft project")}`,
      description: "Drafts are private. Submit them to get matched with factories.",
    },
  ]);

  return (
    <>
      {header}
      {welcomeAlert}
      <MetricStrip label="Summary">
        <Metric label="Seeking quotes" value={d.activeProjects} href="/projects?status=QUOTING" icon={ClipboardList} hint={d.drafts ? plural(d.drafts, "draft") : undefined} />
        <Metric label="Quotations to review" value={d.pendingQuotations} href="/projects?status=QUOTING" icon={FileText} tone={d.pendingQuotations ? "warning" : undefined} />
        <Metric label="Active orders" value={d.activeOrders} href="/orders?status=ACTIVE" icon={PackageSearch} />
        <Metric label="Delayed orders" value={d.delayedOrders} href="/orders?delayed=1" icon={AlertTriangle} tone={d.delayedOrders ? "danger" : undefined} />
        <Metric label="Payments due" value={due.length} href="/payments" icon={CircleDollarSign} tone={due.length ? "warning" : undefined} />
      </MetricStrip>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel
            title="Needs your attention"
            description={attention.length ? `${plural(attention.length, "item")} waiting on you` : undefined}
            bodyClassName="p-0 sm:p-0"
          >
            <AttentionList items={attention} clear="You are all caught up. New quotations, samples and payments will appear here." />
          </Panel>

          <Panel title="Recent projects" actions={viewAll("/projects", "All projects")} bodyClassName="p-0 sm:p-0">
            {recent.items.length === 0 ? (
              <EmptyState variant="plain" icon={ClipboardList} title="No projects yet" description="Create a production project to describe what you want made." className="py-8" />
            ) : (
              <ul className="divide-y divide-line-subtle">
                {recent.items.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={p.status === "DRAFT" ? `/projects/${p.id}/edit` : p.order ? `/orders/${p.order.id}` : `/projects/${p.id}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-hover sm:grid-cols-[minmax(0,1fr)_9rem_8.75rem] sm:px-5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                        <span className="block truncate text-xs leading-5 text-ink-muted">
                          {categoryLabel(p.category)}
                          {p._count.quotations > 0 && ` · ${plural(p._count.quotations, "open quote")}`}
                          {` · updated ${formatDate(p.updatedAt)}`}
                        </span>
                      </span>
                      <ProjectProgress status={p.status} className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" />
                      <span className="col-start-2 row-start-1 justify-self-end sm:col-start-auto sm:row-start-auto">
                        <StatusBadge map={PROJECT_STATUS} value={p.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Upcoming payments" actions={viewAll("/payments", "All payments")} bodyClassName={d.payments.length ? "p-0 sm:p-0" : undefined}>
            {d.payments.length === 0 ? (
              <p className="text-sm text-ink-muted">No payments are due.</p>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {d.payments.map((p) => (
                  <li key={p.id}>
                    <Link href={`/orders/${p.order.id}#payments`} className="flex items-start justify-between gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-hover sm:px-5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{p.label}</span>
                        <span className="block truncate text-xs leading-5 text-ink-muted">{p.order.reference} · {p.order.project.name}</span>
                        {p.dueAt && <span className="block text-xs leading-5 text-ink-muted">Due {relativeDays(p.dueAt)}</span>}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="tabular text-sm font-semibold text-ink">{formatMoney(p.amount, p.currency)}</span>
                        <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Recent notifications" actions={viewAll("/notifications", "View all")} bodyClassName="p-0 sm:p-0">
            <RecentNotifications items={d.notifications.slice(0, 4)} />
          </Panel>
        </div>
      </div>
    </>
  );
}

function BrandOnboarding({ create }: { create: React.ReactNode }) {
  const steps = [
    { icon: FilePen, t: "Brief the product", d: "Category, fabric, sizes, quantity, deadline and your tech pack." },
    { icon: FileSearch, t: "Get matched", d: "Verified factories that meet every requirement are invited to quote." },
    { icon: FileText, t: "Compare & accept", d: "Accepting a quotation creates the order and its production plan." },
  ];
  return (
    <section aria-labelledby="getting-started" className="min-w-0 rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-4 py-6 sm:px-7 sm:py-8">
        <p className="eyebrow text-accent-strong">Getting started</p>
        <h2 id="getting-started" className="mt-3 max-w-lg font-display text-2xl font-normal leading-tight tracking-[-0.015em] text-ink sm:text-[28px]">
          Start your first production run
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">
          Nothing to show yet. Once you submit a project, its matches, quotations, orders and payments appear here.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 max-sm:[&>*]:grow">{create}</div>
      </div>
      <ol className="grid sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.t} className="border-line-subtle px-4 py-5 max-sm:border-t max-sm:first:border-t-0 sm:border-l sm:px-7 sm:py-6 sm:first:border-l-0">
            <span className="flex items-center justify-between gap-2.5">
              <span className="tabular font-display text-2xl font-light leading-none text-accent-strong" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <s.icon className="size-4 text-ink-subtle" aria-hidden />
            </span>
            <p className="mt-4 border-t border-line pt-3 text-sm font-semibold text-ink">
              <span className="sr-only">Step {i + 1}: </span>{s.t}
            </p>
            <p className="mt-1 text-[13px] leading-5 text-ink-muted">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Manufacturer
 * -----------------------------------------------------------------------------------------------*/

async function ManufacturerHome({ actor }: { actor: Actor }) {
  const d = await manufacturerDashboard(actor);
  const status = d.profile?.verificationStatus;
  const verified = status === "VERIFIED";
  const awaitingBrand = d.actionOrders.filter((o) => o.milestones.find((m) => m.stage === o.currentStage)?.status === "AWAITING_APPROVAL").length;

  const attention = compact<AttentionItem>([
    !verified && status !== "PENDING" && {
      key: "verify", icon: ShieldCheck, tone: status === "REJECTED" ? "danger" : "accent", href: "/factory#verification",
      title: status === "REJECTED" ? "Update your verification documents" : "Get your factory verified",
      description: "Only verified factories are matched to brand projects.",
    },
    d.delayedOrders > 0 && {
      key: "delayed", icon: Timer, tone: "danger", href: "/orders?delayed=1",
      title: `${plural(d.delayedOrders, "order")} behind schedule`,
      description: "Update the stage evidence or tell the brand about the new date.",
    },
    d.revisionRequests > 0 && {
      key: "revisions", icon: FilePen, tone: "warning", href: "/quotations?status=REVISION_REQUESTED",
      title: `${plural(d.revisionRequests, "revision request")} to answer`,
      description: "The brand asked for changes before deciding on your quotation.",
    },
    d.newOpportunities > 0 && {
      key: "new", icon: FileSearch, tone: "accent", href: "/opportunities?filter=new",
      title: `Quote on ${plural(d.newOpportunities, "new opportunity", "new opportunities")}`,
      description: "Matched projects you have not quoted on yet.",
    },
    awaitingBrand > 0 && {
      key: "awaiting", icon: ClipboardCheck, tone: "neutral", href: "/orders?status=ACTIVE",
      title: `${plural(awaitingBrand, "order")} waiting on the brand`,
      description: "A sample or inspection is with the brand for a decision.",
    },
  ]);

  return (
    <>
      <PageHeader
        eyebrow={today.format(new Date())}
        title={d.profile?.businessName ?? "Dashboard"}
        description="Opportunities, quotations and the production work waiting for you."
        meta={d.profile && <StatusBadge map={VERIFICATION_STATUS} value={d.profile.verificationStatus} />}
        actions={<Button asChild variant="accent"><Link href="/opportunities"><FileSearch /> View opportunities</Link></Button>}
      />
      {!verified && (
        <Alert tone={status === "REJECTED" ? "error" : "info"} className="mb-6">
          {status === "PENDING"
            ? "Your verification request is being reviewed. You will start receiving matched projects once it is approved."
            : status === "REJECTED"
              ? `Verification was not approved: ${d.profile?.verificationNote ?? "see your factory profile"}. `
              : "Your factory is not verified yet, so you are not matched to projects. "}
          {status !== "PENDING" && <Link href="/factory#verification" className="font-medium underline underline-offset-2">Go to verification</Link>}
        </Alert>
      )}

      <MetricStrip label="Summary">
        <Metric label="New opportunities" value={d.newOpportunities} href="/opportunities?filter=new" icon={FileSearch} tone={d.newOpportunities ? "accent" : undefined} />
        <Metric label="Quotes awaiting brand" value={d.openQuotes} href="/quotations?status=SUBMITTED" icon={FileText} />
        <Metric label="Revision requests" value={d.revisionRequests} href="/quotations?status=REVISION_REQUESTED" icon={FilePen} tone={d.revisionRequests ? "warning" : undefined} />
        <Metric label="Active orders" value={d.activeOrders} href="/orders?status=ACTIVE" icon={PackageSearch} />
        <Metric label="Delayed orders" value={d.delayedOrders} href="/orders?delayed=1" icon={Timer} tone={d.delayedOrders ? "danger" : undefined} />
      </MetricStrip>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel
            title="Needs your attention"
            description={attention.length ? `${plural(attention.length, "item")} waiting on you` : undefined}
            bodyClassName="p-0 sm:p-0"
          >
            <AttentionList items={attention} clear="You are all caught up. New opportunities and revision requests will appear here." />
          </Panel>

          <Panel title="Production work" description="Active orders, soonest delivery first." actions={viewAll("/orders", "All orders")} bodyClassName="p-0 sm:p-0">
            {d.actionOrders.length === 0 ? (
              <EmptyState
                variant="plain"
                className="py-8"
                icon={PackageSearch}
                title="No active orders"
                description={verified ? "When a brand accepts one of your quotations, the order and its production plan appear here." : "Get verified to start receiving matched projects."}
                action={verified && <Button asChild variant="outline" size="sm"><Link href="/opportunities">Browse opportunities</Link></Button>}
              />
            ) : (
              <ul className="divide-y divide-line-subtle">
                {d.actionOrders.map((o) => {
                  const current = o.milestones.find((m) => m.stage === o.currentStage);
                  const done = o.milestones.filter((m) => m.completedAt).length;
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/orders/${o.id}`}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-hover sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:px-5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">{o.project.name}</span>
                          <span className="tabular block truncate text-xs leading-5 text-ink-muted">
                            {o.reference}{current?.plannedEnd ? ` · stage due ${formatDate(current.plannedEnd)}` : ""}
                          </span>
                        </span>
                        <span className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:row-start-auto">
                          <ProgressBar value={done} max={STAGES.length} label={`${done} of ${STAGES.length} stages complete`} tone={current?.isDelayed ? "danger" : "accent"} />
                          <span className="tabular mt-1.5 flex justify-between gap-2 text-xs leading-4 text-ink-muted">
                            <span className="truncate">{stageLabel(o.currentStage)}</span>
                            <span aria-hidden>{done}/{STAGES.length}</span>
                          </span>
                        </span>
                        <span className="col-start-2 row-start-1 justify-self-end sm:col-start-auto sm:row-start-auto">
                          {current?.isDelayed ? (
                            <Badge tone="danger" dot>Delayed</Badge>
                          ) : current?.status === "AWAITING_APPROVAL" ? (
                            <Badge tone="warning" dot>Awaiting brand</Badge>
                          ) : (
                            <Badge tone="info" dot>On track</Badge>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Payments received" actions={viewAll("/payments", "Details")}>
            {d.paid.length === 0 ? (
              <p className="text-sm text-ink-muted">No payments received yet.</p>
            ) : (
              <ul className="space-y-1">
                {d.paid.map((p) => (
                  <li key={p.currency} className="type-metric text-ink">{formatMoney(p._sum.amount ?? 0, p.currency)}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 flex items-start gap-1.5 border-t border-line-subtle pt-3 text-xs leading-5 text-ink-muted">
              <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" aria-hidden /> Sandbox payments — no real money is transferred in this build.
            </p>
          </Panel>
          <Panel title="Recent notifications" actions={viewAll("/notifications", "View all")} bodyClassName="p-0 sm:p-0">
            <RecentNotifications items={d.notifications.slice(0, 4)} />
          </Panel>
        </div>
      </div>
    </>
  );
}
