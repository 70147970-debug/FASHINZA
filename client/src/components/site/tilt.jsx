import { useEffect, useRef } from "react";
import { cn } from "@fashinza/shared/utils.js";

/** Devices that tilt: a fine pointer that can hover (mouse, trackpad) and no reduced-motion preference. */
const TILT_QUERY = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/**
 * Pointer-driven 3D tilt with a glass sheen for photo cards (styles: `.tilt` in globals.css).
 *
 *   <Tilt className="rounded-lg"><Photo … /></Tilt>
 *   <Tilt as="article" max={3} className="rounded-xl …">…</Tilt>
 *
 * The card leans up to `max` degrees towards the pointer and a soft highlight follows it. Nothing is attached
 * on touch screens or under prefers-reduced-motion (and the CSS keeps those cards flat regardless). Pointer
 * moves are batched to one style write per animation frame, with no React re-render. Give the wrapper the
 * same radius as its content so the sheen is clipped to it. Children marked `.tilt-layer` inside a
 * `stack` float in front of the card at `--tilt-depth` (a layered 3D preview).
 */
export function Tilt({ as: Tag = "div", max = 5, sheen = true, stack = false, className, children, ...props }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(TILT_QUERY);
    let frame = 0;
    let pending = null;
    let attached = false;

    const write = () => {
      frame = 0;
      if (!pending) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.min(1, Math.max(0, (pending.x - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (pending.y - rect.top) / rect.height));
      el.style.setProperty("--tilt-rx", `${((0.5 - y) * max).toFixed(2)}deg`);
      el.style.setProperty("--tilt-ry", `${((x - 0.5) * max).toFixed(2)}deg`);
      el.style.setProperty("--tilt-x", `${(x * 100).toFixed(1)}%`);
      el.style.setProperty("--tilt-y", `${(y * 100).toFixed(1)}%`);
    };
    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      pending = { x: e.clientX, y: e.clientY };
      el.dataset.tilting = "";
      if (!frame) frame = requestAnimationFrame(write);
    };
    const onLeave = () => {
      pending = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      delete el.dataset.tilting;
      for (const p of ["--tilt-rx", "--tilt-ry", "--tilt-x", "--tilt-y"]) el.style.removeProperty(p);
    };
    const attach = () => {
      if (attached) return;
      attached = true;
      el.addEventListener("pointermove", onMove, { passive: true });
      el.addEventListener("pointerleave", onLeave, { passive: true });
    };
    const detach = () => {
      if (!attached) return;
      attached = false;
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      onLeave();
    };
    const sync = () => (query.matches ? attach() : detach());
    sync();
    query.addEventListener?.("change", sync);
    return () => {
      query.removeEventListener?.("change", sync);
      detach();
    };
  }, [max]);

  return (
    <Tag ref={ref} className={cn("tilt", stack && "tilt-stack", className)} {...props}>
      {children}
      {sheen && <span aria-hidden className="tilt-sheen" />}
    </Tag>
  );
}
