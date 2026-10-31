import { AlertTriangle, CalendarDays, MapPin, Package, RefreshCw } from "lucide-react";
import { MetaItem, PageHeader, Panel, ProgressBar, StageStepper, StatusBadge, type Step } from "@/components/app/primitives";
import { PageTabs, resolveTab, type PageTab } from "@/components/app/page-tabs";
import { LegacyHashTab } from "@/components/app/legacy-hash-tab";
import { MilestoneTracker, type TrackerMilestone } from "@/components/orders/milestone-tracker";
import { LiveRefresh, RaiseDisputeButton } from "@/components/orders/order-forms";
import { shortDate } from "@/components/orders/order-parts";
import { NextStepCard } from "@/components/orders/next-step";
import { ActivitySection, DetailsSection, MessagesSection, PaymentsSection, SamplesSection } from "@/components/orders/order-sections";
import { orderView, type Actor, type Order } from "@/components/orders/order-view";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS } from "@/lib/labels";
import { STAGE_BY_KEY, stageLabel } from "@/lib/workflow";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const TAB_KEYS = ["production", "samples", "payments", "messages", "details", "activity"] as const;
type TabKey = (typeof TAB_KEYS)[number];

/** Old in-page anchors (stored notification links) → tab keys. Module-level so the client effect sees a stable object. */
const LEGACY_HASHES: Record<string, TabKey> = {
  production: "production",
  sampling: "samples",
  quality: "samples",
  payments: "payments",
  messages: "messages",
  activity: "activity",
};

/** One fact in the progress card's footer strip. */
function Fact({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium leading-4 text-ink-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium leading-5 text-ink">{children}</dd>
      {hint && <dd className="mt-0.5 text-xs leading-4 text-ink-muted">{hint}</dd>}
    </div>
  );
}

/**
 * Order record page (brand, factory and admin). Top to bottom: header, one compact production-progress card
 * (stepper + delivery, value and shipment facts), the "Your next step" card (the only place the viewer acts),
 * then real tabs (`?tab=`) of which only the selected one is rendered: Production, Samples & QC, Payments,
 * Messages, Terms & files, Activity.
 */
