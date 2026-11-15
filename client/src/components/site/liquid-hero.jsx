import { useEffect, useRef } from "react";
import { cn } from "@fashinza/shared/utils.js";

/**
 * The homepage hero's "liquid silk" layer: an aria-hidden, pointer-transparent box that the lazily loaded WebGL
 * module (liquid-silk.js, its own chunk) draws into. The hero's photograph, h1 and buttons render first and never
 * wait for it: the module is fetched only after the page's `load` event, when the browser is idle, and the
 * canvas fades in over the photo. Under prefers-reduced-motion (or Save-Data) nothing is loaded at all; if the
 * preference switches on later, the animation is torn down. Below 768px nothing is loaded either: on phones the
 * hero's copy covers the whole photo under a ≥65% scrim, so the silk would cost battery without being seen.
 * Without WebGL the photograph simply stays.
 *
 * `data-liquid` on the box reports the state: off | loading | running | paused | stopped | unsupported.
 */
export function LiquidHero({ className, opacity = 1 }) {
  const host = useRef(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const motion = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const wide = typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 768px)") : null;
    const allowed = () => !motion?.matches && (wide ? wide.matches : true);
    const saveData = Boolean(navigator.connection?.saveData);
    let dispose = null;
    let cancelled = false;
    let idle = 0;
    let timer = 0;
    let loading = false;

    const start = () => {
      idle = 0;
      timer = 0;
      if (cancelled || dispose || loading || !allowed()) return;
      loading = true;
      el.dataset.liquid = "loading";
      import("./liquid-silk.js")
        .then(({ mountLiquidSilk }) => {
          loading = false;
          if (cancelled || dispose) return;
          if (!allowed()) {
            el.dataset.liquid = "off";
            return;
          }
          dispose = mountLiquidSilk(el, { opacity });
        })
        .catch(() => {
          loading = false;
          if (!cancelled) el.dataset.liquid = "unsupported";
        });
    };
    const cancelPending = () => {
      if (idle) window.cancelIdleCallback?.(idle);
      if (timer) window.clearTimeout(timer);
      idle = 0;
      timer = 0;
    };
    const whenIdle = () => {
      cancelPending();
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(start, { timeout: 2000 });
      else timer = window.setTimeout(start, 600);
    };
    const onLoad = () => whenIdle();
    const schedule = () => {
      if (document.readyState === "complete") whenIdle();
      else window.addEventListener("load", onLoad, { once: true });
    };
    const teardown = () => {
      cancelPending();
      dispose?.();
      dispose = null;
      el.dataset.liquid = "off";
    };
    const onChange = () => (allowed() ? !saveData && schedule() : teardown());

    if (allowed() && !saveData) schedule();
    motion?.addEventListener?.("change", onChange);
    wide?.addEventListener?.("change", onChange);

    return () => {
      cancelled = true;
      window.removeEventListener("load", onLoad);
      cancelPending();
      motion?.removeEventListener?.("change", onChange);
      wide?.removeEventListener?.("change", onChange);
      teardown();
    };
  }, [opacity]);

  return <div ref={host} aria-hidden data-liquid="off" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} />;
}
