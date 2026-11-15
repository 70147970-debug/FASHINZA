/**
 * Live link checks (src/lib/link-check.js) with mocked DNS and HTTP: no test here touches the network.
 * The one test of the real request primitive points it at a local server and expects the SSRF guard to refuse.
 */
import http from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AMBIGUOUS_OK_PLATFORMS,
  REQUEST_HEADERS,
  checkLink,
  classifyStatus,
  clearLinkCheckCache,
  defaultFetchOnce,
  guardedLookup,
  isPublicAddress,
  linkChecksEnabled,
} from "../../src/lib/link-check.js";
import { verifyProfileLinks } from "../../src/services/profiles.js";

const PUBLIC = [{ address: "93.184.216.34", family: 4 }];
const dnsError = (code = "ENOTFOUND") => Object.assign(new Error(`getaddrinfo ${code}`), { code });

/**
 * Fake network: `hosts` maps host → addresses (or an error code string), `pages` maps URL → { status, location }.
 * Records every lookup and fetch so tests can assert what was (not) contacted.
 */
function fakeNet({ hosts = {}, pages = {}, defaultAddresses = PUBLIC } = {}) {
  const looked = [];
  const fetched = [];
  return {
    looked,
    fetched,
    lookup: vi.fn(async (host) => {
      looked.push(host);
      const entry = hosts[host] ?? defaultAddresses;
      if (typeof entry === "string") throw dnsError(entry);
      return entry;
    }),
    fetchOnce: vi.fn(async (url) => {
      fetched.push(url);
      const page = pages[url];
      if (page instanceof Error) throw page;
      return page ?? { status: 200 };
    }),
  };
}

const run = (link, net, extra = {}) => checkLink(link, { enabled: true, useCache: false, lookup: net.lookup, fetchOnce: net.fetchOnce, ...extra });

beforeEach(() => clearLinkCheckCache());
afterEach(() => vi.unstubAllEnvs());

describe("switch", () => {
  it("is on by default, off with LINK_CHECK=off, and off under test runners unless switched on", () => {
    expect(linkChecksEnabled({})).toBe(true);
    expect(linkChecksEnabled({ LINK_CHECK: "off" })).toBe(false);
    expect(linkChecksEnabled({ LINK_CHECK: "on", NODE_ENV: "test" })).toBe(true);
    expect(linkChecksEnabled({ NODE_ENV: "test" })).toBe(false);
    expect(linkChecksEnabled({ VITEST: "true" })).toBe(false);
    expect(linkChecksEnabled({ NODE_ENV: "production" })).toBe(true);
  });

  it("returns SKIPPED without any network access when checks are off", async () => {
    const net = fakeNet();
    const r = await checkLink({ platform: "INSTAGRAM", url: "https://instagram.com/brand" }, { enabled: false, lookup: net.lookup, fetchOnce: net.fetchOnce });
    expect(r).toMatchObject({ status: "SKIPPED", message: "Not checked — automatic link checks are switched off." });
    expect(r.checkedAt).toBeInstanceOf(Date);
    expect(net.lookup).not.toHaveBeenCalled();
    expect(net.fetchOnce).not.toHaveBeenCalled();
  });

  it("is off in this test environment when nothing is passed", async () => {
    const r = await checkLink({ url: "https://brand-shop.com" });
    expect(r.status).toBe("SKIPPED");
  });
});

