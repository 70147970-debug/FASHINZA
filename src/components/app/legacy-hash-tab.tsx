"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Older links (for example notifications already stored in the database) point at in-page anchors such
 * as `/orders/x#payments`. Sections now live in tabs, so map the hash to the matching `?tab=`.
 */
export function LegacyHashTab({ map }: { map: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const tab = map[window.location.hash.slice(1)];
    if (tab) router.replace(`${pathname}?tab=${tab}`, { scroll: false });
  }, [map, pathname, router]);
  return null;
}
