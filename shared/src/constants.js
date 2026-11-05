/**
 * Reads the public contact email. On the server it comes from process.env; in the browser the client's Vite
 * config replaces `process.env.NEXT_PUBLIC_CONTACT_EMAIL` at build time (`define`). Without either, the
 * reference throws (no `process` in the browser) and the default below is used.
 */
function contactEmailFromEnv() {
  try {
    return process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  } catch {
    return undefined;
  }
}

export const SITE = {
  name: "Fashinza",
  tagline: "From fashion ideas to finished garments.",
  contactEmail: contactEmailFromEnv() ?? "contact@fashinza.example",
  location: "Lahore, Pakistan",
};

/** @type {{ value: import("./enums.js").GarmentCategory[number]; label: string }[]} */
export const GARMENT_CATEGORIES = [
  { value: "T_SHIRTS", label: "T-shirts" },
  { value: "SHIRTS", label: "Shirts" },
  { value: "DRESSES", label: "Dresses" },
  { value: "DENIM", label: "Denim" },
  { value: "TROUSERS", label: "Trousers" },
  { value: "ACTIVEWEAR", label: "Activewear" },
  { value: "OUTERWEAR", label: "Jackets & outerwear" },
  { value: "KNITWEAR", label: "Knitwear" },
  { value: "HOODIES_SWEATSHIRTS", label: "Hoodies & sweatshirts" },
  { value: "KIDSWEAR", label: "Kidswear" },
  { value: "SLEEPWEAR", label: "Sleepwear" },
  { value: "ACCESSORIES", label: "Accessories" },
];

export const CAPABILITIES = /** @type {const} */ ({
  PRODUCTION: ["Cut and sew", "Knitting", "Woven garments", "Pattern making", "Sampling", "Embroidery", "Screen printing", "Digital printing", "Sublimation"],
  FABRIC: ["Cotton", "Organic cotton", "Polyester", "Recycled polyester", "Linen", "Denim", "Fleece", "Jersey knit", "Silk", "Wool blends"],
  FINISHING: ["Garment dyeing", "Enzyme washing", "Stone washing", "Labelling", "Custom packaging", "Pressing and folding"],
});

/** Suggestions for the factory machinery list (free text is also accepted). */
export const MACHINERY_TYPES = /** @type {const} */ ([
  "Single-needle lockstitch",
  "Double-needle lockstitch",
  "Overlock 3-thread",
  "Overlock 4-thread",
  "Overlock 5-thread",
  "Flatlock / coverstitch",
  "Bartack",
  "Buttonhole",
  "Button attach",
  "Snap / rivet press",
  "Feed-off-the-arm",
  "Multi-needle (Kansai)",
  "Cutting table / straight knife",
  "Band knife",
  "Fabric spreading machine",
  "Fusing press",
  "Embroidery machine",
  "Screen printing carousel",
  "Heat transfer press",
  "Steam press",
  "Thread trimming machine",
  "Needle detector",
  "Flat knitting machine",
  "Circular knitting machine",
]);

/** Upper bounds for machinery rows on a factory profile. */
export const MACHINERY_LIMITS = { rows: 40, quantity: 5000 };

/**
 * Project file kinds. Tech packs are versioned; the others are kept as uploaded. `imagesOnly` kinds accept
 * PNG, JPEG or WebP; the rest also accept PDF. The order here is the display order of the groups.
 * @type {readonly { value: import("./enums.js").AttachmentKind[number]; label: string; group: string; option: string; imagesOnly: boolean; description: string }[]}
 */
export const ATTACHMENT_KINDS = [
  { value: "TECH_PACK", label: "Tech pack", group: "Tech pack versions", option: "Tech pack (versioned)", imagesOnly: false, description: "Specifications, construction, trims and labels. Each upload becomes the next version." },
  { value: "MEASUREMENT_CHART", label: "Measurement chart", group: "Measurement charts", option: "Measurement chart", imagesOnly: false, description: "Points of measure and grading per size, with tolerances." },
  { value: "REFERENCE_IMAGE", label: "Reference image", group: "Reference images", option: "Reference image", imagesOnly: true, description: "Inspiration, fit, fabric or trim references." },
  { value: "SKETCH", label: "Design sketch", group: "Design sketches", option: "Design sketch", imagesOnly: true, description: "Flat sketches or illustrations of the garment." },
  { value: "OTHER", label: "Other document", group: "Other files", option: "Other document", imagesOnly: false, description: "Anything else the factory should see." },
];

export const ATTACHMENT_KIND_VALUES = ATTACHMENT_KINDS.map((k) => k.value);

/** @param {string} value */
export function attachmentKind(value) {
  return ATTACHMENT_KINDS.find((k) => k.value === value) ?? ATTACHMENT_KINDS[ATTACHMENT_KINDS.length - 1];
}

export const CERTIFICATIONS = ["GOTS", "OEKO-TEX Standard 100", "Fairtrade", "BCI", "WRAP", "SA8000", "ISO 9001"];

export const CURRENCIES = /** @type {const} */ (["USD", "EUR", "GBP", "PKR"]);

export const UPLOAD_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  allowedMime: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
};
