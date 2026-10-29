import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/logo";

export const metadata = { title: "Page not found" };

const LINKS = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/for-brands", label: "For Brands" },
  { href: "/for-manufacturers", label: "For Manufacturers" },
  { href: "/faq", label: "FAQ" },
];

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <div className="container-page flex h-16 items-center">
        <Logo />
      </div>
      <main id="main" className="grid flex-1 place-items-center px-4 pb-16">
        <div className="w-full max-w-xl text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-md border border-line bg-surface text-ink-muted">
            <Compass className="size-5" strokeWidth={1.5} aria-hidden />
          </span>
          <p className="eyebrow mt-7 text-accent-strong">Error 404</p>
          <h1 className="mt-3 text-balance font-display text-[2rem] font-medium leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.75rem]">We could not find that page</h1>
          <p className="mt-4 text-base leading-7 text-ink-muted">The link may be out of date, or the page may have moved.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg"><Link href="/"><ArrowLeft /> Go to home page</Link></Button>
            <Button asChild variant="outline" size="lg"><Link href="/contact">Contact us</Link></Button>
          </div>
          <nav aria-label="Popular pages" className="mt-12 border-t border-line pt-6">
            <p className="label-caps mb-3 text-ink-muted">Popular pages</p>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-10 items-center font-medium text-accent-strong underline-offset-4 hover:underline">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
    </div>
  );
}