describe("classification", () => {
  it("maps final HTTP statuses", () => {
    expect(classifyStatus(200).status).toBe("FOUND");
    expect(classifyStatus(204).status).toBe("FOUND");
    expect(classifyStatus(404)).toEqual({ status: "NOT_FOUND", reason: "HTTP_NOT_FOUND" });
    expect(classifyStatus(410).status).toBe("NOT_FOUND");
    for (const code of [400, 401, 403, 429, 999]) expect(classifyStatus(code), String(code)).toEqual({ status: "UNCONFIRMED", reason: "BLOCKED_BY_SITE" });
    expect(classifyStatus(503)).toEqual({ status: "UNCONFIRMED", reason: "SERVER_ERROR" });
    expect(classifyStatus(418).status).toBe("UNCONFIRMED");
  });

  it("FOUND for a 2xx on the platform; 404/410 NOT_FOUND; blocking answers UNCONFIRMED", async () => {
    const net = fakeNet({
      pages: {
        "https://x.com/brand": { status: 200 },
        "https://x.com/gone": { status: 404 },
        "https://www.youtube.com/@gone": { status: 410 },
        "https://www.linkedin.com/company/brand": { status: 999 },
        "https://www.etsy.com/shop/brand": { status: 403 },
        "https://www.behance.net/brand": { status: 429 },
        "https://brand-shop.com/": { status: 502 },
      },
    });
    expect((await run({ platform: "X", url: "https://x.com/brand" }, net)).status).toBe("FOUND");
    expect(await run({ platform: "X", url: "https://x.com/gone" }, net)).toMatchObject({ status: "NOT_FOUND", message: "We couldn't find this page. Check the link and try again." });
    expect((await run({ platform: "YOUTUBE", url: "https://www.youtube.com/@gone" }, net)).status).toBe("NOT_FOUND");
    expect(await run({ platform: "LINKEDIN", url: "https://www.linkedin.com/company/brand" }, net)).toMatchObject({
      status: "UNCONFIRMED",
      message: "Couldn't confirm — the site blocks automatic checks.",
    });
    expect((await run({ platform: "ETSY", url: "https://www.etsy.com/shop/brand" }, net)).status).toBe("UNCONFIRMED");
    expect((await run({ platform: "BEHANCE", url: "https://www.behance.net/brand" }, net)).status).toBe("UNCONFIRMED");
    expect(await run({ url: "https://brand-shop.com/" }, net)).toMatchObject({ status: "UNCONFIRMED", reason: "SERVER_ERROR" });
  });

  it("does not claim FOUND for platforms that show every address the same page", async () => {
    expect(AMBIGUOUS_OK_PLATFORMS).toEqual(["INSTAGRAM", "FACEBOOK", "TIKTOK", "PINTEREST"]);
    const net = fakeNet({ pages: { "https://www.instagram.com/brand/": { status: 200 }, "https://www.instagram.com/gone/": { status: 404 } } });
    expect(await run({ platform: "INSTAGRAM", url: "https://www.instagram.com/brand/" }, net)).toMatchObject({ status: "UNCONFIRMED", reason: "BLOCKED_BY_SITE" });
    // A real 404 still counts.
    expect((await run({ platform: "INSTAGRAM", url: "https://www.instagram.com/gone/" }, net)).status).toBe("NOT_FOUND");
  });

  it("NOT_FOUND when the host name does not exist, UNCONFIRMED when DNS itself is unavailable", async () => {
    const missing = fakeNet({ hosts: { "no-such-brand-zz.com": "ENOTFOUND" } });
    expect(await run({ url: "https://no-such-brand-zz.com" }, missing)).toMatchObject({ status: "NOT_FOUND", reason: "DNS_NOT_FOUND" });
    expect(missing.looked).toEqual(["no-such-brand-zz.com", "example.com"]); // the canary proves DNS works
    expect(missing.fetchOnce).not.toHaveBeenCalled();

    clearLinkCheckCache();
    const offline = fakeNet({ hosts: { "no-such-brand-zz.com": "ENOTFOUND", "example.com": "ENOTFOUND" } });
    expect(await run({ url: "https://no-such-brand-zz.com" }, offline)).toMatchObject({ status: "UNCONFIRMED", reason: "NETWORK" });

    const flaky = fakeNet({ hosts: { "brand-shop.com": "EAI_AGAIN" } });
    expect(await run({ url: "https://brand-shop.com" }, flaky)).toMatchObject({ status: "UNCONFIRMED", reason: "NETWORK" });
  });

  it("UNCONFIRMED when the site does not answer within the time limit", async () => {
    const net = fakeNet();
    net.fetchOnce.mockImplementation(() => new Promise(() => {}));
    const r = await run({ url: "https://slow-brand.com" }, net, { timeoutMs: 50 });
    expect(r).toMatchObject({ status: "UNCONFIRMED", reason: "TIMEOUT", message: "Couldn't confirm — the site didn't answer in time." });
  });

  it("UNCONFIRMED on network errors", async () => {
    const net = fakeNet({ pages: { "https://brand-shop.com/": Object.assign(new Error("reset"), { code: "ECONNRESET" }) } });
    expect(await run({ url: "https://brand-shop.com/" }, net)).toMatchObject({ status: "UNCONFIRMED", reason: "NETWORK" });
  });
});

