import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { Logo } from "./logo";
import { SITE } from "@/lib/constants";

const columns = [
  {
    title: "Platform",
    links: [
      { href: "/how-it-works", label: "How It Works" },
      { href: "/for-brands", label: "For Brands" },
      { href: "/for-manufacturers", label: "For Manufacturers" },
      { href: "/sustainability", label: "Sustainability" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Login" },
      { href: "/register?role=brand", label: "Register as a brand" },
      { href: "/register?role=manufacturer", label: "Join as a manufacturer" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-navy text-white/75">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-14 sm:grid-cols-4 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))] lg:gap-8 lg:py-16">
        <div className="col-span-2 space-y-5 sm:col-span-4 lg:col-span-1">
          <Logo inverted />
          <p className="max-w-xs text-sm leading-6">{SITE.tagline} Connecting fashion brands with clothing manufacturers.</p>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center gap-2.5">
              <Mail className="size-4 shrink-0 text-white/50" aria-hidden />
              <a href={`mailto:${SITE.contactEmail}`} className="break-all rounded-sm transition-colors duration-150 hover:text-white">{SITE.contactEmail}</a>
            </li>
            <li className="flex items-center gap-2.5">
              <MapPin className="size-4 shrink-0 text-white/50" aria-hidden />
              {SITE.location}
            </li>
          </ul>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h2 className="label-caps mb-4 font-sans text-white/60">{col.title}</h2>
            <ul className="space-y-1 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-10 items-center rounded-sm transition-colors lg:min-h-8 duration-150 hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs leading-5 text-white/60 sm:flex-row sm:justify-between sm:gap-6">
          <p>© {new Date().getFullYear()} Fashinza. Final Year Project, Department of Software Engineering, The University of Lahore.</p>
          <p className="shrink-0">Demo platform — sample data is clearly labelled.</p>
        </div>
      </div>
    </footer>
  );
}
