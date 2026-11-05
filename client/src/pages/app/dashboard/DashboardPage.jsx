import { Link, useLoaderData } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  FilePen,
  FileSearch,
  FileText,
  PackageSearch,
  Plus,
  ShieldCheck,
  Shirt,
  Timer,
} from "lucide-react";
import { EmptyState, Metric, MetricStrip, PageHeader, Panel, ProgressBar, StatusBadge } from "@/components/app/primitives";
import { ProjectProgress } from "@/components/projects/project-progress";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageMeta } from "@/components/meta";
import { loadData, searchOf } from "@/lib/data";
import { PAYMENT_STATUS, PROJECT_STATUS, VERIFICATION_STATUS, categoryLabel } from "@fashinza/shared/labels.js";
import { formatDate, formatMoney, relativeDays } from "@fashinza/shared/format.js";
import { STAGES, STAGE_BY_KEY, stageLabel } from "@fashinza/shared/workflow.js";
import { AttentionList } from "./attention-list";
import { RecentNotifications } from "./recent-notifications";

/**
 * /dashboard — port of src/app/(app)/dashboard/page.tsx (+ attention-list.tsx, recent-notifications.tsx).
 * Gate: onboarded; ADMIN is sent to /admin by the router before anything loads. Shows the `?denied=1` notice
 * (role refused elsewhere) and, for brands, the `?welcome=1` notice.
 */
export async function loader({ request, user }) {
  const sp = searchOf(request);
  const d = await loadData("/api/dashboard", { request });
  return { d, actor: user, welcome: !!sp.welcome, denied: !!sp.denied };
}

const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
function compact(xs) {
  return xs.filter((x) => x !== false);
}
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export default function DashboardPage() {
  const { d, actor, welcome, denied } = useLoaderData();
  return (
    <>
      <PageMeta title="Dashboard" />
      {denied && (
        <Alert tone="error" className="mb-6">
          That page is not available for your account type.
        </Alert>
      )}
      {actor.role === "BRAND" ? <BrandHome actor={actor} d={d} welcome={welcome} /> : <ManufacturerHome d={d} />}
    </>
  );
}

/**
 * The dashboard's count strip. From sm up it is the full strip above the panels (`placement="top"`). On phones
 * it moves under "Needs your attention" (`placement="phone"`) and keeps only the non-zero counts, so the first
 * screen shows what to do rather than a grid of zeros.
 */
function SummaryStrip({ metrics, placement }) {
  if (placement === "top") {
    return (
      <MetricStrip label="Summary" className="max-sm:hidden">
        {metrics.map(({ id, ...m }) => (
          <Metric key={id} {...m} />
        ))}
      </MetricStrip>
    );
  }
  const nonZero = metrics.filter((m) => m.value !== 0);
  if (nonZero.length === 0) return null;
  return (
    <MetricStrip label="Summary" className="mb-0 sm:hidden">
      {nonZero.map(({ id, ...m }) => (
        <Metric key={id} {...m} />
      ))}
    </MetricStrip>
  );
}

/** "€1,200.00" or "€1,200.00 + $300.00" when the rows span currencies. */
function moneyText(rows) {
  const byCurrency = new Map();
  rows.forEach((r) => byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + Number(r._sum.amount?.toString() ?? 0)));
  return [...byCurrency].map(([c, n]) => formatMoney(n, c)).join(" + ");
}

