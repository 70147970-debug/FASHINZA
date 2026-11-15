/**
 * Live link checks for profile social links and websites (decision 5): "is this page real?".
 *
 * A check opens the link like a browser would and classifies the answer:
 *   FOUND        2xx (or a redirect chain within the limit that ends in 2xx/3xx on the platform), except on
 *                platforms that show every address the same page to automatic visitors (below);
 *   NOT_FOUND    the host name does not exist (DNS), the final answer is 404/410, or the platform's known
 *                "page not found" redirect — also used for links that point to a private network address;
 *   UNCONFIRMED  401/403/429 (many social sites block automatic checks), sign-in walls, 5xx, timeouts,
 *                network errors and anything else we cannot read;
 *   SKIPPED      checks are switched off (LINK_CHECK=off): no network access at all.
 *
 * Request rules: GET with a normal browser User-Agent, no cookies, 5 s for the whole check, at most 3 redirects
 * (each followed by hand and checked again), headers only (the body is never read).
 *
 * Honesty rule: Instagram, Facebook, TikTok and Pinterest answer any address — real profile or not — with the
 * same generic page (or a bot check) when the visitor is not signed in, so a 2xx from them proves nothing and is
 * reported as UNCONFIRMED instead of FOUND. Their 404s and known "not found" redirects still count.
 *
 * SSRF protection:
 * - only http/https on the default ports (80/443), no credentials in the URL;
 * - links of a listed platform are only fetched while the host (and every redirect target) is on that platform's
 *   allow-list (@fashinza/shared/social.js); a redirect off the platform is not followed (UNCONFIRMED);
 * - every host (Other links, websites, and platform hosts too) is resolved first and refused when any address is
 *   private, loopback, link-local, CGNAT, multicast, documentation or otherwise reserved; the connection itself
 *   uses a guarded DNS lookup that repeats the test, so a host cannot switch to a private address in between
 *   (DNS rebinding).
 *
 * LINK_CHECK: "on" (default) or "off". When it is not set, checks are off under test runners (NODE_ENV=test or
 * VITEST) so automated tests never touch the network; the e2e environment sets LINK_CHECK=off explicitly.
 */
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import "../config.js";
import { LINK_CHECK_STATUS, LINK_NOT_FOUND_MESSAGE, hostAllowed, platformOf } from "@fashinza/shared/social.js";

export const LINK_CHECK_TIMEOUT_MS = 5000;
export const LINK_CHECK_MAX_REDIRECTS = 3;
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
/** Headers of every check request: a normal browser, and never a cookie or credentials. */
export const REQUEST_HEADERS = Object.freeze({
  "User-Agent": BROWSER_USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
});

/** Whether live checks run (LINK_CHECK=on|off; unset → on, except under test runners). */
export function linkChecksEnabled(env = process.env) {
  const v = String(env.LINK_CHECK ?? "").trim().toLowerCase();
  if (["off", "0", "false", "no"].includes(v)) return false;
  if (["on", "1", "true", "yes"].includes(v)) return true;
  return !(env.NODE_ENV === "test" || Boolean(env.VITEST));
}

// ---------------------------------------------------------------------------------------------------------------
// Address policy

const blockList = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (cloud metadata services live here)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
]) {
  blockList.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  // IPv4-mapped addresses (::ffff:a.b.c.d) are checked against the IPv4 rules by BlockList itself; a rule for
  // ::ffff:0:0/96 would also match every plain IPv4 address.
  ["64:ff9b::", 96], // NAT64
  ["64:ff9b:1::", 48], // local NAT64
  ["100::", 64], // discard
  ["2001::", 23], // IETF protocol assignments (Teredo, benchmarking, ORCHID)
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4
  ["3fff::", 20], // documentation
  ["5f00::", 16], // SRv6
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (deprecated)
  ["ff00::", 8], // multicast
]) {
  blockList.addSubnet(address, prefix, "ipv6");
}

/** True for an IP address that is reachable on the public internet (false for anything private or reserved). */
export function isPublicAddress(address) {
  const ip = String(address ?? "").replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const family = net.isIP(ip);
  if (!family) return false;
  return !blockList.check(ip, family === 4 ? "ipv4" : "ipv6");
}

// ---------------------------------------------------------------------------------------------------------------
// Network primitives (replaceable in tests)

/** Resolves a host name to all of its addresses: [{ address, family }]. */
export async function defaultLookup(hostname) {
  return dns.promises.lookup(hostname, { all: true, verbatim: true });
}

