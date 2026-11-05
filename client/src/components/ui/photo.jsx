import { preload } from "react-dom";
import { PHOTOS } from "@fashinza/shared/images.js";
import { cn } from "@fashinza/shared/utils.js";

/**
 * Photo: one of the approved photographs in `PHOTOS` (@fashinza/shared/images.js), rendered as a plain <img>
 * (lazy by default; the files in public/images are served as they are) in a cropped, rounded frame. Port of
 * src/components/ui/photo.tsx: same props, same frame markup and classes; next/image's srcset is not reproduced,
 * so `sizes` is accepted for API compatibility only.
 *
 *   <Photo photo="factorySewingLines" sizes="(min-width: 1024px) 50vw, 100vw" aspect="landscape" />
 *   <Photo photo="heroSewing" sizes="100vw" priority aspect="none" className="h-[28rem]" />
 *   <div className="relative min-h-[32rem]">
 *     <Photo photo="heroSewing" sizes="100vw" fill rounded="none" overlay="left" priority />
 *     …text in text-ink-inverse, positioned above with `relative`…
 *   </div>
 *   <Photo photo="qualityInspection" sizes="(min-width: 768px) 40vw, 100vw" overlay="bottom" credit>
 *     <p className="eyebrow text-taupe">Quality inspection</p>
 *     <p className="type-heading text-ink-inverse">Inline and final checks</p>
 *   </Photo>
 *
 * Rules (docs/design-system.md, "Photography"): only PHOTOS entries; keep the catalogue alt text or pass a
 * better description; `decorative` only when adjacent text already says what the photo shows. These are
 * generic garment-industry photographs: never caption them as Fashinza partners, factories or customers.
 */

const ASPECT = {
  /** The photograph's own ratio (from its width/height). */
  natural: "",
  square: "aspect-square",
  /** 4:5 */
  portrait: "aspect-[4/5]",
  /** 3:2 */
  landscape: "aspect-[3/2]",
  /** 16:9 */
  wide: "aspect-video",
  /** No ratio: size the frame yourself with className (h-*, responsive aspect-* …). */
  none: "",
};

const ROUNDED = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
};

/*
 * Scrims for ivory text on photographs (base: the `scrim` token, near-black in both themes). Worst case — a
 * pure white pixel under the text — `text-ink-inverse` stays ≥4.5:1 wherever the scrim is ≥62% opaque and
 * `text-ink-inverse-muted` / `text-taupe` wherever it is ≥82%:
 *  - bottom: ≥70% across the lowest third, 90% at the edge (captions and titles at the bottom)
 *  - left:   ≥75% across the left 45%, 90% at the edge (hero copy on the left)
 *  - full:   70% everywhere (short centred text; keep muted text off it)
 */
const OVERLAY = {
  none: "",
  bottom: "bg-linear-to-t from-scrim/90 via-scrim/70 via-35% to-scrim/0",
  left: "bg-linear-to-r from-scrim/90 via-scrim/75 via-45% to-scrim/15",
  full: "bg-scrim/70",
};

/**
 * @typedef {keyof typeof PHOTOS} PhotoName
 * @typedef {object} PhotoProps
 * @property {PhotoName | import("@fashinza/shared/images.js").SitePhoto} photo A PHOTOS key (preferred) or a PHOTOS entry.
 * @property {string} sizes Rendered width at each breakpoint, e.g. "(min-width: 1024px) 50vw, 100vw" (kept for API parity).
 * @property {string} [alt] Replace the catalogue alt text with a better description for this context.
 * @property {boolean} [decorative] The photo adds nothing the adjacent text does not say: empty alt, hidden from assistive technology.
 * @property {boolean} [priority] Above-the-fold / LCP image (the hero): preloaded in <head>, eager, high fetch priority. One per page.
 * @property {boolean} [fill] Cover the nearest positioned ancestor (`absolute inset-0`) instead of sizing the frame by `aspect`.
 * @property {keyof typeof ASPECT} [aspect] Frame ratio, cropped with object-cover. Default "natural". Ignored with `fill`.
 * @property {string} [position] CSS object-position for the crop, e.g. "center 30%". Default "center".
 * @property {keyof typeof ROUNDED} [rounded] Corner radius. Default "lg" (6px, like cards); "none" for full-bleed bands.
 * @property {keyof typeof OVERLAY} [overlay] Scrim gradient so ivory text can sit on the photo. Default "none".
 * @property {boolean | "top" | "bottom"} [credit] Small photographer credit on the photo: true / "bottom" (bottom-right) or "top" (top-right).
 * @property {string} [className] Classes for the frame (the root element).
 * @property {string} [imageClassName] Classes for the <img> (e.g. a hover zoom).
 * @property {import("react").ReactNode} [children] Content placed over the photo (above the overlay), in an absolute container aligned to the bottom.
 * @property {string} [contentClassName] Classes for the content container (default: bottom-aligned column, 20px / 32px padding, ivory text).
 */

