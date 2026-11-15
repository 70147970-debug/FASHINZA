/**
 * Social media links on brand and factory profiles (BrandProfile.socialLinks, ManufacturerProfile.socialLinks).
 *
 * A profile can list up to 8 links, at most one per platform except "Other". Rules for a link (validate()):
 * - The scheme may be left out: "instagram.com/yourbrand" is read as "https://instagram.com/yourbrand".
 * - Links must be secure. For the listed platforms, which all serve https, an "http://" link is upgraded to
 *   "https://"; an "Other" link must start with https:// (we cannot know the site supports it).
 * - No spaces, no user name or password, no port number, at most 300 characters.
 * - The host must belong to the chosen platform (subdomains such as www. and m. are fine) and the link must
 *   point to a page on it (not the platform's home, sign-in or menu pages).
 * - "Other" takes any public https website (a domain name, not an IP address or a local/test name). A link to a
 *   listed platform under "Other" is refused with a hint to pick that platform.
 *
 * Whether the page really exists is checked by the server when the link is saved (server/src/lib/link-check.js);
 * the result is stored as `check: { status, checkedAt }` with a status from LINK_CHECK_STATUSES.
 */
import { z } from "zod";

export const SOCIAL_LIMITS = Object.freeze({ links: 8, urlLength: 300 });

/**
 * @typedef {object} SocialPlatform
 * @property {string} value stored value
 * @property {string} label shown in the select and lists
 * @property {string} article "a" / "an" before the label in messages
 * @property {readonly string[] | null} hosts allowed hostnames (subdomains included); null = any public site
 * @property {string} example placeholder and example in error messages
 */

/** @type {readonly SocialPlatform[]} */
export const SOCIAL_PLATFORMS = Object.freeze([
  { value: "INSTAGRAM", label: "Instagram", article: "an", hosts: ["instagram.com"], example: "https://instagram.com/yourbrand" },
  { value: "FACEBOOK", label: "Facebook", article: "a", hosts: ["facebook.com", "fb.com"], example: "https://facebook.com/yourbrand" },
  { value: "LINKEDIN", label: "LinkedIn", article: "a", hosts: ["linkedin.com"], example: "https://linkedin.com/company/yourbrand" },
  { value: "TIKTOK", label: "TikTok", article: "a", hosts: ["tiktok.com"], example: "https://tiktok.com/@yourbrand" },
  { value: "X", label: "X (Twitter)", article: "an", hosts: ["x.com", "twitter.com"], example: "https://x.com/yourbrand" },
  { value: "PINTEREST", label: "Pinterest", article: "a", hosts: ["pinterest.com", "pin.it"], example: "https://pinterest.com/yourbrand" },
  { value: "YOUTUBE", label: "YouTube", article: "a", hosts: ["youtube.com", "youtu.be"], example: "https://youtube.com/@yourbrand" },
  { value: "BEHANCE", label: "Behance", article: "a", hosts: ["behance.net"], example: "https://behance.net/yourstudio" },
  { value: "ETSY", label: "Etsy", article: "an", hosts: ["etsy.com"], example: "https://etsy.com/shop/yourshop" },
  { value: "OTHER", label: "Other", article: "an", hosts: null, example: "https://yourbrand.com" },
].map((p) => Object.freeze({ ...p, hosts: p.hosts ? Object.freeze(p.hosts) : null })));

export const SOCIAL_PLATFORM_VALUES = Object.freeze(SOCIAL_PLATFORMS.map((p) => p.value));

/** Live check results (decision 5). SKIPPED = checks are switched off (LINK_CHECK=off). */
export const LINK_CHECK_STATUSES = Object.freeze(["FOUND", "NOT_FOUND", "UNCONFIRMED", "SKIPPED"]);

/** Label and badge tone per check status. */
export const LINK_CHECK_STATUS = Object.freeze({
  FOUND: { label: "Link found", tone: "success" },
  NOT_FOUND: { label: "Page not found", tone: "danger" },
  UNCONFIRMED: { label: "Couldn't confirm — the site blocks automatic checks", tone: "warning" },
  SKIPPED: { label: "Not checked", tone: "neutral" },
});

/** Field error used when the live check finds no page (on save). */
export const LINK_NOT_FOUND_MESSAGE = "We couldn't find this page. Check the link and try again.";

/** @param {string | null | undefined} value @returns {SocialPlatform | undefined} */
export function platformOf(value) {
  return SOCIAL_PLATFORMS.find((p) => p.value === value);
}

/** Label of a stored platform value ("Other" for anything unknown). */
export function platformLabel(value) {
  return platformOf(value)?.label ?? "Other";
}