export function OrderDetail({ order, actor, sp }: { order: Order; actor: Actor; sp: { created?: string; payment?: string; tab?: string } }) {
  const view = orderView(order, actor);
  const { isBrand, isFactory, closed, current, estimate, slipped, factoryName, brandName, location, doneCount, currentLate } = view;
  const tab = resolveTab<TabKey>(sp.tab, TAB_KEYS, "production");
  const basePath = `/orders/${order.id}`;
  const total = order.milestones.length;

  const commentCounts = new Map<string, number>();
  order.messages.forEach((m) => m.milestoneId && commentCounts.set(m.milestoneId, (commentCounts.get(m.milestoneId) ?? 0) + 1));
  const milestones: TrackerMilestone[] = order.milestones.map((m) => ({ ...m, commentCount: commentCounts.get(m.id) ?? 0 }));

  const steps: Step[] = order.milestones.map((m) => {
    const isCurrent = !closed && m.stage === order.currentStage;
    const done = m.status === "COMPLETED";
    return {
      key: m.id,
      label: stageLabel(m.stage),
      state: done ? "done" : isCurrent ? "current" : "upcoming",
      hint: done ? shortDate(m.completedAt) : undefined,
      attention: isCurrent && currentLate,
    };
  });

  const tabs: PageTab[] = [
    { key: "production", label: "Production" },
    {
      key: "samples",
      label: "Samples & QC",
      count: order.samples.length + order.qcReports.length,
      attention: isBrand && (!!view.pendingSample || !!view.pendingQc),
    },
    { key: "payments", label: "Payments", attention: isBrand && view.due.length > 0 },
    { key: "messages", label: "Messages", count: order.messages.length },
    { key: "details", label: "Terms & files" },
    { key: "activity", label: "Activity" },
  ];

  return (
    <>
      {!closed && <LiveRefresh />}
      <LegacyHashTab map={LEGACY_HASHES} />
      <PageHeader
        eyebrow="Production order"
        title={order.project.name}
        breadcrumbs={[{ href: actor.role === "ADMIN" ? "/admin/orders" : "/orders", label: "Orders" }]}
        meta={
          <>
            <StatusBadge map={ORDER_STATUS} value={order.status} />
            <Badge tone="outline" className="tabular">{order.reference}</Badge>
          </>
        }
        description={isBrand ? `Produced by ${factoryName}` : isFactory ? `For ${brandName}` : `${brandName} ← ${factoryName}`}
        metaRow={
          <>
            <MetaItem icon={Package}>{formatNumber(order.quantity)} units</MetaItem>
            {location && <MetaItem icon={MapPin}>{location}</MetaItem>}
            <MetaItem icon={CalendarDays}>Ordered {formatDate(order.createdAt)}</MetaItem>
            {!closed && <MetaItem icon={RefreshCw}>Updates every 30 seconds</MetaItem>}
          </>
        }
        actions={actor.role !== "ADMIN" && !closed && <RaiseDisputeButton orderId={order.id} />}
      />

      {sp.created && (
        <Alert tone="success" className="mb-6">
          Order created from the accepted quotation. Production starts with fabric sourcing; the payment schedule is in the{" "}
          <a href="?tab=payments" className="font-medium underline underline-offset-4">Payments tab</a>.
        </Alert>
      )}
      {sp.payment === "returned" && <Alert tone="info" className="mb-6">You returned from the sandbox checkout. The payment status updates when the provider&apos;s webhook is received.</Alert>}

      <Panel className="mb-6" bodyClassName="p-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="type-heading text-ink">Production progress</h2>
          <div className="flex min-w-0 items-center gap-3">
            <span className="tabular text-[13px] text-ink-muted">
              <span className="font-medium text-ink">{doneCount}</span> of {total} stages complete
            </span>
            <ProgressBar value={doneCount} max={total} label={`${doneCount} of ${total} stages complete`} className="hidden w-28 sm:block" />
          </div>
        </div>
        {/* Phones: one line and a bar instead of an eight-row vertical stepper. */}
        <div className="mt-3 md:hidden">
          {!closed && current && (
            <p className="text-sm text-ink">
              <span className="text-ink-muted">Now: </span>
              <span className={cn("font-medium", currentLate && "text-warning-strong")}>{stageLabel(current.stage)}</span>
              <span className="tabular text-ink-muted"> · stage {STAGE_BY_KEY[current.stage].sequence} of {total}</span>
            </p>
          )}
          <ProgressBar value={doneCount} max={total} label={`${doneCount} of ${total} stages complete`} tone={currentLate ? "warning" : "accent"} className="mt-2 sm:hidden" />
        </div>
        <StageStepper stages={steps} label="Production stages" className="mt-5 hidden md:grid" />
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-line-subtle pt-4 min-[480px]:grid-cols-3 md:mt-5">
          <Fact
            label={closed ? (order.status === "DELIVERED" ? "Delivered" : "Closed") : "Estimated delivery"}
            hint={
              slipped ? (
                <span className="inline-flex items-center gap-1 font-medium text-danger-strong"><AlertTriangle className="size-3" aria-hidden />Agreed {formatDate(order.expectedCompletionDate)}</span>
              ) : closed ? undefined : (
                `Agreed ${formatDate(order.expectedCompletionDate)}`
              )
            }
          >
            <span className={cn("tabular", slipped && "text-danger-strong")}>{closed ? formatDate(order.deliveredAt) : formatDate(estimate)}</span>
          </Fact>
          <Fact label="Order value" hint={`${formatMoney(order.unitPrice, order.currency)} / unit`}>
            <span className="tabular">{formatMoney(order.totalAmount, order.currency)}</span>
          </Fact>
          <Fact label="Shipment" hint={order.shippedAt ? `Shipped ${formatDate(order.shippedAt)}` : undefined}>
            {order.trackingInfo ? order.trackingInfo : <span className="font-normal text-ink-muted">Not shipped yet</span>}
          </Fact>
        </dl>
      </Panel>

      <NextStepCard order={order} view={view} />

      <PageTabs tabs={tabs} active={tab} basePath={basePath} label="Order sections" />

      {tab === "production" && (
        <Panel id="production" title="Production milestones" description="Stages complete in order and cannot be skipped.">
          <MilestoneTracker
            milestones={milestones}
            currentStage={order.currentStage}
            closed={closed}
            currentNote={
              view.hasStageTask ? (
                <>
                  Your action for this stage is in{" "}
                  <a href="#next-step" className="rounded-sm font-medium text-accent-strong underline-offset-4 hover:underline">Your next step</a> above.
                </>
              ) : undefined
            }
          />
        </Panel>
      )}
      {tab === "samples" && <SamplesSection order={order} view={view} />}
      {tab === "payments" && <PaymentsSection order={order} view={view} />}
      {tab === "messages" && <MessagesSection order={order} view={view} actor={actor} />}
      {tab === "details" && <DetailsSection order={order} view={view} />}
      {tab === "activity" && <ActivitySection order={order} />}
    </>
  );
}
