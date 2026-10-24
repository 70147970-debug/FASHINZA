import type { Metadata } from "next";
import Link from "next/link";
import { Factory } from "lucide-react";
import type { VerificationStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/server/auth/session";
import { listFactories } from "@/server/services/admin";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { VERIFICATION_STATUS } from "@/lib/labels";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Factory verification" };

export default async function AdminFactoriesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  // The queue defaults to pending requests; "ALL" (or an empty filter) shows every factory.
  const status = (sp.status && sp.status in VERIFICATION_STATUS ? sp.status : sp.status === undefined ? "PENDING" : undefined) as VerificationStatus | undefined;
  const data = await listFactories(actor, { status, q: sp.q, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Factory verification" description="Review documents before approving. Only verified factories are matched to brand projects." />
      <FilterBar basePath="/admin/factories" q={sp.q} searchLabel="Search factories" selects={[{ name: "status", label: "Verification", value: status, options: Object.entries(VERIFICATION_STATUS).map(([value, s]) => ({ value, label: s.label })) }]} />
      {data.items.length === 0 ? (
        <EmptyState icon={Factory} title={status === "PENDING" ? "No factories waiting for review" : "No factories found"} description="Factories appear here after completing their profile." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-card">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Factory</th>
                  <th scope="col" className="px-4 py-3 font-medium">Location</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">MOQ</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Capacity / mo</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Documents</th>
                  <th scope="col" className="px-4 py-3 font-medium">Requested</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((f) => (
                  <tr key={f.id} className="hover:bg-canvas">
                    <td className="px-4 py-3"><Link href={`/admin/factories/${f.id}`} className="font-medium text-navy hover:underline">{f.businessName}</Link><p className="text-xs text-muted">{f.user.email}</p></td>
                    <td className="px-4 py-3">{f.city}, {f.country}</td>
                    <td className="tabular px-4 py-3 text-right">{formatNumber(f.minOrderQuantity)}</td>
                    <td className="tabular px-4 py-3 text-right">{formatNumber(f.maxMonthlyCapacity)}</td>
                    <td className="tabular px-4 py-3 text-right">{f._count.documents}</td>
                    <td className="px-4 py-3">{formatDate(f.verificationRequestedAt)}</td>
                    <td className="px-4 py-3"><StatusBadge map={VERIFICATION_STATUS} value={f.verificationStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/admin/factories" params={{ status: status ?? "ALL", q: sp.q }} />
        </>
      )}
    </>
  );
}
