import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PAGE_PATHS, isKnownPage } from "../../src/lib/page-routes.js";

const routerFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../client/src/router.jsx");

/**
 * Page paths declared in client/src/router.jsx: page("…", …) calls (null is the index route "/") and plain
 * `{ path: "…", Component }` routes such as the /how-it-works → /user-guide redirect.
 */
function routerPaths() {
  const src = fs.readFileSync(routerFile, "utf8");
  const pages = [...src.matchAll(/\bpage\((null|"([^"]+)")\s*,/g)].map((m) => (m[1] === "null" ? "/" : `/${m[2]}`));
  const plain = [...src.matchAll(/\{\s*path:\s*"([^"*]+)",\s*Component:/g)].map((m) => `/${m[1]}`);
  return [...pages, ...plain];
}

describe("page routes known to the SPA fallback", () => {
  it("match the client router exactly", () => {
    const fromRouter = routerPaths();
    expect(fromRouter.length).toBeGreaterThan(40);
    expect([...PAGE_PATHS].sort()).toEqual([...fromRouter].sort());
  });

  it("recognises pages with parameters and trailing slashes, and nothing else", () => {
    expect(isKnownPage("/")).toBe(true);
    expect(isKnownPage("/projects/abc123/edit")).toBe(true);
    expect(isKnownPage("/orders/abc/")).toBe(true);
    expect(isKnownPage("/sandbox-checkout/sbx_1")).toBe(true);
    expect(isKnownPage("/projects/abc/other")).toBe(false);
    expect(isKnownPage("/nope")).toBe(false);
  });
});