/** dns.lookup replacement for http(s).request that refuses non-public addresses at connection time. */
export function guardedLookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const opts = typeof options === "number" ? { family: options } : { ...options };
  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return callback(err);
    if (!addresses?.length) return callback(Object.assign(new Error(`No address for ${hostname}`), { code: "ENOTFOUND" }));
    if (addresses.some((a) => !isPublicAddress(a.address))) {
      return callback(Object.assign(new Error(`${hostname} resolves to a non-public address`), { code: "EBLOCKED" }));
    }
    if (opts.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

/**
 * One GET request, headers only. Resolves `{ status, location }`; rejects with a network error
 * (`code` ETIMEDOUT when the deadline passes, EBLOCKED when the guarded lookup refused the address).
 * @param {string} url
 * @param {{ deadline: number }} options
 */
export function defaultFetchOnce(url, { deadline }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(Object.assign(new Error("Link check timed out"), { code: "ETIMEDOUT" }));
    const client = target.protocol === "https:" ? https : http;
    let settled = false;
    const req = client.request(
      target,
      {
        method: "GET",
        agent: false,
        lookup: guardedLookup,
        // Hosts with IPv4 and IPv6 addresses: Node tries each address for only 250 ms by default before moving to
        // the next, so a distant site on a network without IPv6 would fail long before the 5 s budget is spent.
        // The first address gets half of the time that is left.
        autoSelectFamilyAttemptTimeout: Math.max(250, Math.floor(remaining / 2)),
        maxHeaderSize: 64 * 1024,
        headers: { ...REQUEST_HEADERS },
      },
      (res) => {
        settled = true;
        clearTimeout(timer);
        const location = typeof res.headers.location === "string" ? res.headers.location : undefined;
        resolve({ status: res.statusCode ?? 0, location });
        res.destroy();
      },
    );
    const timer = setTimeout(() => req.destroy(Object.assign(new Error("Link check timed out"), { code: "ETIMEDOUT" })), remaining);
    req.on("error", (err) => {
      clearTimeout(timer);
      if (!settled) reject(err);
    });
    req.end();
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Classification

const MESSAGES = Object.freeze({
  FOUND: "Link found.",
  NOT_FOUND: LINK_NOT_FOUND_MESSAGE,
  BLOCKED_ADDRESS: "This link points to a private or local network address. Use a public web address.",
  BLOCKED_BY_SITE: "Couldn't confirm — the site blocks automatic checks.",
  TIMEOUT: "Couldn't confirm — the site didn't answer in time.",
  SERVER_ERROR: "Couldn't confirm — the site had a problem answering.",
  NETWORK: "Couldn't confirm — we couldn't reach the site.",
  UNREADABLE: "Couldn't confirm — the site didn't show us the page.",
  PORT: "Couldn't confirm — we only check links on the standard web ports.",
  SKIPPED: "Not checked — automatic link checks are switched off.",
});

/** Statuses that mean "the site refuses automatic visitors" (999 is LinkedIn's bot answer). */
const BLOCKING_STATUSES = new Set([400, 401, 403, 405, 407, 429, 451, 999]);
/** Platforms whose 2xx answers to anonymous visitors look the same for every address (see the honesty rule). */
export const AMBIGUOUS_OK_PLATFORMS = Object.freeze(["INSTAGRAM", "FACEBOOK", "TIKTOK", "PINTEREST"]);

// Redirect targets that mean "sign in first" (the page may exist but is hidden from automatic checks).
const AUTH_PATH = /^\/(login|signin|sign-in|signup|sign-up|accounts\/login|uas\/login|authwall|checkpoint|i\/flow\/login|consent)(\/|$|\.)/i;
const AUTH_HOST = /^(login|accounts|auth|consent|signin)\./i;
// Redirect targets that mean "this page does not exist".
const NOT_FOUND_PATH = /(^|\/)(404|not-?found|page-?not-?found|pagenotfound|error\/404)(\/|\.html?|$)/i;
// LinkedIn sends missing company/school/person pages to /<kind>/unavailable/.
const PLATFORM_NOT_FOUND = { LINKEDIN: /^\/(company|in|school|showcase)\/unavailable\/?$/i };

/** True when a redirect target is a platform's known "page not found" page. */
export function isNotFoundRedirect(platform, target) {
  return NOT_FOUND_PATH.test(target.pathname) || Boolean(PLATFORM_NOT_FOUND[platform]?.test(target.pathname));
}

/** True when a redirect target is a sign-in or consent wall. */
export function isAuthWall(target) {
  return AUTH_PATH.test(target.pathname) || AUTH_HOST.test(target.hostname);
}

/**
 * Status of a final (non-redirect) HTTP answer.
 * @returns {{ status: string, reason: string }}
 */
export function classifyStatus(code) {
  if (code >= 200 && code < 400) return { status: "FOUND", reason: "OK" };
  if (code === 404 || code === 410) return { status: "NOT_FOUND", reason: "HTTP_NOT_FOUND" };
  if (BLOCKING_STATUSES.has(code)) return { status: "UNCONFIRMED", reason: "BLOCKED_BY_SITE" };
  if (code >= 500) return { status: "UNCONFIRMED", reason: "SERVER_ERROR" };
  return { status: "UNCONFIRMED", reason: "UNREADABLE" };
}

const REASON_MESSAGE = {
  OK: MESSAGES.FOUND,
  HTTP_NOT_FOUND: MESSAGES.NOT_FOUND,
  DNS_NOT_FOUND: MESSAGES.NOT_FOUND,
  PLATFORM_NOT_FOUND: MESSAGES.NOT_FOUND,
  INVALID_URL: MESSAGES.NOT_FOUND,
  BLOCKED_ADDRESS: MESSAGES.BLOCKED_ADDRESS,
  NOT_ON_PLATFORM: MESSAGES.NOT_FOUND,
  BLOCKED_BY_SITE: MESSAGES.BLOCKED_BY_SITE,
  SIGN_IN_REQUIRED: MESSAGES.BLOCKED_BY_SITE,
  TIMEOUT: MESSAGES.TIMEOUT,
  SERVER_ERROR: MESSAGES.SERVER_ERROR,
  NETWORK: MESSAGES.NETWORK,
  UNREADABLE: MESSAGES.UNREADABLE,
  LEFT_PLATFORM: MESSAGES.UNREADABLE,
  REDIRECTED_HOME: MESSAGES.UNREADABLE,
  TOO_MANY_REDIRECTS: MESSAGES.UNREADABLE,
  PORT: MESSAGES.PORT,
  OFF: MESSAGES.SKIPPED,
};

// ---------------------------------------------------------------------------------------------------------------
// Cache: a link checked with the "Check link" button is not fetched again when the profile is saved right after.

const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 500;
/** @type {Map<string, { expires: number, result: LinkCheckResult }>} */
const cache = new Map();

export function clearLinkCheckCache() {
  cache.clear();
  canary = null;
}

/** @type {{ ok: boolean, expires: number } | null} */
let canary = null;

/** Whether DNS works at all (so a failed lookup means "no such site" rather than "no network here"). */
async function dnsWorks(lookup, host) {
  if (canary && canary.expires > Date.now()) return canary.ok;
  let ok = false;
  try {
    ok = (await lookup(host)).length > 0;
  } catch {
    ok = false;
  }
  canary = { ok, expires: Date.now() + 60_000 };
  return ok;
}

/**
 * @typedef {object} LinkCheckResult
 * @property {"FOUND" | "NOT_FOUND" | "UNCONFIRMED" | "SKIPPED"} status
 * @property {string} reason machine-readable detail (DNS_NOT_FOUND, HTTP_NOT_FOUND, BLOCKED_ADDRESS, TIMEOUT, …)
 * @property {string} message user-facing sentence
 * @property {Date} checkedAt
 */

const withDeadline = (promise, deadline) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error("Link check timed out"), { code: "ETIMEDOUT" })), Math.max(0, deadline - Date.now()));
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });

