import { ArrowUp } from "lucide-react";
import { cn } from "@fashinza/shared/utils.js";
import { useScrolledPast } from "./use-scroll";

/**
 * Floating "Back to top" button for long public pages: a small glass disc in the bottom-right corner that
 * appears once the visitor is more than 1.5 screens down. It scrolls smoothly (instantly under reduced motion)
 * and moves keyboard focus to the site header's first link, so the next Tab starts from the top. While hidden it
 * is inert, so it never catches a tap or a Tab.
 */
export function BackToTop() {
  const visible = useScrolledPast((vh) => vh * 1.5);

  function toTop() {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    document.querySelector("header a[href]")?.focus({ preventScroll: true });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      title="Back to top"
      inert={visible ? undefined : true}
      className={cn(
        "glass-strong fixed bottom-4 right-4 z-30 grid size-11 place-items-center rounded-full border border-line text-ink transition-[opacity,translate,color] duration-300 hover:text-accent-strong sm:bottom-6 sm:right-6",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowUp className="size-5" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
