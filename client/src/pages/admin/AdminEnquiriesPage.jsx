import { Link, useLoaderData } from "react-router";
import { Mail } from "lucide-react";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { EnquiryStatusForm } from "@/components/admin/admin-forms";
import { StatusTabs } from "@/components/orders/order-parts";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/meta";
import { loadData, searchOf } from "@/lib/data";
import { INQUIRY_STATUS } from "@fashinza/shared/labels.js";
import { formatDateTime } from "@fashinza/shared/format.js";
import { cn } from "@fashinza/shared/utils.js";

/** /admin/enquiries — port of src/app/(app)/admin/enquiries/page.tsx (gate: user ADMIN). */

export async function loader({ request }) {
  const sp = searchOf(request);
  const status = sp.status && sp.status in INQUIRY_STATUS ? sp.status : undefined;
  const data = await loadData("/api/admin/enquiries", { request, query: { status, page: Number(sp.page) || 1 } });
  return { data, status };
}

export default function EnquiriesPage() {
  const { data, status } = useLoaderData();
  return (
    <>
      <PageMeta title="Contact enquiries" />
      <PageHeader
        eyebrow="Administration"
        title="Contact enquiries"
        description="Messages sent through the public contact form. Reply by email from your own mail client."
      />
      <StatusTabs
        basePath="/admin/enquiries"
        label="Enquiry status"
        value={status}
        options={Object.entries(INQUIRY_STATUS).map(([value, s]) => ({ value, label: s.label }))}
      />
      {data.items.length === 0 ? (
        <EmptyState
          icon={Mail}
          title={status ? `No ${INQUIRY_STATUS[status].label.toLowerCase()} enquiries` : "No enquiries"}
          description="Messages from the contact page appear here."
          action={
            status ? (
              <Button asChild variant="outline">
                <Link to="/admin/enquiries">Show all enquiries</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line bg-surface">
            {data.items.map((e) => (
              <li key={e.id} className={cn("relative px-4 py-4 sm:px-5", e.status === "NEW" && "bg-warning-soft/40")}>
                {e.status === "NEW" && <span className="absolute inset-y-0 left-0 w-[3px] bg-warning" aria-hidden />}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="flex min-w-0 gap-3">
                    <Avatar name={e.name} size="sm" tone="neutral" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-base font-medium text-ink">{e.subject}</h2>
                        <StatusBadge map={INQUIRY_STATUS} value={e.status} />
                        <Badge tone="outline">{e.inquiryType}</Badge>
                      </div>
                      <p className="mt-0.5 break-words text-xs leading-5 text-ink-muted">
                        <span className="font-medium text-ink">{e.name}</span>
                        {e.company ? `, ${e.company}` : ""} ·{" "}
                        <a href={`mailto:${e.email}`} className="break-all rounded-sm font-medium text-accent-strong underline-offset-4 hover:underline">
                          {e.email}
                        </a>{" "}
                        · <span className="tabular">{formatDateTime(e.createdAt)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 pl-10 sm:pl-0">
                    <EnquiryStatusForm id={e.id} status={e.status} />
                  </div>
                </div>
                <p className="mt-3 max-w-3xl whitespace-pre-line break-words pl-10 text-sm leading-6 text-ink">{e.message}</p>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/admin/enquiries" params={{ status }} />
        </>
      )}
    </>
  );
}
