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
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
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
];

export function SiteFooter() {
  return (
    <footer className="bg-navy text-white/80">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo inverted />
          <p className="max-w-xs text-sm">{SITE.tagline} Connecting fashion brands with clothing manufacturers.</p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Mail className="size-4" aria-hidden />
              <a href={`mailto:${SITE.contactEmail}`} className="hover:text-white">{SITE.contactEmail}</a>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4" aria-hidden />
              {SITE.location}
            </li>
          </ul>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h2 className="mb-3 text-sm font-semibold text-white">{col.title}</h2>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-white/60 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Fashinza. Final Year Project, Department of Software Engineering, The University of Lahore.</p>
          <p>Demo platform — sample data is clearly labelled.</p>
        </div>
      </div>
    </footer>
  );
}