/** @param {PhotoProps} props */
export function Photo({
  photo,
  // `sizes` picked next/image's srcset entry; a plain <img> without srcset has no use for it.
  sizes: _sizes,
  alt,
  decorative = false,
  priority = false,
  fill = false,
  aspect = "natural",
  position,
  rounded = "lg",
  overlay = "none",
  credit = false,
  className,
  imageClassName,
  children,
  contentClassName,
}) {
  const p = typeof photo === "string" ? PHOTOS[photo] : photo;
  const creditAt = credit === true ? "bottom" : credit || null;
  // next/image `preload`: a <link rel="preload"> in <head>, eager loading and high fetch priority.
  if (priority) preload(p.src, { as: "image", fetchPriority: "high" });
  const loadingProps = priority ? { fetchPriority: "high" } : { loading: "lazy" };

  return (
    <div
      className={cn("relative isolate overflow-hidden bg-surface-sunken", fill ? "absolute inset-0" : ASPECT[aspect], ROUNDED[rounded], className)}
      style={!fill && aspect === "natural" ? { aspectRatio: `${p.width} / ${p.height}` } : undefined}
    >
      {fill ? (
        <img
          src={p.src}
          alt={decorative ? "" : (alt ?? p.alt)}
          decoding="async"
          className={cn("object-cover dark:brightness-[0.92]", imageClassName)}
          // The inline style next/image gives a `fill` image.
          style={{ position: "absolute", height: "100%", width: "100%", inset: 0, color: "transparent", ...(position ? { objectPosition: position } : {}) }}
          {...loadingProps}
        />
      ) : (
        <img
          src={p.src}
          alt={decorative ? "" : (alt ?? p.alt)}
          width={p.width}
          height={p.height}
          decoding="async"
          className={cn("size-full object-cover dark:brightness-[0.92]", aspect !== "none" && "absolute inset-0", imageClassName)}
          style={{ color: "transparent", ...(position ? { objectPosition: position } : {}) }}
          {...loadingProps}
        />
      )}
      {overlay !== "none" && <div aria-hidden className={cn("absolute inset-0", OVERLAY[overlay])} />}
      {children && <div className={cn("absolute inset-0 z-10 flex flex-col justify-end gap-1 p-5 text-ink-inverse sm:p-8", contentClassName)}>{children}</div>}
      {creditAt && (
        <small
          aria-hidden={decorative || undefined}
          className={cn(
            "absolute right-2 z-20 max-w-[calc(100%-1rem)] truncate rounded-xs bg-scrim/75 px-1.5 py-0.5 text-[0.6875rem] leading-4 text-ink-inverse",
            creditAt === "top" ? "top-2" : "bottom-2",
          )}
        >
          Photo: {p.credit}
        </small>
      )}
    </div>
  );
}

/** "Photo: Collab Media / Unsplash" — for credit lines outside the frame (e.g. a footer or a credits list). */
export function photoCredit(photo) {
  return `Photo: ${(typeof photo === "string" ? PHOTOS[photo] : photo).credit}`;
}
