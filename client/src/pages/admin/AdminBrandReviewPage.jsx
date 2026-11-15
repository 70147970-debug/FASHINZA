import { Link, useLoaderData } from "react-router";
import { CalendarDays, Check, CircleDashed, ExternalLink, LogIn, Mail, MapPin } from "lucide-react";
import { DescriptionList, MetaItem, PageHeader, Panel, StatusBadge, Timeline } from "@/components/app/primitives";
import { UserStatusButton } from "@/components/admin/admin-forms";
import { BrandDecision } from "@/components/admin/brand-forms";
import { auditTimelineItem } from "@/components/admin/audit-parts";
import { BrandApprovalBadge } from "@/components/app/brand-approval";
import { SocialLinksList } from "@/components/profile/social-links";
import { Alert } from "@/components/ui/alert";
import { PageMeta } from "@/components/meta";
import { loadData } from "@/lib/data";
import { PROJECT_STATUS, USER_STATUS, categoryLabel } from "@fashinza/shared/labels.js";
import { formatDate, formatDateTime, formatNumber } from "@fashinza/shared/format.js";

/** Static page title, also shown when the record is not found (AppErrorBoundary). */
export const handle = { title: "Review brand" };

/** /admin/brands/:id — check a brand, then approve or reject it (gate: user ADMIN). GET /api/admin/brands/:id. */
export async function loader({ request, params }) {
  const data = await loadData(`/api/admin/brands/${params.id}`, { request });
  // Whole days since registration (for a brand still waiting).
  const days = Math.max(0, Math.floor((Date.now() - new Date(data.brand.createdAt).getTime()) / 86400000));
  return { ...data, days };
}

function CheckItem({ done, children }) {
  return (
    <li className="flex items-start gap-2 text-[13px] leading-5">
      {done ? (
        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-primary text-primary-fg" aria-hidden>
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      ) : (
        <CircleDashed className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      )}
      <span className={done ? "text-ink" : "text-warning-strong"}>{children}</span>
      <span className="sr-only">{done ? "(yes)" : "(no)"}</span>
    </li>
  );
}

