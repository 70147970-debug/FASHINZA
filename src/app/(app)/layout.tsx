import { db } from "@/lib/db";
import { AppShell } from "@/components/app/app-shell";
import { requireUser } from "@/server/auth/session";
import { unreadCount } from "@/server/services/notifications";
import { signOutAction } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireUser();
  const [unread, org] = await Promise.all([
    unreadCount(actor),
    actor.role === "BRAND"
      ? db.brandProfile.findUnique({ where: { userId: actor.id }, select: { companyName: true } }).then((p) => p?.companyName ?? null)
      : actor.role === "MANUFACTURER"
        ? db.manufacturerProfile.findUnique({ where: { userId: actor.id }, select: { businessName: true } }).then((p) => p?.businessName ?? null)
        : Promise.resolve("Fashinza administration"),
  ]);
  return (
    <AppShell user={{ name: actor.name, email: actor.email, role: actor.role, org }} unread={unread} signOut={signOutAction}>
      {children}
    </AppShell>
  );
}
