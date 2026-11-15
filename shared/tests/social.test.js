import { describe, expect, it } from "vitest";
import {
  SOCIAL_LIMITS,
  SOCIAL_PLATFORMS,
  checkLinkSchema,
  detectPlatform,
  hostAllowed,
  normalizeSocialUrl,
  platformLabel,
  socialLinksFromBody,
  socialLinksSchema,
  validate,
} from "../src/social.js";
import { brandProfileSchema, manufacturerProfileSchema } from "../src/validation/profile.js";

const issues = (r) => (r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message])));

describe("social platforms", () => {
  it("lists the ten platforms in order with hosts, labels and examples", () => {
    expect(SOCIAL_PLATFORMS.map((p) => p.value)).toEqual(["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK", "X", "PINTEREST", "YOUTUBE", "BEHANCE", "ETSY", "OTHER"]);
    expect(platformLabel("X")).toBe("X (Twitter)");
    expect(platformLabel("NOPE")).toBe("Other");
    for (const p of SOCIAL_PLATFORMS) expect(validate(p.value, p.example), p.value).toBeNull();
  });

  it("accepts the platform's hosts and their subdomains only", () => {
    expect(hostAllowed("FACEBOOK", "fb.com")).toBe(true);
    expect(hostAllowed("FACEBOOK", "m.facebook.com")).toBe(true);
    expect(hostAllowed("INSTAGRAM", "evilinstagram.com")).toBe(false);
    expect(hostAllowed("INSTAGRAM", "instagram.com.evil.com")).toBe(false);
    expect(hostAllowed("OTHER", "anything.example")).toBe(true);
    expect(detectPlatform("www.youtube.com/@brand")).toBe("YOUTUBE");
    expect(detectPlatform("https://shop.example.org")).toBeUndefined();
  });
});