describe("redirects", () => {
  it("follows up to 3 redirects by hand and classifies where they land", async () => {
    const net = fakeNet({
      pages: {
        "https://youtu.be/abc": { status: 301, location: "https://www.youtube.com/watch?v=abc" },
        "https://www.youtube.com/watch?v=abc": { status: 200 },
      },
    });
    expect((await run({ platform: "YOUTUBE", url: "https://youtu.be/abc" }, net)).status).toBe("FOUND");
    expect(net.fetched).toEqual(["https://youtu.be/abc", "https://www.youtube.com/watch?v=abc"]);
  });

  it("stops after 3 redirects", async () => {
    const pages = {};
    for (let i = 0; i < 6; i++) pages[`https://brand-shop.com/${i}`] = { status: 302, location: `/${i + 1}` };
    const net = fakeNet({ pages });
    expect(await run({ url: "https://brand-shop.com/0" }, net)).toMatchObject({ status: "UNCONFIRMED", reason: "TOO_MANY_REDIRECTS" });
    expect(net.fetched).toHaveLength(4); // the link + 3 redirects
  });

  it("knows the platforms' not-found and sign-in redirects", async () => {
    const net = fakeNet({
      pages: {
        "https://www.linkedin.com/company/gone": { status: 302, location: "https://www.linkedin.com/company/unavailable/" },
        "https://www.instagram.com/brand/": { status: 302, location: "https://www.instagram.com/accounts/login/?next=/brand/" },
        "https://www.youtube.com/@brand": { status: 302, location: "https://consent.youtube.com/m?continue=x" },
        "https://www.etsy.com/shop/gone": { status: 301, location: "https://www.etsy.com/" },
        "https://brand-shop.com/old": { status: 301, location: "https://brand-shop.com/404.html" },
      },
    });
    expect(await run({ platform: "LINKEDIN", url: "https://www.linkedin.com/company/gone" }, net)).toMatchObject({ status: "NOT_FOUND", reason: "PLATFORM_NOT_FOUND" });
    expect(await run({ platform: "INSTAGRAM", url: "https://www.instagram.com/brand/" }, net)).toMatchObject({ status: "UNCONFIRMED", reason: "SIGN_IN_REQUIRED" });
    expect(await run({ platform: "YOUTUBE", url: "https://www.youtube.com/@brand" }, net)).toMatchObject({ status: "UNCONFIRMED", reason: "SIGN_IN_REQUIRED" });
    expect(await run({ platform: "ETSY", url: "https://www.etsy.com/shop/gone" }, net)).toMatchObject({ status: "UNCONFIRMED", reason: "REDIRECTED_HOME" });
    expect(await run({ url: "https://brand-shop.com/old" }, net)).toMatchObject({ status: "NOT_FOUND", reason: "PLATFORM_NOT_FOUND" });
    expect(net.fetched).not.toContain("https://consent.youtube.com/m?continue=x");
  });
});

