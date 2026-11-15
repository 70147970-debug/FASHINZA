/**
 * `socialLinks` on BrandProfile and ManufacturerProfile (decision 5): up to 8 links `{ platform, url, check }`,
 * where `check` is the result of the live link check made when the link was saved (server/src/lib/link-check.js).
 * Sub-documents have no `_id`. Validation rules live in @fashinza/shared/social.js.
 */
import { LINK_CHECK_STATUSES, SOCIAL_PLATFORM_VALUES } from "@fashinza/shared/social.js";
import { Schema } from "./_schema.js";

const linkCheckSchema = new Schema(
  {
    status: { type: String, enum: LINK_CHECK_STATUSES, default: "SKIPPED" },
    checkedAt: { type: Date, default: null },
  },
  { _id: false },
);

export const socialLinkSchema = new Schema(
  {
    platform: { type: String, enum: SOCIAL_PLATFORM_VALUES, required: true },
    url: { type: String, required: true },
    check: { type: linkCheckSchema, default: () => ({}) },
  },
  { _id: false },
);

/** Field definition: `socialLinks: socialLinks()`. */
export const socialLinks = () => ({ type: [socialLinkSchema], default: [] });