const isIpLiteral = (hostname) => net.isIP(hostname.replace(/^\[|\]$/g, "")) !== 0;
const DNS_MISSING = new Set(["ENOTFOUND", "ENODATA", "EAI_NONAME", "NXDOMAIN"]);

/**
 * Checks one link live.
 * @param {{ platform?: string | null, url: string }} link `platform` = a SOCIAL_PLATFORMS value; omit it for a
 *   website (any public site, same rules as "Other")
 * @param {{ enabled?: boolean, lookup?: (host: string) => Promise<{ address: string, family: number }[]>,
 *   fetchOnce?: (url: string, o: { deadline: number }) => Promise<{ status: number, location?: string }>,
 *   timeoutMs?: number, maxRedirects?: number, useCache?: boolean, canaryHost?: string, now?: () => Date }} [options]
 * @returns {Promise<LinkCheckResult>}
 */
export async function checkLink(link, options = {}) {
  const {
    enabled = linkChecksEnabled(),
    lookup = defaultLookup,
    fetchOnce = defaultFetchOnce,
    timeoutMs = LINK_CHECK_TIMEOUT_MS,
    maxRedirects = LINK_CHECK_MAX_REDIRECTS,
    useCache = true,
    canaryHost = "example.com",
    now = () => new Date(),
  } = options;
  const done = (status, reason) => ({ status, reason, message: REASON_MESSAGE[reason] ?? LINK_CHECK_STATUS[status]?.label ?? "", checkedAt: now() });
  if (!enabled) return done("SKIPPED", "OFF");

  const platform = link.platform ? platformOf(link.platform) : null;
  // Listed platforms are fetched only on their own hosts; "Other" and websites may go anywhere public.
  const restricted = Boolean(platform?.hosts);
  const key = `${platform?.value ?? "WEBSITE"} ${link.url}`;
  if (useCache) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return { ...hit.result };
  }

  const result = await run();
  if (useCache) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { expires: Date.now() + CACHE_TTL_MS, result });
  }
  return { ...result };

  async function run() {
    let current;
    try {
      current = new URL(link.url);
    } catch {
      return done("NOT_FOUND", "INVALID_URL");
    }
    const startPath = current.pathname;
    const deadline = Date.now() + timeoutMs;
    for (let hop = 0; ; hop++) {
      // Policy for this hop.
      if (current.protocol !== "https:" && current.protocol !== "http:") return hop === 0 ? done("NOT_FOUND", "INVALID_URL") : done("UNCONFIRMED", "LEFT_PLATFORM");
      if (current.username || current.password) return hop === 0 ? done("NOT_FOUND", "INVALID_URL") : done("UNCONFIRMED", "UNREADABLE");
      if (current.port !== "") return done("UNCONFIRMED", "PORT");
      if (restricted && !hostAllowed(platform.value, current.hostname)) return hop === 0 ? done("NOT_FOUND", "NOT_ON_PLATFORM") : done("UNCONFIRMED", "LEFT_PLATFORM");

      if (isIpLiteral(current.hostname)) {
        if (!isPublicAddress(current.hostname)) return done("NOT_FOUND", "BLOCKED_ADDRESS");
      } else {
        let addresses;
        try {
          addresses = await withDeadline(Promise.resolve().then(() => lookup(current.hostname)), deadline);
        } catch (err) {
          if (err?.code === "ETIMEDOUT") return done("UNCONFIRMED", "TIMEOUT");
          if (DNS_MISSING.has(err?.code)) {
            if (hop > 0) return done("UNCONFIRMED", "NETWORK");
            return (await dnsWorks(lookup, canaryHost)) ? done("NOT_FOUND", "DNS_NOT_FOUND") : done("UNCONFIRMED", "NETWORK");
          }
          return done("UNCONFIRMED", "NETWORK");
        }
        if (!addresses?.length) return hop === 0 ? done("NOT_FOUND", "DNS_NOT_FOUND") : done("UNCONFIRMED", "NETWORK");
        if (addresses.some((a) => !isPublicAddress(a.address))) return done("NOT_FOUND", "BLOCKED_ADDRESS");
      }

      let response;
      try {
        response = await withDeadline(Promise.resolve().then(() => fetchOnce(current.href, { deadline })), deadline);
      } catch (err) {
        if (err?.code === "EBLOCKED") return done("NOT_FOUND", "BLOCKED_ADDRESS");
        if (err?.code === "ETIMEDOUT" || err?.code === "ESOCKETTIMEDOUT" || err?.name === "AbortError") return done("UNCONFIRMED", "TIMEOUT");
        return done("UNCONFIRMED", "NETWORK");
      }

      const code = Number(response?.status) || 0;
      const isRedirect = code >= 300 && code < 400 && code !== 304 && Boolean(response.location);
      if (!isRedirect) {
        const final = classifyStatus(code);
        if (final.status === "FOUND" && platform && AMBIGUOUS_OK_PLATFORMS.includes(platform.value)) return done("UNCONFIRMED", "BLOCKED_BY_SITE");
        return done(final.status, final.reason);
      }

      let next;
      try {
        next = new URL(response.location, current);
      } catch {
        return done("UNCONFIRMED", "UNREADABLE");
      }
      if (restricted) {
        if (isNotFoundRedirect(platform.value, next)) return done("NOT_FOUND", "PLATFORM_NOT_FOUND");
        if (isAuthWall(next)) return done("UNCONFIRMED", "SIGN_IN_REQUIRED");
        if (!hostAllowed(platform.value, next.hostname)) return done("UNCONFIRMED", "LEFT_PLATFORM");
        // A page sent back to the platform's home page cannot be told apart from a missing one.
        if (next.pathname === "/" && startPath !== "/" && !next.search) return done("UNCONFIRMED", "REDIRECTED_HOME");
      } else if (NOT_FOUND_PATH.test(next.pathname)) {
        return done("NOT_FOUND", "PLATFORM_NOT_FOUND");
      }
      if (hop >= maxRedirects) return done("UNCONFIRMED", "TOO_MANY_REDIRECTS");
      current = next;
    }
  }
}