function ExternalUrl({ href }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all rounded-sm font-medium text-accent-strong underline-offset-4 hover:underline">
      {href}
      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export default function AdminBrandReviewPage() {
  const { brand: b, profile: p, projects, history, days } = useLoaderData();
  const name = p?.companyName ?? b.name;
  const links = Array.isArray(p?.socialLinks) ? p.socialLinks : [];
  const place = [p?.city, p?.country].filter(Boolean).join(", ");
  const suspension = b.status === "SUSPENDED" ? history.find((h) => h.action === "USER_SUSPENDED") : undefined;

  return (
    <>
      <PageMeta title="Review brand" />
      <PageHeader
        eyebrow="Brand approval"
        title={name}
        breadcrumbs={[{ href: "/admin/brands", label: "Brand approvals" }]}
        meta={
          <>
            <BrandApprovalBadge status={b.approvalStatus} />
            {b.status !== "ACTIVE" && <StatusBadge map={USER_STATUS} value={b.status} />}
          </>
        }
        metaRow={
          <>
            {place && <MetaItem icon={MapPin}>{place}</MetaItem>}
            <MetaItem icon={Mail}>{b.email}</MetaItem>
            <MetaItem icon={CalendarDays}>Registered {formatDate(b.createdAt)}</MetaItem>
            {b.lastLoginAt && <MetaItem icon={LogIn}>Last signed in {formatDateTime(b.lastLoginAt)}</MetaItem>}
          </>
        }
        actions={
          <>
            <BrandDecision brandId={b.id} name={name} status={b.approvalStatus} />
            <UserStatusButton userId={b.id} name={name} suspended={b.status === "SUSPENDED"} size="md" />
          </>
        }
      />

      {b.approvalStatus === "PENDING" && (
        <Alert tone="warning" title={days === 0 ? "Registered today — waiting for approval" : `Waiting for approval for ${days} day${days === 1 ? "" : "s"}`} className="mb-6">
          The brand can edit its profile but cannot create projects until you approve it. Check that the company and its website or social media
          are genuine, then approve or reject it.
        </Alert>
      )}
      {b.approvalStatus === "REJECTED" && (
        <Alert tone="error" title="Not approved" className="mb-6">
          {b.approvalNote ?? "No reason was recorded."}
          {b.approvalReviewedAt && (
            <span className="text-ink-muted">
              {" · "}
              {b.approvalReviewedBy?.name ?? "An administrator"}, {formatDateTime(b.approvalReviewedAt)}
            </span>
          )}
        </Alert>
      )}
      {b.approvalStatus === "APPROVED" && b.approvalReviewedAt && (
        <Alert tone="success" title="Verified brand" className="mb-6">
          Approved by {b.approvalReviewedBy?.name ?? "an administrator"} on {formatDateTime(b.approvalReviewedAt)}.{b.approvalNote ? ` Note: ${b.approvalNote}` : ""}
        </Alert>
      )}
      {b.status === "SUSPENDED" && (
        <Alert tone="warning" title="Account suspended" className="mb-6">
          {b.statusReason ?? suspension?.reason ?? "No reason was recorded."}
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Company profile" description={b.profileCompleted ? "As entered by the brand." : "The brand has not completed its company profile yet."}>
            <DescriptionList
              items={[
                { label: "Company name", value: p?.companyName },
                { label: "Country", value: p?.country || null },
                { label: "City", value: p?.city },
                { label: "Phone", value: p?.phone ? <span className="tabular">{p.phone}</span> : null },
                { label: "Description", value: p?.description ? <span className="whitespace-pre-line">{p.description}</span> : null, full: true },
              ]}
            />
          </Panel>

          <Panel title="Website and social media" description="Open each link to confirm it belongs to this brand.">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium leading-4 text-ink-muted">Website</p>
                <p className="mt-1 text-sm">{p?.website ? <ExternalUrl href={p.website} /> : <span className="text-ink-muted">No website given.</span>}</p>
              </div>
              <div className="border-t border-line-subtle pt-4">
                <p className="mb-2 text-xs font-medium leading-4 text-ink-muted">Social media</p>
                <SocialLinksList links={links} empty="No social links added." />
              </div>
            </div>
          </Panel>

          <Panel title="Review history" description="Decisions on this brand's account, newest first.">
            <Timeline items={history.map((h) => auditTimelineItem(h, formatDateTime(h.createdAt), { selfIds: [b.id], href: `/admin/brands/${b.id}` }))} empty="No decisions recorded yet." />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Review checklist">
            <ul className="space-y-2" aria-label="Review checklist">
              <CheckItem done={b.profileCompleted}>Company profile completed</CheckItem>
              <CheckItem done={Boolean(p?.website) || links.length > 0}>Website or social media link given</CheckItem>
              <CheckItem done={Boolean(p?.description)}>Company description given</CheckItem>
            </ul>
            <p className="mt-3 text-xs leading-5 text-ink-muted">These are the facts the brand gave; confirming they are genuine is up to you.</p>
          </Panel>

          <Panel title="Account">
            <DescriptionList
              layout="rows"
              items={[
                { label: "Contact person", value: b.name },
                { label: "Email", value: <span className="break-all">{b.email}</span> },
                { label: "Registered", value: <span className="tabular">{formatDate(b.createdAt)}</span> },
                { label: "Last signed in", value: b.lastLoginAt ? <span className="tabular">{formatDate(b.lastLoginAt)}</span> : "Not yet" },
                { label: "Account status", value: <StatusBadge map={USER_STATUS} value={b.status} /> },
              ]}
            />
          </Panel>

          <Panel title="Projects" description={`${formatNumber(projects.total)} project${projects.total === 1 ? "" : "s"} · ${formatNumber(projects.activeOrders)} active order${projects.activeOrders === 1 ? "" : "s"}`}>
            {projects.recent.length === 0 ? (
              <p className="text-sm text-ink-muted">No projects yet.</p>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {projects.recent.map((pr) => (
                  <li key={pr.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="min-w-0">
                      <Link to={`/projects/${pr.id}`} className="block truncate rounded-sm text-sm font-medium text-ink underline-offset-4 hover:underline">
                        {pr.name}
                      </Link>
                      <span className="block text-xs text-ink-muted">
                        {categoryLabel(pr.category)} · updated {formatDate(pr.updatedAt)}
                      </span>
                    </span>
                    <StatusBadge map={PROJECT_STATUS} value={pr.status} />
                  </li>
                ))}
              </ul>
            )}
            {projects.total > projects.recent.length && (
              <p className="mt-3 text-[13px]">
                <Link to={`/admin/projects?q=${encodeURIComponent(name)}`} className="font-medium text-accent-strong underline-offset-4 hover:underline">
                  All {formatNumber(projects.total)} projects
                </Link>
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
