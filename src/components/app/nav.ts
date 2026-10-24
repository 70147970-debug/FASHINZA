import type { LucideIcon } from "lucide-react";
import {
  Bell, BadgeCheck, ClipboardList, CreditCard, Factory, FileSearch, FileText, Gauge, Inbox, LayoutDashboard, Mail, PackageSearch,
  ScrollText, Settings, ShieldAlert, Building2, Users, ScanSearch,
} from "lucide-react";
import type { Role } from "@/generated/prisma/enums";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };

export const NAV: Record<Role, NavGroup[]> = {
  BRAND: [
    { items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
    {
      label: "Production",
      items: [
        { href: "/projects", label: "Projects", icon: ClipboardList },
        { href: "/orders", label: "Orders", icon: PackageSearch },
        { href: "/payments", label: "Payments", icon: CreditCard },
        { href: "/disputes", label: "Disputes", icon: ShieldAlert },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/notifications", label: "Notifications", icon: Bell },
        { href: "/profile", label: "Company profile", icon: Building2 },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  MANUFACTURER: [
    { items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
    {
      label: "Sales",
      items: [
        { href: "/opportunities", label: "Opportunities", icon: FileSearch },
        { href: "/quotations", label: "Quotations", icon: FileText },
      ],
    },
    {
      label: "Production",
      items: [
        { href: "/orders", label: "Orders", icon: PackageSearch },
        { href: "/payments", label: "Payments", icon: CreditCard },
        { href: "/disputes", label: "Disputes", icon: ShieldAlert },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/notifications", label: "Notifications", icon: Bell },
        { href: "/factory", label: "Factory profile", icon: Factory },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  ADMIN: [
    { items: [{ href: "/admin", label: "Overview", icon: Gauge, exact: true }] },
    {
      label: "Operations",
      items: [
        { href: "/admin/factories", label: "Factory verification", icon: BadgeCheck },
        { href: "/admin/orders", label: "Orders", icon: PackageSearch },
        { href: "/admin/qc", label: "Quality issues", icon: ScanSearch },
        { href: "/admin/disputes", label: "Disputes", icon: ShieldAlert },
        { href: "/admin/payments", label: "Payment events", icon: CreditCard },
      ],
    },
    {
      label: "Platform",
      items: [
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/enquiries", label: "Contact enquiries", icon: Mail },
        { href: "/admin/audit", label: "Audit log", icon: ScrollText },
        { href: "/notifications", label: "Notifications", icon: Inbox },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
};

export function homeFor(role: Role) {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}
