import { Link } from "react-router";
import { Logo } from "./logo";
import { SITE } from "@fashinza/shared/constants.js";

const columns = [
  {
    title: "Manufacturing",
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
      { href: "/register?role=brand", label: "Start a project" },
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

/** Ivory colophon: wordmark and contact, four link columns over hairlines, an oversized Playfair masthead and the honest fine print. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-canvas text-ink-muted">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 pb-12 pt-14 sm:grid-cols-4 lg:grid-cols-12 lg:gap-8 lg:pt-20">
        <div className="col-span-2 space-y-4 sm:col-span-4 lg:col-span-4 lg:pr-8">
          <Logo />
          <p className="max-w-xs font-display text-lg leading-7 text-ink">Garment manufacturing for fashion brands, from first sample to final delivery.</p>
          <p className="max-w-xs text-sm leading-6">
            Factory sourcing, quotations, sample development, production tracking and quality inspection in one place.
          </p>
          <dl className="pt-1 text-sm">
            <div className="flex items-center gap-3">
              <dt className="w-[4.5rem] shrink-0 text-ink-muted">Email</dt>
              <dd className="min-w-0">
                <a
                  href={`mailto:${SITE.contactEmail}`}
                  className="inline-flex min-h-10 items-center break-all text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-accent"
                >
                  {SITE.contactEmail}
                </a>
              </dd>
            </div>
            <div className="flex items-center gap-3">
              <dt className="w-[4.5rem] shrink-0 text-ink-muted">Location</dt>
              <dd className="py-2.5 text-ink">{SITE.location}</dd>
            </div>
          </dl>
        </div>
        {columns.map((col) => (
          <div key={col.title} className="lg:col-span-2">
            <h2 className="label-caps mb-3 border-b border-line pb-3 font-sans text-ink-muted">{col.title}</h2>
            <ul className="text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link to={l.href} className="inline-flex min-h-10 items-center text-ink transition-colors duration-150 hover:text-accent-strong lg:min-h-9">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container-page overflow-hidden" aria-hidden>
        <p className="select-none border-t border-line pt-4 font-display text-[3.75rem] font-normal leading-[0.85] tracking-[-0.045em] text-ink sm:text-[7rem] lg:text-[11.5rem]">
          Fashinza<span className="text-accent">.</span>
        </p>
      </div>
      <div className="container-page">
        <div className="flex flex-col gap-2 border-t border-line py-6 text-xs leading-5 sm:flex-row sm:justify-between sm:gap-8">
          <p>© {new Date().getFullYear()} Fashinza. A Final Year Project at The University of Lahore.</p>
          <p className="sm:max-w-sm sm:text-right">
            Demonstration site: example data is labelled and payments are simulated, so no real money moves. Photographs are generic garment-industry images
            from Unsplash, credited on each photo.
          </p>
        </div>
      </div>
    </footer>
  );
}
