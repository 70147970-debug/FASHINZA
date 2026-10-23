import type { GarmentCategory } from "@/generated/prisma/enums";

export const SITE = {
  name: "Fashinza",
  tagline: "Apparel manufacturing, managed in one place.",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contact@fashinza.example",
  location: "Lahore, Pakistan",
};

export const GARMENT_CATEGORIES: { value: GarmentCategory; label: string }[] = [
  { value: "T_SHIRTS", label: "T-shirts" },
  { value: "SHIRTS", label: "Shirts" },
  { value: "DRESSES", label: "Dresses" },
  { value: "DENIM", label: "Denim" },
  { value: "TROUSERS", label: "Trousers" },
  { value: "ACTIVEWEAR", label: "Activewear" },
  { value: "OUTERWEAR", label: "Outerwear" },
  { value: "KNITWEAR", label: "Knitwear" },
  { value: "HOODIES_SWEATSHIRTS", label: "Hoodies & sweatshirts" },
  { value: "KIDSWEAR", label: "Kidswear" },
  { value: "SLEEPWEAR", label: "Sleepwear" },
  { value: "ACCESSORIES", label: "Accessories" },
];

export const CAPABILITIES = {
  PRODUCTION: ["Cut and sew", "Knitting", "Woven garments", "Pattern making", "Sampling", "Embroidery", "Screen printing", "Digital printing", "Sublimation"],
  FABRIC: ["Cotton", "Organic cotton", "Polyester", "Recycled polyester", "Linen", "Denim", "Fleece", "Jersey knit", "Silk", "Wool blends"],
  FINISHING: ["Garment dyeing", "Enzyme washing", "Stone washing", "Labelling", "Custom packaging", "Pressing and folding"],
} as const;

export const CERTIFICATIONS = ["GOTS", "OEKO-TEX Standard 100", "Fairtrade", "BCI", "WRAP", "SA8000", "ISO 9001"];

export const CURRENCIES = ["USD", "EUR", "GBP", "PKR"] as const;

export const UPLOAD_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  allowedMime: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
};
