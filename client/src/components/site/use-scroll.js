import { useSyncExternalStore } from "react";

function subscribe(onChange) {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange, { passive: true });
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

/**
 * True once the window has scrolled further than `offset` px (a number, or a function of the viewport height).
 * Re-renders only when the answer changes, never on every scroll event.
 *
 *   const scrolled = useScrolledPast(8);
 *   const far = useScrolledPast((vh) => vh * 1.5);
 */
export function useScrolledPast(offset) {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > (typeof offset === "function" ? offset(window.innerHeight) : offset),
    () => false,
  );
}
