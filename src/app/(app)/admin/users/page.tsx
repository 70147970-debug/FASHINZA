import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import type { Role, UserStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/server/auth/session";
import { listUsers } from "@/server/services/admin";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { UserStatusButton } from "@/components/admin/admin-forms";
import { ROLE_LABEL, USER_STATUS, VERIFICATION_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const role = sp.role && sp.role in ROLE_LABEL ? (sp.role as Role) : undefined;
  const status = sp.status && sp.status in USER_STATUS ? (sp.status as UserStatus) : undefined;
  const data = await listUsers(actor, { q: sp.q, role, status, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Users and organisations" description="Suspending an account signs it out immediately; its records are kept." />
      <FilterBar
        basePath="/admin/users"
        q={sp.q}
        searchLabel="Search name, email or organisation"
        selects={[
          { name: "role", label: "Role", value: role, options: Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label })) },
          { name: "status", label: "Status", value: status, options: Object.entries(USER_STATUS).map(([value, s]) => ({ value, label: s.label })) },
        ]}
      />
      {data.items.length === 0 ? (
        <EmptyState icon={Users} title="No users found" description="Try a different search." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-card">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">User</th>
                  <th scope="col" className="px-4 py-3 font-medium">Organisation</th>
                  <th scope="col" className="px-4 py-3 font-medium">Role</th>
                  <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last sign-in</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((u) => {
                  const org = u.brandProfile?.companyName ?? u.manufacturerProfile?.businessName;
                  return (
                    <tr key={u.id}>
                      <td className="px-4 py-3"><p className="font-medium text-navy">{u.name}</p><p className="text-xs text-muted">{u.email}</p></td>
                      <td className="px-4 py-3">
                        {u.manufacturerProfile ? (
                          <span className="flex flex-wrap items-center gap-1">{org}<StatusBadge map={VERIFICATION_STATUS} value={u.manufacturerProfile.verificationStatus} /></span>
                        ) : (org ?? "—")}
                        {!u.profileCompleted && u.role !== "ADMIN" && <p className="text-xs text-muted">Profile incomplete</p>}
                      </td>
                      <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                      <td className="px-4 py-3">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3">{formatDate(u.lastLoginAt)}</td>
                      <td className="px-4 py-3"><StatusBadge map={USER_STATUS} value={u.status} />{u.statusReason && <p className="mt-0.5 max-w-48 truncate text-xs text-muted" title={u.statusReason}>{u.statusReason}</p>}</td>
                      <td className="px-4 py-3 text-right">{u.id !== actor.id && u.role !== "ADMIN" && <UserStatusButton userId={u.id} name={u.name} suspended={u.status === "SUSPENDED"} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/admin/users" params={{ q: sp.q, role, status }} />
        </>
      )}
      <p className="mt-4 text-xs text-muted">Need to review a factory? <Link href="/admin/factories" className="text-teal-700 hover:underline">Open the verification queue</Link>.</p>
    </>
  );
}