describe("validate(platform, url)", () => {
  it("adds https:// when the scheme is left out and upgrades http for listed platforms", () => {
    expect(validate("INSTAGRAM", "instagram.com/yourbrand")).toBeNull();
    expect(normalizeSocialUrl("INSTAGRAM", " instagram.com/yourbrand ")).toBe("https://instagram.com/yourbrand");
    expect(normalizeSocialUrl("X", "http://twitter.com/brand")).toBe("https://twitter.com/brand");
    expect(normalizeSocialUrl("FACEBOOK", "m.facebook.com/profile.php?id=42")).toBe("https://m.facebook.com/profile.php?id=42");
    expect(normalizeSocialUrl("OTHER", "https://brand-shop.com/")).toBe("https://brand-shop.com");
  });

  it("says which platform a link belongs to when it does not match", () => {
    expect(validate("FACEBOOK", "https://instagram.com/yourbrand")).toBe("This isn't a Facebook link. Use a URL like https://facebook.com/yourbrand.");
    expect(validate("INSTAGRAM", "https://instagram.com.evil.com/x")).toBe("This isn't an Instagram link. Use a URL like https://instagram.com/yourbrand.");
    expect(validate("OTHER", "https://www.instagram.com/yourbrand")).toBe("This is an Instagram link. Choose Instagram as the platform.");
  });

  it("requires a page on the platform, not its home, sign-in or menu pages", () => {
    expect(validate("INSTAGRAM", "https://instagram.com/")).toBe(
      "Link to your own Instagram page, not the Instagram home page. Use a URL like https://instagram.com/yourbrand.",
    );
    expect(validate("LINKEDIN", "linkedin.com/login")).toMatch(/^This goes to a LinkedIn menu or sign-in page\./);
    expect(validate("INSTAGRAM", "instagram.com/accounts/login/")).toMatch(/menu or sign-in page/);
    expect(validate("YOUTUBE", "youtu.be/abc123")).toBeNull();
    expect(validate("PINTEREST", "pin.it/abc")).toBeNull();
  });

  it("refuses unsafe or unreadable links with specific messages", () => {
    expect(validate("INSTAGRAM", "")).toBe("Enter the link to your page, or remove this row.");
    expect(validate("INSTAGRAM", "@yourbrand")).toMatch(/^Enter the full link to your page, not just your handle\./);
    expect(validate("INSTAGRAM", "instagram.com/your brand")).toBe("Remove the spaces from the link.");
    expect(validate("ETSY", "ftp://etsy.com/shop/x")).toMatch(/^Enter a web link that starts with https:\/\//);
    expect(validate("OTHER", "http://brand-shop.com")).toBe("Use a secure link that starts with https://.");
    expect(validate("OTHER", "https://user:secret@brand-shop.com")).toBe("Remove the user name or password from the link.");
    expect(validate("OTHER", "https://brand-shop.com:8443/")).toBe("Remove the port number from the link.");
    expect(validate("OTHER", "https://127.0.0.1/")).toMatch(/not an IP address/);
    expect(validate("OTHER", "https://[::1]/")).toMatch(/not an IP address/);
    expect(validate("OTHER", "https://0x7f.1/")).toMatch(/not an IP address/);
    expect(validate("OTHER", "https://localhost/")).toBe("Use a public web address, like https://yourbrand.com.");
    expect(validate("OTHER", "https://intranet.corp/")).toBe("Use a public web address, like https://yourbrand.com.");
    expect(validate("OTHER", "https://shop.test/")).toBe("Use a public web address, like https://yourbrand.com.");
    expect(validate("INSTAGRAM", `https://instagram.com/${"a".repeat(SOCIAL_LIMITS.urlLength)}`)).toBe("Keep the link under 300 characters.");
    expect(validate("MYSPACE", "https://myspace.com/x")).toBe("Choose a platform from the list.");
  });
});

describe("socialLinksSchema", () => {
  it("ignores empty rows but keeps row numbers for error keys", () => {
    const r = socialLinksSchema.safeParse([
      { platform: "", url: "" },
      { platform: "FACEBOOK", url: "instagram.com/a" },
      { platform: "INSTAGRAM", url: "instagram.com/a" },
      { platform: "INSTAGRAM", url: "instagram.com/b" },
      { platform: "", url: "x.com/a" },
      { platform: "OTHER", url: "https://brand-shop.com" },
      { platform: "OTHER", url: "https://brand-shop.com/" },
    ]);
    expect(issues(r)).toEqual({
      "1.url": "This isn't a Facebook link. Use a URL like https://facebook.com/yourbrand.",
      "3.platform": "You've already added an Instagram link. Use one link per platform, or choose Other.",
      "4.platform": "Choose the platform for this link.",
      "6.url": "You've already added this link.",
    });
  });

  it("returns the filled rows normalised, with their row number", () => {
    const r = socialLinksSchema.parse([
      { platform: "", url: "" },
      { platform: "INSTAGRAM", url: "instagram.com/brand", check: { status: "FOUND" } },
      { platform: "OTHER", url: "https://brand-shop.com" },
      { platform: "OTHER", url: "https://brand-blog.com" },
    ]);
    expect(r).toEqual([
      { platform: "INSTAGRAM", url: "https://instagram.com/brand", row: 1 },
      { platform: "OTHER", url: "https://brand-shop.com", row: 2 },
      { platform: "OTHER", url: "https://brand-blog.com", row: 3 },
    ]);
    expect(socialLinksSchema.parse(undefined)).toBeUndefined();
    expect(socialLinksSchema.parse([])).toEqual([]);
  });

  it("allows at most 8 links", () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({ platform: "OTHER", url: `https://brand-${i}.com` }));
    expect(issues(socialLinksSchema.safeParse(rows))).toEqual({ "": "Add up to 8 social links." });
    expect(socialLinksSchema.safeParse(rows.slice(0, 8)).success).toBe(true);
  });

  it("is part of both profile schemas (error keys socialLinks.<row>.url)", () => {
    const brand = brandProfileSchema.safeParse({ companyName: "North Thread", country: "United Kingdom", socialLinks: [{ platform: "TIKTOK", url: "https://youtube.com/@north" }] });
    expect(issues(brand)).toEqual({ "socialLinks.0.url": "This isn't a TikTok link. Use a URL like https://tiktok.com/@yourbrand." });
    expect(brandProfileSchema.parse({ companyName: "North Thread", country: "United Kingdom" }).socialLinks).toBeUndefined();
    const factory = manufacturerProfileSchema.safeParse({ socialLinks: [{ platform: "ETSY", url: "https://etsy.com/" }] });
    expect(issues(factory)["socialLinks.0.url"]).toBe("Link to your own Etsy page, not the Etsy home page. Use a URL like https://etsy.com/shop/yourshop.");
  });
});

describe("check-link body and form rows", () => {
  it("validates one link and normalises it", () => {
    expect(checkLinkSchema.parse({ platform: "LINKEDIN", url: "linkedin.com/company/north" })).toEqual({ platform: "LINKEDIN", url: "https://linkedin.com/company/north" });
    expect(issues(checkLinkSchema.safeParse({ platform: "", url: "x.com/a" }))).toEqual({ platform: "Choose the platform for this link." });
    expect(issues(checkLinkSchema.safeParse({ platform: "NOPE", url: "x.com/a" }))).toEqual({ platform: "Choose a platform from the list." });
    expect(issues(checkLinkSchema.safeParse({ platform: "X", url: "https://instagram.com/a" }))).toEqual({ url: "This isn't an X (Twitter) link. Use a URL like https://x.com/yourbrand." });
  });

  it("pairs the repeated socialPlatform / socialUrl keys, or takes a JSON list", () => {
    expect(socialLinksFromBody({ socialPlatform: ["INSTAGRAM", ""], socialUrl: ["instagram.com/a", ""] })).toEqual([
      { platform: "INSTAGRAM", url: "instagram.com/a" },
      { platform: "", url: "" },
    ]);
    expect(socialLinksFromBody({ socialPlatform: "X", socialUrl: "x.com/a" })).toEqual([{ platform: "X", url: "x.com/a" }]);
    expect(socialLinksFromBody({ socialLinks: [{ platform: "X", url: "x.com/a" }] })).toEqual([{ platform: "X", url: "x.com/a" }]);
    expect(socialLinksFromBody({})).toEqual([]);
  });
});
