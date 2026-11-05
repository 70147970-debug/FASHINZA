import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * Older links (for example notifications already stored in the database) point at in-page anchors such
 * as `/orders/x#payments`. Sections now live in tabs, so map the hash to the matching `?tab=`.
 */
export function LegacyHashTab({ map }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const tab = map[window.location.hash.slice(1)];
    if (tab) navigate(`${pathname}?tab=${tab}`, { replace: true, preventScrollReset: true });
  }, [map, pathname, navigate]);
  return null;
}
