/**
 * Photography used on the public website. Files live in public/images (credits in
 * public/images/CREDITS.md, Unsplash License). These are generic garment-industry photographs:
 * never caption them as Fashinza partners, factories or customers.
 */
export type SitePhoto = { src: string; width: number; height: number; alt: string; credit: string };

const photo = (file: string, width: number, height: number, alt: string, credit: string): SitePhoto => ({
  src: `/images/${file}`,
  width,
  height,
  alt,
  credit,
});

export const PHOTOS = {
  heroSewing: photo("hero-sewing.jpg", 1920, 1280, "Hands guiding a pinstripe garment through an industrial sewing machine", "Collab Media / Unsplash"),
  factorySewingLines: photo("factory-sewing-lines.jpg", 1920, 1280, "Rows of sewing stations in a garment factory", "EqualStock / Unsplash"),
  factoryFloor: photo("factory-floor.jpg", 1920, 1280, "Workers handling cut garment panels on a factory floor", "EqualStock / Unsplash"),
  designersSampleFitting: photo("designers-sample-fitting.jpg", 1920, 1080, "Two designers fitting a sample garment on a dress form", "Vitaly Gariev / Unsplash"),
  designSketches: photo("design-sketches.jpg", 1920, 1080, "Fashion design sketches pinned to a studio board", "Vitaly Gariev / Unsplash"),
  fabricRolls: photo("fabric-rolls.jpg", 1920, 1434, "Rolled fabrics in shades of blue and white", "Victor Volkov / Unsplash"),
  fabricCutting: photo("fabric-cutting.jpg", 1920, 1280, "Cutting printed fabric with scissors on a work table", "Phương Anh Nguyễn / Unsplash"),
  qualityInspection: photo("quality-inspection.jpg", 1920, 1262, "A worker inspecting a garment panel in a factory", "Shanjir H, Photo4life AU / Unsplash"),
  finishedGarments: photo("finished-garments.jpg", 1920, 1280, "Finished garments hanging on clothing rails", "Egor Myznik / Unsplash"),
  garmentRailDark: photo("garment-rail-dark.jpg", 1920, 1282, "Dark garments on hangers along a rail", "Elliot zoz / Unsplash"),
  linenTexture: photo("linen-texture.jpg", 1920, 1280, "Close-up of natural linen fabric", "engin akyurt / Unsplash"),
} as const;
