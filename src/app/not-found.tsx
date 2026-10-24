import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/logo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <Logo className="mb-8" />
        <p className="text-sm font-semibold text-teal-700">404</p>
        <h1 className="mt-2 text-2xl font-semibold">We could not find that page</h1>
        <p className="mt-3 text-muted">The link may be out of date, or the page may have moved.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild><Link href="/">Go to home page</Link></Button>
          <Button asChild variant="outline"><Link href="/contact">Contact us</Link></Button>
        </div>
      </div>
    </main>
  );
}
