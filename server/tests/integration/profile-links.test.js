/**
 * Social links on brand and factory profiles (decision 5): saving over HTTP (multipart rows and JSON), error keys by
 * row, the stored check results, the check-link endpoint, and the live-check refusal on save. LINK_CHECK is off in
 * this environment (vitest.integration.config.js), so the live check is replaced where a test needs a result.
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { resetRateLimits } from "../../src/lib/rate-limit.js";
import { BrandProfile, ManufacturerProfile } from "../../src/models/index.js";
import { saveBrandProfile, saveManufacturerProfile } from "../../src/services/profiles.js";
import { makeAdmin, makeUser, resetDb } from "../support/fixtures.js";
import { sameOrigin, sessionCookie } from "../support/http.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  resetRateLimits();
});

const brandBody = { companyName: "North Thread", country: "United Kingdom" };

async function getAdminFactory(cookie, profileId) {
  const res = await request(app).get(`/api/admin/factories/${profileId}`).set("Cookie", cookie);
  expect(res.status).toBe(200);
  return res.body;
}

async function brandWithCookie() {
  const brand = await makeUser("BRAND");
  return { brand, cookie: await sessionCookie(brand.id) };
}

describe("brand profile social links", () => {
  it("saves rows posted as socialPlatform / socialUrl, normalised, with a SKIPPED check, and returns them", async () => {
    const { brand, cookie } = await brandWithCookie();
    const res = await sameOrigin(request(app).put("/api/profile/brand"))
      .set("Cookie", cookie)
      .field("companyName", brandBody.companyName)
      .field("country", brandBody.country)
      .field("socialPlatform", "INSTAGRAM")
      .field("socialUrl", "instagram.com/norththread")
      .field("socialPlatform", "")
      .field("socialUrl", "")
      .field("socialPlatform", "OTHER")
      .field("socialUrl", "https://north-thread-shop.com");
    expect(res.body).toEqual({ ok: true, redirectTo: "/dashboard?welcome=1" });

    const stored = await BrandProfile.findOne({ userId: brand.id }).lean();
    expect(stored.socialLinks).toEqual([
      { platform: "INSTAGRAM", url: "https://instagram.com/norththread", check: { status: "SKIPPED", checkedAt: expect.any(Date) } },
      { platform: "OTHER", url: "https://north-thread-shop.com", check: { status: "SKIPPED", checkedAt: expect.any(Date) } },
    ]);

    const got = await request(app).get("/api/profile/brand").set("Cookie", cookie);
    expect(got.body.profile.socialLinks).toEqual([
      { platform: "INSTAGRAM", url: "https://instagram.com/norththread", check: { status: "SKIPPED", checkedAt: expect.any(String) } },
      { platform: "OTHER", url: "https://north-thread-shop.com", check: { status: "SKIPPED", checkedAt: expect.any(String) } },
    ]);
  });

  it("reports errors under socialLinks.<row> for the rows on screen and saves nothing", async () => {
    const { brand, cookie } = await brandWithCookie();
    const res = await sameOrigin(request(app).put("/api/profile/brand"))
      .set("Cookie", cookie)
      .field("companyName", brandBody.companyName)
      .field("country", brandBody.country)
      .field("socialPlatform", "")
      .field("socialUrl", "")
      .field("socialPlatform", "FACEBOOK")
      .field("socialUrl", "https://instagram.com/norththread")
      .field("socialPlatform", "")
      .field("socialUrl", "x.com/norththread");
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "INVALID",
      message: "Please correct the highlighted fields.",
      fieldErrors: {
        "socialLinks.1.url": "This isn't a Facebook link. Use a URL like https://facebook.com/yourbrand.",
        "socialLinks.2.platform": "Choose the platform for this link.",
      },
    });
    expect((await BrandProfile.findOne({ userId: brand.id }).lean()).socialLinks ?? []).toEqual([]);
  });

  it("accepts a JSON list and replaces the stored list on every save (no rows = no links)", async () => {
    const { brand, cookie } = await brandWithCookie();
    const put = (body) => sameOrigin(request(app).put("/api/profile/brand")).set("Cookie", cookie).send(body);
    await put({ ...brandBody, socialLinks: [{ platform: "LINKEDIN", url: "https://www.linkedin.com/company/north-thread", check: { status: "FOUND" } }] });
    expect((await BrandProfile.findOne({ userId: brand.id }).lean()).socialLinks).toEqual([
      { platform: "LINKEDIN", url: "https://www.linkedin.com/company/north-thread", check: { status: "SKIPPED", checkedAt: expect.any(Date) } },
    ]);
    const tooMany = await put({ ...brandBody, socialLinks: Array.from({ length: 9 }, (_, i) => ({ platform: "OTHER", url: `https://north-${i}.com` })) });
    expect(tooMany.body.error.fieldErrors).toEqual({ socialLinks: "Add up to 8 social links." });
    const cleared = await put(brandBody);
    expect(cleared.body).toEqual({ ok: true, message: "Company profile saved." });
    expect((await BrandProfile.findOne({ userId: brand.id }).lean()).socialLinks).toEqual([]);
  });

  it("refuses a link the live check cannot find, keyed by its row, and keeps unchanged links' checks", async () => {
    const brand = await makeUser("BRAND");
    const at = new Date("2026-11-10T09:00:00Z");
    const check = async ({ url }) =>
      url.includes("gone")
        ? { status: "NOT_FOUND", reason: "HTTP_NOT_FOUND", message: "x", checkedAt: at }
        : { status: "UNCONFIRMED", reason: "BLOCKED_BY_SITE", message: "x", checkedAt: at };
    await expect(
      saveBrandProfile(brand, { ...brandBody, website: "https://gone-brand.com", socialLinks: [{ platform: "X", url: "https://x.com/gone", row: 2 }] }, { check }),
    ).rejects.toMatchObject({
      code: "INVALID",
      fieldErrors: { website: "We couldn't find this page. Check the link and try again.", "socialLinks.2.url": "We couldn't find this page. Check the link and try again." },
    });
    expect(await BrandProfile.findOne({ userId: brand.id }).lean()).toMatchObject({ website: null });

    await saveBrandProfile(brand, { ...brandBody, socialLinks: [{ platform: "LINKEDIN", url: "https://linkedin.com/company/north", row: 0 }] }, { check });
    let stored = await BrandProfile.findOne({ userId: brand.id }).lean();
    expect(stored.socialLinks).toEqual([{ platform: "LINKEDIN", url: "https://linkedin.com/company/north", check: { status: "UNCONFIRMED", checkedAt: at } }]);

    // Saving again without changes does not check the link again.
    let calls = 0;
    await saveBrandProfile(brand, { ...brandBody, socialLinks: [{ platform: "LINKEDIN", url: "https://linkedin.com/company/north", row: 0 }] }, {
      check: async (l) => {
        calls += 1;
        return check(l);
      },
    });
    expect(calls).toBe(0);
    stored = await BrandProfile.findOne({ userId: brand.id }).lean();
    expect(stored.socialLinks[0].check).toEqual({ status: "UNCONFIRMED", checkedAt: at });

    // Direct callers that leave socialLinks out (the seed) keep the stored list.
    await saveBrandProfile(brand, { ...brandBody, city: "Leeds" });
    expect((await BrandProfile.findOne({ userId: brand.id }).lean()).socialLinks).toHaveLength(1);
  });
});

describe("factory profile social links", () => {
  const factoryBody = (m) => ({
    businessName: "Lahore Knit Works",
    description: "Knit garment factory with in-house dyeing, printing and finishing for export brands.",
    country: "Pakistan",
    city: "Lahore",
    categories: ["T_SHIRTS"],
    production: ["Cut and sew"],
    minOrderQuantity: 100,
    maxMonthlyCapacity: 10000,
    typicalLeadTimeDays: 30,
    contactName: "Factory contact",
    contactEmail: m.email,
  });

  it("saves social links with the factory profile and shows them to the admin review page", async () => {
    const m = await makeUser("MANUFACTURER");
    const cookie = await sessionCookie(m.id);
    const res = await sameOrigin(request(app).put("/api/profile/factory"))
      .set("Cookie", cookie)
      .send({ ...factoryBody(m), socialLinks: [{ platform: "YOUTUBE", url: "youtube.com/@lahoreknit" }, { platform: "ETSY", url: "https://etsy.com/" }] });
    expect(res.body.error.fieldErrors).toEqual({
      "socialLinks.1.url": "Link to your own Etsy page, not the Etsy home page. Use a URL like https://etsy.com/shop/yourshop.",
    });
    const saved = await sameOrigin(request(app).put("/api/profile/factory"))
      .set("Cookie", cookie)
      .send({ ...factoryBody(m), socialLinks: [{ platform: "YOUTUBE", url: "youtube.com/@lahoreknit" }] });
    expect(saved.body).toEqual({ ok: true, redirectTo: "/factory?welcome=1" });

    const got = await request(app).get("/api/profile/factory").set("Cookie", cookie);
    expect(got.body.profile.socialLinks).toEqual([{ platform: "YOUTUBE", url: "https://youtube.com/@lahoreknit", check: { status: "SKIPPED", checkedAt: expect.any(String) } }]);

    const admin = await makeAdmin();
    const profile = await ManufacturerProfile.findOne({ userId: m.id }).lean();
    const review = await getAdminFactory(await sessionCookie(admin.id), profile._id.toHexString());
    expect(review.profile.socialLinks).toEqual([{ platform: "YOUTUBE", url: "https://youtube.com/@lahoreknit", check: { status: "SKIPPED", checkedAt: expect.any(String) } }]);
  });

  it("keeps the stored links for service callers that leave socialLinks out", async () => {
    const m = await makeUser("MANUFACTURER");
    await saveManufacturerProfile(m, { ...factoryBody(m), socialLinks: [{ platform: "BEHANCE", url: "https://behance.net/lahoreknit", row: 0 }] });
    await saveManufacturerProfile(m, factoryBody(m));
    expect((await ManufacturerProfile.findOne({ userId: m.id }).lean()).socialLinks).toEqual([
      { platform: "BEHANCE", url: "https://behance.net/lahoreknit", check: { status: "SKIPPED", checkedAt: expect.any(Date) } },
    ]);
  });
});

describe("POST /api/profile/check-link", () => {
  it("validates the link and answers SKIPPED when checks are off, for brands and factories only", async () => {
    const { cookie } = await brandWithCookie();
    const post = (body, c = cookie) => sameOrigin(request(app).post("/api/profile/check-link")).set("Cookie", c).send(body);
    const ok = await post({ platform: "INSTAGRAM", url: "instagram.com/norththread" });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({
      status: "SKIPPED",
      message: "Not checked — automatic link checks are switched off.",
      url: "https://instagram.com/norththread",
      checkedAt: expect.any(String),
    });
    const bad = await post({ platform: "TIKTOK", url: "https://instagram.com/norththread" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fieldErrors).toEqual({ url: "This isn't a TikTok link. Use a URL like https://tiktok.com/@yourbrand." });

    const factory = await makeUser("MANUFACTURER");
    expect((await post({ platform: "OTHER", url: "https://lahore-knit.com" }, await sessionCookie(factory.id))).body.status).toBe("SKIPPED");
    const admin = await makeAdmin();
    expect((await post({ platform: "OTHER", url: "https://lahore-knit.com" }, await sessionCookie(admin.id))).status).toBe(403);
    expect((await sameOrigin(request(app).post("/api/profile/check-link")).send({ platform: "X", url: "x.com/a" })).status).toBe(401);
  });

  it("is rate limited per account", async () => {
    const { cookie } = await brandWithCookie();
    let last;
    for (let i = 0; i < 31; i++) last = await sameOrigin(request(app).post("/api/profile/check-link")).set("Cookie", cookie).send({ platform: "X", url: `x.com/brand${i}` });
    expect(last.status).toBe(429);
    expect(last.body.error.message).toBe("Too many link checks. Please wait a few minutes and try again.");
  });
});
