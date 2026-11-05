import { Link, useLoaderData } from "react-router";
import { BadgeCheck, Users } from "lucide-react";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { UserStatusButton } from "@/components/admin/admin-forms";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/meta";
import { loadData, searchOf } from "@/lib/data";
import { ROLE_LABEL, USER_STATUS, VERIFICATION_STATUS } from "@fashinza/shared/labels.js";
import { formatDate } from "@fashinza/shared/format.js";

/** /admin/users — port of src/app/(app)/admin/users/page.tsx (gate: user ADMIN). */

/** Same words as the rest of the admin area ("Factory verification"). Keys stay the enum values. */
const ROLE = { ...ROLE_LABEL, MANUFACTURER: "Factory" };

export async function loader({ request, user }) {
  const sp = searchOf(request);
  const role = sp.role && sp.role in ROLE_LABEL ? sp.role : undefined;
  const status = sp.status && sp.status in USER_STATUS ? sp.status : undefined;
  const data = await loadData("/api/admin/users", { request, query: { q: sp.q, role, status, page: Number(sp.page) || 1 } });
  return { data, sp, role, status, actor: user };
}

function OrgLink({ profileId, org, className }) {
  return (
    <Link to={`/admin/factories/${profileId}`} className={className} aria-label={`${org}: open the factory record`}>
      {org}
    </Link>
  );
}

export default function AdminUsersPage() {
  const { data, sp, role, status, actor } = useLoaderData();
  const canChange = (u) => u.id !== actor.id && u.role !== "ADMIN";

  return (
    <>
      <PageMeta title="Users" />
      <PageHeader
        eyebrow="Administration"
        title="Users and organisations"
        description="Suspending an account signs it out immediately; its records are kept."
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/factories">
              <BadgeCheck /> Open the verification queue
            </Link>
          </Button>
        }
      />
      <FilterBar
        basePath="/admin/users"
        q={sp.q}
        searchLabel="Search name, email or organisation"
        selects={[
          { name: "role", label: "Role", value: role, options: Object.entries(ROLE).map(([value, label]) => ({ value, label })) },
          { name: "status", label: "Status", value: status, options: Object.entries(USER_STATUS).map(([value, s]) => ({ value, label: s.label })) },
        ]}
      />
      {data.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users found"
          description="Try a different search."
          action={
            sp.q || role || status ? (
              <Button asChild variant="outline">
                <Link to="/admin/users">Show all users</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <DataTable
            label="Users"
            cards={
              <MobileCardList>
                {data.items.map((u) => {
                  const org = u.brandProfile?.companyName ?? u.manufacturerProfile?.businessName;
                  return (
                    <MobileCard
                      key={u.id}
                      title={u.name}
                      badge={<StatusBadge map={USER_STATUS} value={u.status} />}
                      meta={
                        <>
                          <span className="block break-all">{u.email}</span>
                          {ROLE[u.role]}
                          {u.manufacturerProfile && org ? (
                            <>
                              {" · "}
                              <OrgLink profileId={u.manufacturerProfile.id} org={org} className="font-medium text-ink underline underline-offset-2" />
                            </>
                          ) : org ? (
                            ` · ${org}`
                          ) : (
                            ""
                          )}
                        </>
                      }
                    >
                      <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <span className="tabular text-xs text-ink-muted">
                          Joined {formatDate(u.createdAt)} · last sign-in {formatDate(u.lastLoginAt)}
                        </span>
                        {canChange(u) && <UserStatusButton userId={u.id} name={u.name} suspended={u.status === "SUSPENDED"} />}
                      </span>
                      {u.statusReason && <span className="mt-2 block text-xs leading-5 text-ink-muted">Reason: {u.statusReason}</span>}
                    </MobileCard>
                  );
                })}
              </MobileCardList>
            }
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Organisation</th>
                  <th scope="col">Role</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Last sign-in</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => {
                  const org = u.brandProfile?.companyName ?? u.manufacturerProfile?.businessName;
                  return (
                    <tr key={u.id}>
                      <td>
                        <span className="flex items-center gap-3">
                          <Avatar name={u.name} size="sm" tone={u.role === "ADMIN" ? "ink" : "neutral"} />
                          <span className="min-w-0">
                            <span className="block font-medium text-ink">{u.name}</span>
                            <span className="block whitespace-nowrap text-xs text-ink-muted">{u.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="text-[13px]">
                        {u.manufacturerProfile ? (
                          <span className="flex flex-wrap items-center gap-1.5">
                            <OrgLink profileId={u.manufacturerProfile.id} org={org ?? "Factory"} className="cell-primary rounded-sm" />
                            <StatusBadge map={VERIFICATION_STATUS} value={u.manufacturerProfile.verificationStatus} />
                          </span>
                        ) : (
                          (org ?? <span className="text-ink-muted">—</span>)
                        )}
                        {!u.profileCompleted && u.role !== "ADMIN" && <p className="mt-0.5 text-xs text-warning-strong">Profile incomplete</p>}
                      </td>
                      <td className="text-[13px]">{ROLE[u.role]}</td>
                      <td className="tabular whitespace-nowrap text-[13px] text-ink-muted">{formatDate(u.createdAt)}</td>
                      <td className="tabular whitespace-nowrap text-[13px] text-ink-muted">{formatDate(u.lastLoginAt)}</td>
                      <td>
                        <StatusBadge map={USER_STATUS} value={u.status} />
                        {u.statusReason && (
                          <p className="mt-1 max-w-48 truncate text-xs text-ink-muted" title={u.statusReason}>
                            {u.statusReason}
                          </p>
                        )}
                      </td>
                      <td className="text-right">{canChange(u) && <UserStatusButton userId={u.id} name={u.name} suspended={u.status === "SUSPENDED"} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/admin/users" params={{ q: sp.q, role, status }} />
        </>
      )}
    </>
  );
}
