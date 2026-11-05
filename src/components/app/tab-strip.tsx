"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const FADE = "2.5rem";
const MASKS = {
  end: `linear-gradient(to right, black calc(100% - ${FADE}), transparent)`,
  start: `linear-gradient(to left, black calc(100% - ${FADE}), transparent)`,
  both: `linear-gradient(to right, transparent, black ${FADE}, black calc(100% - ${FADE}), transparent)`,
} as const;

/**
 * Horizontal strip for link tabs (PageTabs, StatusTabs). It scrolls sideways when the tabs do not fit and
 * then fades the clipped edge, so a tab that starts off-screen still reads as "more this way". On load (and
 * whenever `active` changes) the selected tab (`aria-current="page"`) is scrolled into view inside the strip,
 * without moving the page. Without JavaScript it is a plain scrollable nav.
 */
export function TabStrip({ label, active, className, children }: { label: string; active?: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState<{ start: boolean; end: boolean }>({ start: false, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (current) {
      const box = el.getBoundingClientRect();
      const tab = current.getBoundingClientRect();
      const pad = 32;
      if (tab.right > box.right - pad) el.scrollLeft += tab.right - box.right + pad;
      else if (tab.left < box.left + pad) el.scrollLeft -= box.left + pad - tab.left;
    }
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const next = { start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 };
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [active]);

  const mask = edges.start && edges.end ? MASKS.both : edges.end ? MASKS.end : edges.start ? MASKS.start : undefined;
  return (
    <nav ref={ref} aria-label={label} className={cn("overflow-x-auto overscroll-x-contain", className)} style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}>
      {children}
    </nav>
  );
}