function viewAll(href, label) {
  return (
    <Button asChild variant="link" size="sm">
      <Link to={href}>
        {label} <ArrowRight />
      </Link>
    </Button>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Brand
 * -----------------------------------------------------------------------------------------------*/

function BrandHome({ actor, d, welcome }) {
  const recent = d.recent;
  const create = (
    <Button asChild variant="accent">
      <Link to="/projects/new">
        <Plus /> Create production project
      </Link>
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
    <Alert tone="success" className="mb-6">
      Your company profile is saved. Create your first production project to get matched with verified factories.
    </Alert>
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

  // Uncapped totals of due and failed milestones (the "Upcoming payments" list below shows the first five).
  const dueRows = d.openPayments.filter((r) => r.status === "DUE");
  const failedRows = d.openPayments.filter((r) => r.status === "FAILED");
  const countOf = (rows) => rows.reduce((n, r) => n + r._count, 0);
  const dueCount = countOf(dueRows);
  const failedCount = countOf(failedRows);
  const ordersOf = (rows) => [...new Set(rows.map((r) => r.orderId))];
  const reference = (orderId) => d.payments.find((p) => p.order.id === orderId)?.order.reference;
  /** "ORD-1042" for a single order, otherwise "3 orders". */
  const whereText = (rows) => {
    const ids = ordersOf(rows);
    return ids.length === 1 ? (reference(ids[0]) ?? "one order") : plural(ids.length, "order");
  };
  /** A single order opens that order (its "Your next step" card holds the Pay buttons); several open the list. */
  const payHref = (rows, status) => {
    const ids = ordersOf(rows);
    return ids.length === 1 ? `/orders/${ids[0]}` : `/payments?status=${status}`;
  };
  const nextDue = d.payments.find((p) => p.status === "DUE" && p.dueAt)?.dueAt;
  const attention = compact([
    d.delayedOrders > 0 && {
      key: "delayed",
      icon: Timer,
      tone: "danger",
      href: "/orders?delayed=1",
      title: `${plural(d.delayedOrders, "order")} behind schedule`,
      description: "A production stage or the delivery date has slipped. Check the plan with the factory.",
    },
    failedCount > 0 && {
      key: "failed",
      icon: CircleDollarSign,
      tone: "danger",
      href: payHref(failedRows, "FAILED"),
      title: `${plural(failedCount, "payment")} failed`,
      description: `Pay ${moneyText(failedRows)} on ${whereText(failedRows)} again so production is not held up.`,
    },
    d.pendingQuotations > 0 && {
      key: "quotes",
      icon: FileText,
      tone: "warning",
      href: "/projects?status=QUOTING",
      title: `Review ${plural(d.pendingQuotations, "quotation")}`,
      description: "Compare cost breakdowns, then accept, request a revision or decline.",
    },
    d.samplesToReview > 0 && {
      key: "samples",
      icon: Shirt,
      tone: "warning",
      href: "/orders?attention=samples",
      title: `${plural(d.samplesToReview, "sample")} awaiting your review`,
      description: "Production pauses until you approve or request changes.",
    },
    d.pendingQc > 0 && {
      key: "qc",
      icon: ClipboardCheck,
      tone: "warning",
      href: "/orders?attention=qc",
      title: `${plural(d.pendingQc, "QC report")} to accept`,
      description: "The factory's inspection passed and is waiting for your decision.",
    },
    dueCount > 0 && {
      key: "due",
      icon: CircleDollarSign,
      tone: "warning",
      href: payHref(dueRows, "DUE"),
      title: `${plural(dueCount, "payment milestone")} due`,
      description: `${moneyText(dueRows)} due on ${whereText(dueRows)}${nextDue ? `, the next one ${relativeDays(nextDue)}` : ""}.`,
    },
    d.drafts > 0 && {
      key: "drafts",
      icon: FilePen,
      tone: "neutral",
      href: "/projects?status=DRAFT",
      title: `Finish ${plural(d.drafts, "draft project")}`,
      description: "Drafts are private. Submit them to get matched with factories.",
    },
  ]);

  const metrics = [
    {
      id: "quotes",
      label: "Seeking quotes",
      value: d.activeProjects,
      href: "/projects?status=QUOTING",
      icon: ClipboardList,
      hint: d.drafts ? plural(d.drafts, "draft") : undefined,
    },
    {
      id: "review",
      label: "Quotations to review",
      value: d.pendingQuotations,
      href: "/projects?status=QUOTING",
      icon: FileText,
      tone: d.pendingQuotations ? "warning" : undefined,
    },
    { id: "active", label: "Active orders", value: d.activeOrders, href: "/orders?status=ACTIVE", icon: PackageSearch },
    { id: "delayed", label: "Delayed orders", value: d.delayedOrders, href: "/orders?delayed=1", icon: AlertTriangle, tone: d.delayedOrders ? "danger" : undefined },
    {
      id: "due",
      label: "Payments due",
      value: dueCount + failedCount,
      href: failedCount ? "/payments" : "/payments?status=DUE",
      icon: CircleDollarSign,
      tone: dueCount + failedCount ? "warning" : undefined,
    },
  ];

  return (
    <>
      {header}
      {welcomeAlert}
      <SummaryStrip metrics={metrics} placement="top" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Needs your attention" description={attention.length ? `${plural(attention.length, "item")} waiting on you` : undefined} bodyClassName="p-0 sm:p-0">
            <AttentionList items={attention} clear="You are all caught up. New quotations, samples and payments will appear here." />
          </Panel>

          <SummaryStrip metrics={metrics} placement="phone" />

          <Panel title="Recent projects" actions={viewAll("/projects", "All projects")} bodyClassName="p-0 sm:p-0">
            {recent.items.length === 0 ? (
              <EmptyState
                variant="plain"
                icon={ClipboardList}
                title="No projects yet"
                description="Create a production project to describe what you want made."
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-line-subtle">
                {recent.items.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={p.status === "DRAFT" ? `/projects/${p.id}/edit` : p.order ? `/orders/${p.order.id}` : `/projects/${p.id}`}
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
                    <Link
                      to={`/orders/${p.order.id}?tab=payments`}
                      className="flex items-start justify-between gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-hover sm:px-5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{p.label}</span>
                        <span className="block truncate text-xs leading-5 text-ink-muted">
                          {p.order.reference} · {p.order.project.name}
                        </span>
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

function BrandOnboarding({ create }) {
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
              <span className="sr-only">Step {i + 1}: </span>
              {s.t}
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

/** Whose move it is on an open order: behind schedule, waiting on the brand's decision, or the factory's turn. */
function turnOf(o) {
  const m = o.milestones.find((x) => x.stage === o.currentStage);
  return m?.isDelayed ? "delayed" : m?.status === "AWAITING_APPROVAL" ? "brand" : "factory";
}

function ManufacturerHome({ d }) {
  const status = d.profile?.verificationStatus;
  const verified = status === "VERIFIED";
  // Whose move it is on every open order before delivery (uncapped), so the count and the row badges agree.
  const yourTurn = d.stageStates.filter((o) => turnOf(o) === "factory").length;
  const awaitingBrand = d.stageStates.filter((o) => turnOf(o) === "brand").length;

  const attention = compact([
    !verified &&
      status !== "PENDING" && {
        key: "verify",
        icon: ShieldCheck,
        tone: status === "REJECTED" ? "danger" : "accent",
        href: "/factory#verification",
        title: status === "REJECTED" ? "Update your verification documents" : "Get your factory verified",
        description:
          status === "REJECTED"
            ? `Not approved: ${d.profile?.verificationNote ?? "see the notes on your factory profile"}. Fix the documents and request verification again.`
            : "Only verified factories are matched to brand projects.",
      },
    d.delayedOrders > 0 && {
      key: "delayed",
      icon: Timer,
      tone: "danger",
      href: "/orders?delayed=1",
      title: `${plural(d.delayedOrders, "order")} behind schedule`,
      description: "Update the stage evidence or tell the brand about the new date.",
    },
    yourTurn > 0 && {
      key: "production",
      icon: PackageSearch,
      tone: "accent",
      href: "/orders?status=ACTIVE",
      title: `${plural(yourTurn, "order")} ${yourTurn === 1 ? "needs" : "need"} a production update`,
      description: "Upload stage evidence, a sample, the QC report or the shipment details.",
    },
    d.revisionRequests > 0 && {
      key: "revisions",
      icon: FilePen,
      tone: "warning",
      href: "/quotations?status=REVISION_REQUESTED",
      title: `${plural(d.revisionRequests, "revision request")} to answer`,
      description: "The brand asked for changes before deciding on your quotation.",
    },
    d.newOpportunities > 0 && {
      key: "new",
      icon: FileSearch,
      tone: "accent",
      href: "/opportunities?filter=new",
      title: `Quote on ${plural(d.newOpportunities, "new opportunity", "new opportunities")}`,
      description: "Matched projects you have not quoted on yet.",
    },
  ]);
  const metrics = [
    { id: "new", label: "New opportunities", value: d.newOpportunities, href: "/opportunities?filter=new", icon: FileSearch },
    { id: "quotes", label: "Quotes awaiting brand", value: d.openQuotes, href: "/quotations?status=SUBMITTED", icon: FileText },
    {
      id: "revisions",
      label: "Revision requests",
      value: d.revisionRequests,
      href: "/quotations?status=REVISION_REQUESTED",
      icon: FilePen,
      tone: d.revisionRequests ? "warning" : undefined,
    },
    { id: "active", label: "Active orders", value: d.activeOrders, href: "/orders?status=ACTIVE", icon: PackageSearch },
    { id: "delayed", label: "Delayed orders", value: d.delayedOrders, href: "/orders?delayed=1", icon: Timer, tone: d.delayedOrders ? "danger" : undefined },
  ];

  return (
    <>
      <PageHeader
        eyebrow={today.format(new Date())}
        title={d.profile?.businessName ?? "Dashboard"}
        description="Opportunities, quotations and the production work waiting for you."
        meta={d.profile && <StatusBadge map={VERIFICATION_STATUS} value={d.profile.verificationStatus} />}
        actions={
          <Button asChild variant="outline">
            <Link to="/opportunities">
              <FileSearch /> View opportunities
            </Link>
          </Button>
        }
      />
      {status === "PENDING" && (
        <Alert tone="info" className="mb-6">
          Your verification request is being reviewed. You will start receiving matched projects once it is approved.
        </Alert>
      )}
      <SummaryStrip metrics={metrics} placement="top" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Needs your attention" description={attention.length ? `${plural(attention.length, "item")} waiting on you` : undefined} bodyClassName="p-0 sm:p-0">
            <AttentionList items={attention} clear="You are all caught up. Production updates, new opportunities and revision requests will appear here." />
          </Panel>

          <SummaryStrip metrics={metrics} placement="phone" />

          <Panel
            title="Production work"
            description={`Active orders, soonest delivery first.${awaitingBrand ? ` ${plural(awaitingBrand, "order")} ${awaitingBrand === 1 ? "is" : "are"} waiting on the brand.` : ""}`}
            actions={viewAll("/orders", "All orders")}
            bodyClassName="p-0 sm:p-0"
          >
            {d.actionOrders.length === 0 ? (
              <EmptyState
                variant="plain"
                className="py-8"
                icon={PackageSearch}
                title="No active orders"
                description={
                  verified
                    ? "When a brand accepts one of your quotations, the order and its production plan appear here."
                    : "Orders appear here once your factory is verified and a brand accepts a quotation."
                }
                action={
                  verified && (
                    <Button asChild variant="outline" size="sm">
                      <Link to="/opportunities">Browse opportunities</Link>
                    </Button>
                  )
                }
              />
            ) : (
              <ul className="divide-y divide-line-subtle">
                {d.actionOrders.map((o) => {
                  const current = o.milestones.find((m) => m.stage === o.currentStage);
                  const done = o.milestones.filter((m) => m.completedAt).length;
                  const turn = turnOf(o);
                  return (
                    <li key={o.id}>
                      <Link
                        to={`/orders/${o.id}`}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-hover sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:px-5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">{o.project.name}</span>
                          <span className="tabular block truncate text-xs leading-5 text-ink-muted">
                            {o.reference}
                            {current?.plannedEnd ? ` · stage due ${formatDate(current.plannedEnd)}` : ""}
                          </span>
                          {turn === "factory" && (
                            <span className="block truncate text-xs leading-5 text-ink-muted">Needed: {lowerFirst(STAGE_BY_KEY[o.currentStage].requirement)}</span>
                          )}
                        </span>
                        <span className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:row-start-auto">
                          <ProgressBar
                            value={done}
                            max={STAGES.length}
                            label={`${done} of ${STAGES.length} stages complete`}
                            tone={current?.isDelayed ? "danger" : "accent"}
                          />
                          <span className="tabular mt-1.5 flex justify-between gap-2 text-xs leading-4 text-ink-muted">
                            <span className="truncate">{stageLabel(o.currentStage)}</span>
                            <span aria-hidden>
                              {done}/{STAGES.length}
                            </span>
                          </span>
                        </span>
                        <span className="col-start-2 row-start-1 justify-self-end sm:col-start-auto sm:row-start-auto">
                          {turn === "delayed" ? (
                            <Badge tone="danger" dot>
                              Delayed
                            </Badge>
                          ) : turn === "brand" ? (
                            <Badge tone="warning" dot>
                              Awaiting brand
                            </Badge>
                          ) : (
                            <Badge tone="accent" dot>
                              Your turn
                            </Badge>
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
                  <li key={p.currency} className="type-metric text-ink">
                    {formatMoney(p._sum.amount ?? 0, p.currency)}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 flex items-start gap-1.5 border-t border-line-subtle pt-3 text-xs leading-5 text-ink-muted">
              <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" aria-hidden /> Test payments for now: no real money is transferred.
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
