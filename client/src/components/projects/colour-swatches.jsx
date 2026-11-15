import { Fragment } from "react";
import { parseColourList, resolveColourToken } from "@fashinza/shared/colors.js";
import { cn } from "@fashinza/shared/utils.js";

/**
 * A small square of colour. Decorative: the colour's name is always written next to it. The hairline border keeps
 * white swatches visible on white and black ones on the dark theme.
 */
export function ColourSwatch({ hex, className }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3 shrink-0 rounded-[3px] border border-ink/25 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]", className)}
      style={{ backgroundColor: hex }}
    />
  );
}

/**
 * A project's stored colour list ("Black, Off-white, Dusty teal (#4E8A8C)") with a swatch before every colour that
 * is recognised (a listed name, or a custom colour with its hex). Free text such as a Pantone reference is shown as
 * written, without a swatch. Items stay comma-separated, so the text reads exactly as it was stored.
 * @param {{ value: string | null | undefined, fallback?: import("react").ReactNode, className?: string }} props
 */
export function ColourList({ value, fallback = "—", className }) {
  const tokens = parseColourList(value);
  if (!tokens.length) return fallback;
  return (
    <span className={className}>
      {tokens.map((t, i) => {
        const c = resolveColourToken(t);
        // The swatch stays on the same line as the first word of the name; long names can still wrap after it.
        const [first, ...rest] = c.name.split(" ");
        return (
          <Fragment key={t}>
            {i > 0 && ", "}
            <span className="whitespace-nowrap">
              {c.hex && <ColourSwatch hex={c.hex} className="mr-1.5 align-[-0.125em]" />}
              {first}
            </span>
            {rest.length > 0 && ` ${rest.join(" ")}`}
            {c.kind === "custom" && c.name !== c.hex && <span className="tabular font-normal text-ink-muted"> {c.hex}</span>}
          </Fragment>
        );
      })}
    </span>
  );
}