describe("SSRF protection", () => {
  it("recognises private, loopback, link-local and reserved addresses", () => {
    for (const ip of ["93.184.216.34", "8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) expect(isPublicAddress(ip), ip).toBe(true);
    for (const ip of [
      "127.0.0.1", "10.1.2.3", "172.16.5.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1",
      "192.0.2.10", "::", "::1", "::ffff:127.0.0.1", "fe80::1%eth0", "fd00::1", "ff02::1", "64:ff9b::7f00:1", "2001:db8::1", "[::1]", "not-an-ip",
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it("refuses a website or Other link whose host resolves to a private address, before any request", async () => {
    const net = fakeNet({
      hosts: {
        "intranet.brand-shop.com": [{ address: "10.0.0.5", family: 4 }],
        "mixed.brand-shop.com": [...PUBLIC, { address: "127.0.0.1", family: 4 }],
        "v6.brand-shop.com": [{ address: "fd12::1", family: 6 }],
      },
    });
    for (const url of ["https://intranet.brand-shop.com/", "https://mixed.brand-shop.com/", "https://v6.brand-shop.com/"]) {
      expect(await run({ url }, net), url).toMatchObject({
        status: "NOT_FOUND",
        reason: "BLOCKED_ADDRESS",
        message: "This link points to a private or local network address. Use a public web address.",
      });
    }
    expect(await run({ platform: "OTHER", url: "https://intranet.brand-shop.com/" }, net)).toMatchObject({ reason: "BLOCKED_ADDRESS" });
    expect(net.fetchOnce).not.toHaveBeenCalled();
  });

  it("refuses IP literals in private ranges without a DNS lookup, and non-standard ports without any contact", async () => {
    const net = fakeNet();
    expect(await run({ url: "http://169.254.169.254/latest/meta-data/" }, net)).toMatchObject({ status: "NOT_FOUND", reason: "BLOCKED_ADDRESS" });
    expect(await run({ url: "http://[::1]/" }, net)).toMatchObject({ reason: "BLOCKED_ADDRESS" });
    expect(await run({ url: "https://brand-shop.com:8443/" }, net)).toMatchObject({ status: "UNCONFIRMED", reason: "PORT" });
    expect(await run({ url: "http://brand-shop.com:6379/" }, net)).toMatchObject({ reason: "PORT" });
    expect(net.lookup).not.toHaveBeenCalled();
    expect(net.fetchOnce).not.toHaveBeenCalled();
  });

  it("does not follow a redirect to a private address or a non-standard port", async () => {
    const net = fakeNet({
      hosts: { "rebind.brand-shop.com": [{ address: "192.168.0.10", family: 4 }] },
      pages: {
        "https://brand-shop.com/a": { status: 302, location: "http://127.0.0.1/admin" },
        "https://brand-shop.com/b": { status: 302, location: "https://rebind.brand-shop.com/" },
        "https://brand-shop.com/c": { status: 302, location: "https://brand-shop.com:2375/containers" },
      },
    });
    expect(await run({ url: "https://brand-shop.com/a" }, net)).toMatchObject({ reason: "BLOCKED_ADDRESS" });
    expect(await run({ url: "https://brand-shop.com/b" }, net)).toMatchObject({ reason: "BLOCKED_ADDRESS" });
    expect(await run({ url: "https://brand-shop.com/c" }, net)).toMatchObject({ reason: "PORT" });
    expect(net.fetched).toEqual(["https://brand-shop.com/a", "https://brand-shop.com/b", "https://brand-shop.com/c"]);
  });

  it("fetches platform links only on the platform's own hosts", async () => {
    const net = fakeNet({ pages: { "https://www.instagram.com/brand/": { status: 302, location: "https://tracker.example.net/collect" } } });
    expect(await run({ platform: "INSTAGRAM", url: "https://evil.example.net/instagram" }, net)).toMatchObject({ status: "NOT_FOUND", reason: "NOT_ON_PLATFORM" });
    expect(net.lookup).not.toHaveBeenCalled();
    expect(await run({ platform: "INSTAGRAM", url: "https://www.instagram.com/brand/" }, net)).toMatchObject({ status: "UNCONFIRMED", reason: "LEFT_PLATFORM" });
    expect(net.fetched).toEqual(["https://www.instagram.com/brand/"]);
  });

  it("treats a refusal at connection time (DNS rebinding) as a private address", async () => {
    const net = fakeNet({ pages: { "https://brand-shop.com/": Object.assign(new Error("blocked"), { code: "EBLOCKED" }) } });
    expect(await run({ url: "https://brand-shop.com/" }, net)).toMatchObject({ status: "NOT_FOUND", reason: "BLOCKED_ADDRESS" });
  });

  it("only allows http and https and never sends credentials", async () => {
    const net = fakeNet();
    expect((await run({ url: "file:///etc/passwd" }, net)).status).toBe("NOT_FOUND");
    expect((await run({ url: "https://user:pw@brand-shop.com/" }, net)).status).toBe("NOT_FOUND");
    expect(net.fetchOnce).not.toHaveBeenCalled();
    expect(REQUEST_HEADERS["User-Agent"]).toMatch(/^Mozilla\/5\.0 .*Chrome\/\d+/);
    expect(Object.keys(REQUEST_HEADERS).map((k) => k.toLowerCase())).not.toContain("cookie");
  });

  it("the real request primitive refuses to connect to localhost", async () => {
    let hits = 0;
    const server = http.createServer((_req, res) => {
      hits += 1;
      res.end("ok");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = /** @type {import("node:net").AddressInfo} */ (server.address());
    try {
      await expect(defaultFetchOnce(`http://localhost:${port}/`, { deadline: Date.now() + 2000 })).rejects.toMatchObject({ code: "EBLOCKED" });
      await expect(new Promise((resolve, reject) => guardedLookup("localhost", {}, (err, address) => (err ? reject(err) : resolve(address))))).rejects.toMatchObject({
        code: "EBLOCKED",
      });
      expect(hits).toBe(0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe("cache", () => {
  it("does not fetch the same link again right after a check", async () => {
    const net = fakeNet();
    const o = { enabled: true, lookup: net.lookup, fetchOnce: net.fetchOnce };
    await checkLink({ platform: "X", url: "https://x.com/brand" }, o);
    await checkLink({ platform: "X", url: "https://x.com/brand" }, o);
    expect(net.fetchOnce).toHaveBeenCalledTimes(1);
  });
});

describe("verifyProfileLinks (saving a profile)", () => {
  const at = new Date("2026-11-01T10:00:00Z");
  const fake = (byUrl) => vi.fn(async ({ url }) => ({ status: "FOUND", reason: "OK", message: "Link found.", checkedAt: at, ...byUrl[url] }));

  it("rejects NOT_FOUND links with field errors keyed by the row on screen, and stores the other results", async () => {
    const check = fake({
      "https://x.com/gone": { status: "NOT_FOUND", reason: "HTTP_NOT_FOUND" },
      "https://brand-shop.com": { status: "NOT_FOUND", reason: "BLOCKED_ADDRESS", message: "This link points to a private or local network address. Use a public web address." },
      "https://gone-brand.com": { status: "NOT_FOUND", reason: "DNS_NOT_FOUND" },
    });
    const input = {
      website: "https://gone-brand.com",
      socialLinks: [
        { platform: "X", url: "https://x.com/gone", row: 1 },
        { platform: "OTHER", url: "https://brand-shop.com", row: 3 },
        { platform: "YOUTUBE", url: "https://youtube.com/@brand", row: 4 },
      ],
    };
    await expect(verifyProfileLinks(null, input, { check })).rejects.toMatchObject({
      code: "INVALID",
      message: "Please correct the highlighted fields.",
      fieldErrors: {
        website: "We couldn't find this page. Check the link and try again.",
        "socialLinks.1.url": "We couldn't find this page. Check the link and try again.",
        "socialLinks.3.url": "This link points to a private or local network address. Use a public web address.",
      },
    });

    const ok = await verifyProfileLinks(null, { socialLinks: [{ platform: "LINKEDIN", url: "https://linkedin.com/company/brand", row: 0 }] }, {
      check: fake({ "https://linkedin.com/company/brand": { status: "UNCONFIRMED", reason: "BLOCKED_BY_SITE" } }),
    });
    expect(ok.socialLinks).toEqual([{ platform: "LINKEDIN", url: "https://linkedin.com/company/brand", check: { status: "UNCONFIRMED", checkedAt: at } }]);
  });

  it("re-uses the stored check of unchanged links and checks the website only when it changed", async () => {
    const recent = new Date(Date.now() - 86_400_000);
    const existing = {
      website: "https://brand-shop.com",
      socialLinks: [
        { platform: "X", url: "https://x.com/brand", check: { status: "FOUND", checkedAt: recent } },
        { platform: "YOUTUBE", url: "https://youtube.com/@brand", check: { status: "FOUND", checkedAt: new Date("2020-01-01") } },
      ],
    };
    const check = fake({});
    const r = await verifyProfileLinks(
      existing,
      {
        website: "https://brand-shop.com",
        socialLinks: [
          { platform: "X", url: "https://x.com/brand", row: 0 },
          { platform: "YOUTUBE", url: "https://youtube.com/@brand", row: 1 },
          { platform: "ETSY", url: "https://etsy.com/shop/brand", row: 2 },
        ],
      },
      { check },
    );
    expect(check.mock.calls.map(([l]) => l.url)).toEqual(["https://youtube.com/@brand", "https://etsy.com/shop/brand"]);
    expect(r.socialLinks[0].check).toEqual({ status: "FOUND", checkedAt: recent });
    await expect(verifyProfileLinks(null, {}, { check })).resolves.toEqual({ socialLinks: undefined });
  });

  it("checks a link stored as SKIPPED again once checks are switched on", async () => {
    const existing = { socialLinks: [{ platform: "X", url: "https://x.com/brand", check: { status: "SKIPPED", checkedAt: new Date() } }] };
    const input = { socialLinks: [{ platform: "X", url: "https://x.com/brand", row: 0 }] };
    const offCheck = fake({});
    await verifyProfileLinks(existing, input, { check: offCheck });
    expect(offCheck).not.toHaveBeenCalled();
    vi.stubEnv("LINK_CHECK", "on");
    const onCheck = fake({});
    expect((await verifyProfileLinks(existing, input, { check: onCheck })).socialLinks[0].check.status).toBe("FOUND");
    expect(onCheck).toHaveBeenCalledTimes(1);
  });
});
