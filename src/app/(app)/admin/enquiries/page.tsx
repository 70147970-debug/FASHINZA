import type { Metadata } from "next";
import { Mail } from "lucide-react";
import type { InquiryStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/server/auth/session";
import { listEnquiries } from "@/server/services/admin";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { EnquiryStatusForm } from "@/components/admin/admin-forms";
import { INQUIRY_STATUS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Contact enquiries" };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const status = sp.status && sp.status in INQUIRY_STATUS ? (sp.status as InquiryStatus) : undefined;
  const data = await listEnquiries(actor, { status, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Contact enquiries" description="Messages sent through the public contact form. Reply by email from your own mail client." />
      <FilterBar basePath="/admin/enquiries" selects={[{ name: "status", label: "Status", value: status, options: Object.entries(INQUIRY_STATUS).map(([value, s]) => ({ value, label: s.label })) }]} />
      {data.items.length === 0 ? (
        <EmptyState icon={Mail} title="No enquiries" description="Messages from the contact page appear here." />
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((e) => (
              <li key={e.id} className="rounded-lg border border-line bg-white p-4 shadow-card">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-navy">{e.subject}</p><StatusBadge map={INQUIRY_STATUS} value={e.status} /></div>
                    <p className="text-xs text-muted">{e.inquiryType} · {e.name}{e.company ? `, ${e.company}` : ""} · <a href={`mailto:${e.email}`} className="text-teal-700 hover:underline">{e.email}</a> · {formatDateTime(e.createdAt)}</p>
                  </div>
                  <EnquiryStatusForm id={e.id} status={e.status} />
                </div>
                <p className="mt-3 whitespace-pre-line text-sm">{e.message}</p>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/admin/enquiries" params={{ status }} />
        </>
      )}
    </>
  );
}