/** True when `hostname` is `domain` or one of its subdomains. */
export function hostMatches(hostname, domain) {
  const h = String(hostname).toLowerCase().replace(/\.$/, "");
  return h === domain || h.endsWith(`.${domain}`);
}

/** The listed platform (not "Other") whose hosts include `hostname`, if any. */
export function platformForHost(hostname) {
  return SOCIAL_PLATFORMS.find((p) => p.hosts?.some((d) => hostMatches(hostname, d)));
}

/** True when `hostname` is allowed for the platform (any host for "Other"). */
export function hostAllowed(platform, hostname) {
  const p = platformOf(platform);
  if (!p) return false;
  return p.hosts === null || p.hosts.some((d) => hostMatches(hostname, d));
}

/** The platform a typed link belongs to (for pre-selecting the platform), or undefined. */
export function detectPlatform(raw) {
  const u = parseLoose(raw);
  return u ? platformForHost(u.hostname)?.value : undefined;
}

// First path segments that are the platform's own menu, sign-in or search pages rather than a brand's page.
const RESERVED_SEGMENTS = new Set([
  "login", "signin", "sign-in", "signup", "sign-up", "register", "accounts", "account", "settings", "explore", "home", "search", "help", "policies", "privacy", "legal", "terms",
]);

// Names that never resolve on the public internet (RFC 2606/6761 and common private suffixes).
const PRIVATE_SUFFIXES = ["localhost", "local", "internal", "intranet", "lan", "home", "corp", "test", "example", "invalid", "onion", "arpa"];

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** URL from user input with "https://" added when no scheme was typed; null when it cannot be read. */
function parseLoose(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    return new URL(SCHEME.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
}

const isIpHost = (hostname) => /^\[.*\]$/.test(hostname) || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || /^[\d.]+$/.test(hostname) || /^0x/i.test(hostname);

/**
 * Checks a link and normalises it.
 * @param {string} platform a SOCIAL_PLATFORMS value
 * @param {string} raw the link as typed
 * @returns {{ error: string, url?: undefined } | { error: null, url: string }}
 */
export function checkSocialUrl(platform, raw) {
  const p = platformOf(platform);
  if (!p) return { error: "Choose a platform from the list." };
  const like = `Use a URL like ${p.example}.`;
  const s = String(raw ?? "").trim();
  if (!s) return { error: "Enter the link to your page, or remove this row." };
  if (s.length > SOCIAL_LIMITS.urlLength) return { error: `Keep the link under ${SOCIAL_LIMITS.urlLength} characters.` };
  if (/\s/.test(s)) return { error: "Remove the spaces from the link." };
  if (s.startsWith("@")) return { error: `Enter the full link to your page, not just your handle. ${like}` };

  let text = s;
  const scheme = SCHEME.exec(text)?.[0].toLowerCase();
  if (!scheme) text = `https://${text}`;
  else if (scheme === "http://") {
    if (p.hosts === null) return { error: "Use a secure link that starts with https://." };
    text = `https://${text.slice(scheme.length)}`;
  } else if (scheme !== "https://") return { error: `Enter a web link that starts with https://. ${like}` };

  let u;
  try {
    u = new URL(text);
  } catch {
    return { error: `Enter a full link. ${like}` };
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (u.username || u.password) return { error: "Remove the user name or password from the link." };
  if (u.port) return { error: "Remove the port number from the link." };
  if (!host || isIpHost(host)) return { error: `Use the site's web address (like ${p.example}), not an IP address.` };

  if (p.hosts === null) {
    const labels = host.split(".");
    const tld = labels[labels.length - 1];
    if (labels.length < 2 || labels.some((l) => !l) || !/^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(tld) || PRIVATE_SUFFIXES.includes(tld)) {
      return { error: `Use a public web address, like ${p.example}.` };
    }
    const listed = platformForHost(host);
    if (listed) return { error: `This is ${listed.article} ${listed.label} link. Choose ${listed.label} as the platform.` };
  } else {
    if (!p.hosts.some((d) => hostMatches(host, d))) return { error: `This isn't ${p.article} ${p.label} link. ${like}` };
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length === 0 && !u.search) return { error: `Link to your own ${p.label} page, not the ${p.label} home page. ${like}` };
    if (segments.length > 0 && RESERVED_SEGMENTS.has(segments[0].toLowerCase())) {
      return { error: `This goes to a ${p.label} menu or sign-in page. Link to your own page instead. ${like}` };
    }
  }

  let url = u.href;
  // Keep "https://yourbrand.com" as typed rather than "https://yourbrand.com/".
  if (u.pathname === "/" && !u.search && !u.hash && url.endsWith("/")) url = url.slice(0, -1);
  if (url.length > SOCIAL_LIMITS.urlLength) return { error: `Keep the link under ${SOCIAL_LIMITS.urlLength} characters.` };
  return { error: null, url };
}

/**
 * Field error for a link, or null when it is acceptable.
 * @param {string} platform
 * @param {string} url
 * @returns {string | null}
 */
export function validate(platform, url) {
  return checkSocialUrl(platform, url).error;
}

/** The normalised link (scheme added, http upgraded for listed platforms), or null when it is not acceptable. */
export function normalizeSocialUrl(platform, url) {
  const r = checkSocialUrl(platform, url);
  return r.error ? null : r.url;
}

const text = (max) => z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((v) => (v == null ? "" : String(v).trim().slice(0, max)));

/**
 * The social links of a profile form. Rows left completely empty are ignored but keep their position, so error
 * keys (`socialLinks.<row>.platform`, `socialLinks.<row>.url`) line up with the rows on screen. Output: the
 * filled rows as `{ platform, url, row }`, with `url` normalised and `row` = the row's index in the request
 * (used for error keys by the server; not stored). Undefined stays undefined (the stored list is kept).
 */
export const socialLinksSchema = z
  .array(z.object({ platform: text(40), url: text(SOCIAL_LIMITS.urlLength + 100) }), { invalid_type_error: "Send the social links as a list." })
  .max(50, `Add up to ${SOCIAL_LIMITS.links} social links.`)
  .superRefine((rows, ctx) => {
    const filled = rows.filter((r) => r.platform || r.url);
    if (filled.length > SOCIAL_LIMITS.links) ctx.addIssue({ code: "custom", path: [], message: `Add up to ${SOCIAL_LIMITS.links} social links.` });
    /** @type {Set<string>} */
    const platforms = new Set();
    /** @type {Set<string>} */
    const urls = new Set();
    rows.forEach((r, i) => {
      if (!r.platform && !r.url) return;
      const p = platformOf(r.platform);
      if (!r.platform) {
        ctx.addIssue({ code: "custom", path: [i, "platform"], message: "Choose the platform for this link." });
      } else if (!p) {
        ctx.addIssue({ code: "custom", path: [i, "platform"], message: "Choose a platform from the list." });
      } else if (p.value !== "OTHER" && platforms.has(p.value)) {
        ctx.addIssue({ code: "custom", path: [i, "platform"], message: `You've already added ${p.article} ${p.label} link. Use one link per platform, or choose Other.` });
      }
      if (p) platforms.add(p.value);
      if (!p) return;
      const checked = checkSocialUrl(p.value, r.url);
      if (checked.error) {
        ctx.addIssue({ code: "custom", path: [i, "url"], message: checked.error });
        return;
      }
      const key = checked.url.toLowerCase().replace(/\/+$/, "");
      if (urls.has(key)) ctx.addIssue({ code: "custom", path: [i, "url"], message: "You've already added this link." });
      urls.add(key);
    });
  })
  .transform((rows) =>
    rows
      .map((r, row) => ({ platform: r.platform, url: r.url, row }))
      .filter((r) => r.platform || r.url)
      .map((r) => ({ platform: r.platform, url: /** @type {string} */ (normalizeSocialUrl(r.platform, r.url)), row: r.row })),
  )
  .optional();

/**
 * The POST /api/profile/check-link body.
 */
export const checkLinkSchema = z
  .object({ platform: text(40), url: text(SOCIAL_LIMITS.urlLength + 100) })
  .superRefine((d, ctx) => {
    if (!d.platform) return ctx.addIssue({ code: "custom", path: ["platform"], message: "Choose the platform for this link." });
    const error = validate(d.platform, d.url);
    if (error) ctx.addIssue({ code: "custom", path: [platformOf(d.platform) ? "url" : "platform"], message: error });
  })
  .transform((d) => ({ platform: d.platform, url: /** @type {string} */ (normalizeSocialUrl(d.platform, d.url)) }));

/**
 * Builds the social link rows from a form body: two parallel repeated keys `socialPlatform` / `socialUrl` (empty
 * rows kept so error keys line up with the rows on screen), or a JSON `socialLinks` array.
 * @param {Record<string, unknown>} body
 */
export function socialLinksFromBody(body) {
  if (body && "socialLinks" in body && body.socialLinks !== undefined) return body.socialLinks;
  const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).map((x) => (typeof x === "string" ? x : ""));
  const platforms = list(body?.socialPlatform);
  const urls = list(body?.socialUrl);
  return Array.from({ length: Math.max(platforms.length, urls.length) }, (_, i) => ({ platform: platforms[i] ?? "", url: urls[i] ?? "" }));
}
