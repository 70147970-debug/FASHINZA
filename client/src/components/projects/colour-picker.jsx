import { useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Plus, Search, X } from "lucide-react";
import { FormErrorsContext } from "@/components/forms/action-form";
import { fieldClass } from "@/components/ui/input";
import { ColourSwatch } from "@/components/projects/colour-swatches";
import {
  COLOUR_FAMILIES,
  COLOURS,
  colourTokenKey,
  customColourToken,
  findColour,
  formatColourList,
  parseColourList,
  resolveColourToken,
  searchColours,
} from "@fashinza/shared/colors.js";
import { COLOURS_MAX_LENGTH } from "@fashinza/shared/validation/project.js";
import { cn } from "@fashinza/shared/utils.js";

const FAMILY_LABEL = new Map(COLOUR_FAMILIES.map((f) => [f.value, f.label]));
const chipButton =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus max-sm:h-9";

/**
 * Colour picker for the project brief. People search the named colours (CSS colours plus fashion and textile
 * names, shared/src/colors.js), narrow them by family, and pick as many as they need; every name has a swatch.
 * A custom colour (native colour input + a name) is stored as "Name (#RRGGBB)", and anything typed that is not a
 * listed name (a Pantone reference, a mill's shade name) can be added as written.
 *
 * The choice is posted as one comma-separated string in a hidden input named `name` (the project's "colors"
 * field), so briefs saved before the picker existed still load: unknown names appear as chips without a swatch.
 *
 * Keyboard: the search box is an ARIA combobox for a multi-select listbox that is always shown. Up/Down move
 * through the colours, Enter adds or removes the highlighted one, Escape clears the search. Family filters and
 * the remove buttons on chosen colours are ordinary buttons.
 */
export function ColourPicker({ id = "colors", name = "colors", label = "Colours", required = false, defaultValue = "", hint }) {
  const uid = useId();
  const errors = useContext(FormErrorsContext);
  const serverError = errors[name];
  const [selected, setSelected] = useState(() => parseColourList(defaultValue));
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("all");
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState("");
  const [limitError, setLimitError] = useState("");
  const [customName, setCustomName] = useState("");
  const [customHex, setCustomHex] = useState("#4e8a8c");
  const [customError, setCustomError] = useState("");
  const inputRef = useRef(null);

  const listId = `${uid}-list`;
  const optionId = (i) => `${uid}-option-${i}`;
  const selectedKeys = useMemo(() => new Set(selected.map(colourTokenKey)), [selected]);
  const typed = query.trim();
  const results = useMemo(() => searchColours(typed, { family }), [typed, family]);
  /** @type {({ type: "colour", colour: import("@fashinza/shared/colors.js").NamedColour } | { type: "text", tokens: string[] })[]} */
  const options = useMemo(() => {
    // Free text when the search is not exactly a listed colour (e.g. "Pantone 19-4052 TCX").
    const textTokens = typed && !findColour(typed) ? parseColourList(typed) : [];
    return [...results.map((colour) => ({ type: "colour", colour })), ...(textTokens.length ? [{ type: "text", tokens: textTokens }] : [])];
  }, [results, typed]);
  const grouped = !typed && family === "all";
  const current = active < options.length ? active : -1;

  // Keeps the highlighted option in view while moving through the list with the arrow keys.
  useEffect(() => {
    if (current >= 0) document.getElementById(`${uid}-option-${current}`)?.scrollIntoView({ block: "nearest" });
  }, [current, uid]);

  const message = limitError || serverError;
  // The hint is replaced by the error while there is one, so only the shown text is referenced.
  const describedBy = [hint && !message && `${id}-hint`, message && `${id}-error`].filter(Boolean).join(" ") || undefined;

  /** Adds tokens (skipping ones already chosen); returns false when the list would be too long. */
  function add(tokens, spoken) {
    const fresh = tokens.filter((t) => !selectedKeys.has(colourTokenKey(t)));
    if (!fresh.length) return true;
    const next = [...selected, ...fresh];
    if (formatColourList(next).length > COLOURS_MAX_LENGTH) {
      setLimitError(`The colour list can be up to ${COLOURS_MAX_LENGTH.toLocaleString("en-GB")} characters. Remove a colour to add another.`);
      return false;
    }
    setLimitError("");
    setSelected(next);
    setStatus(`${spoken ?? fresh.join(", ")} added. ${next.length} ${next.length === 1 ? "colour" : "colours"} chosen.`);
    return true;
  }

  function remove(token) {
    const key = colourTokenKey(token);
    const next = selected.filter((t) => colourTokenKey(t) !== key);
    setSelected(next);
    setLimitError("");
    setStatus(`${resolveColourToken(token).name} removed. ${next.length} ${next.length === 1 ? "colour" : "colours"} chosen.`);
  }

  function choose(index) {
    const o = options[index];
    if (!o) return;
    if (o.type === "colour") {
      const token = o.colour.name;
      if (selectedKeys.has(colourTokenKey(token))) {
        remove(selected.find((t) => colourTokenKey(t) === colourTokenKey(token)) ?? token);
        return;
      }
      if (add([token])) search("");
    } else {
      // Known names typed in a list ("black, ecru") are stored with their listed spelling.
      const tokens = o.tokens.map((t) => findColour(t)?.name ?? t);
      if (add(tokens)) search("");
    }
  }

  /** A new search highlights its best match; browsing without a search starts with nothing highlighted. */
  function search(value) {
    setQuery(value);
    setActive(value.trim() ? 0 : -1);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(current + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(current - 1, 0));
    } else if (e.key === "Enter") {
      // Never submit the wizard from the search box.
      e.preventDefault();
      if (current >= 0) choose(current);
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      search("");
    }
  }

  function addCustom() {
    const n = customName.replace(/,/g, " ").trim();
    if (!n) {
      setCustomError("Enter a name for the custom colour.");
      return;
    }
    setCustomError("");
    if (add([customColourToken(n, customHex)], n)) setCustomName("");
  }

  const renderOption = (o, i) => {
    const isActive = i === current;
    if (o.type === "text") {
      return (
        <li
          key="text"
          id={optionId(i)}
          role="option"
          aria-selected={false}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => choose(i)}
          className={cn(
            "flex min-h-10 cursor-pointer items-center gap-2.5 border-t border-line-subtle px-3 py-2 text-sm text-ink hover:bg-surface-hover",
            isActive && "bg-surface-hover outline-2 -outline-offset-2 outline-focus",
          )}
        >
          <Plus className="size-4 shrink-0 text-ink-muted" aria-hidden />
          <span className="min-w-0 break-words">
            Add “{typed}” as written
            <span className="block text-xs text-ink-muted">Not in the colour list, so it is shown without a swatch.</span>
          </span>
        </li>
      );
    }
    const c = o.colour;
    const on = selectedKeys.has(colourTokenKey(c.name));
    return (
      <li
        key={c.name}
        id={optionId(i)}
        role="option"
        aria-selected={on}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => choose(i)}
        className={cn(
          "flex min-h-9 cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-ink hover:bg-surface-hover max-sm:min-h-10",
          on && "bg-accent-soft/60 font-medium",
          isActive && "bg-surface-hover outline-2 -outline-offset-2 outline-focus",
        )}
      >
        <ColourSwatch hex={c.hex} className="size-5 rounded" />
        <span className="min-w-0 flex-1 truncate">{c.name}</span>
        {!grouped && family === "all" && (
          <span aria-hidden className="hidden shrink-0 text-xs text-ink-muted sm:inline">
            {FAMILY_LABEL.get(c.family)}
          </span>
        )}
        <span aria-hidden className="tabular hidden w-16 shrink-0 text-right text-xs text-ink-muted sm:inline">
          {c.hex}
        </span>
        <Check className={cn("size-4 shrink-0 text-accent-strong", !on && "invisible")} aria-hidden />
      </li>
    );
  };

  /** Options grouped by family under headings (browsing everything), or one ranked list. */
  const listContent = grouped
    ? COLOUR_FAMILIES.map((f) => {
        const start = options.findIndex((o) => o.type === "colour" && o.colour.family === f.value);
        if (start < 0) return null;
        const items = [];
        for (let i = start; i < options.length && options[i].type === "colour" && options[i].colour.family === f.value; i++) items.push(renderOption(options[i], i));
        return (
          <li key={f.value} role="presentation">
            <ul role="group" aria-labelledby={`${uid}-family-${f.value}`}>
              <li
                role="presentation"
                id={`${uid}-family-${f.value}`}
                className="sticky top-0 z-[1] border-b border-line-subtle bg-surface-muted px-3 py-1 text-xs font-medium text-ink-muted"
              >
                {f.label}
              </li>
              {items}
            </ul>
          </li>
        );
      })
    : options.map(renderOption);

  const countText = typed
    ? `${results.length} ${results.length === 1 ? "match" : "matches"} for “${typed}”${family !== "all" ? ` in ${FAMILY_LABEL.get(family)}` : ""}`
    : family === "all"
      ? `${COLOURS.length} colours`
      : `${results.length} colours in ${FAMILY_LABEL.get(family)}`;

  return (
    <div className="space-y-2.5">
      <input type="hidden" name={name} value={formatColourList(selected)} />
      <label htmlFor={id} className="block text-[13px] font-medium leading-5 text-ink">
        {label}
        {required ? (
          <span className="text-accent-strong" aria-hidden>
            {" "}
            *
          </span>
        ) : (
          <span className="font-normal text-ink-muted"> (optional)</span>
        )}
      </label>

      {selected.length > 0 ? (
        <ul aria-label="Your colour selection" className="flex flex-wrap gap-1.5">
          {selected.map((t) => {
            const c = resolveColourToken(t);
            return (
              <li
                key={t}
                className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md border border-accent-line bg-accent-soft py-0.5 pl-2 pr-0.5 text-[13px] font-medium text-accent-strong max-sm:min-h-9"
              >
                {c.hex ? (
                  <ColourSwatch hex={c.hex} className="size-3.5" />
                ) : (
                  <span aria-hidden title="Not in the colour list" className="size-3.5 shrink-0 rounded-[3px] border border-dashed border-ink-muted" />
                )}
                <span className="min-w-0 break-words">
                  {c.name}
                  {c.kind === "custom" && c.name !== c.hex && <span className="tabular font-normal text-ink-muted"> {c.hex}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    remove(t);
                    inputRef.current?.focus();
                  }}
                  aria-label={`Remove ${c.name}`}
                  className="grid size-7 shrink-0 place-items-center rounded-sm text-accent-strong transition-colors hover:bg-accent/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus max-sm:size-8"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] leading-5 text-ink-muted">No colours chosen yet.</p>
      )}

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="space-y-2 border-b border-line p-2.5 sm:p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <input
              ref={inputRef}
              id={id}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={current >= 0 ? optionId(current) : undefined}
              aria-required={required || undefined}
              aria-invalid={message ? true : undefined}
              aria-describedby={describedBy}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              value={query}
              onChange={(e) => search(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search, e.g. navy or ecru"
              className={cn(fieldClass, "h-10 pl-9")}
            />
          </div>
          <div role="group" aria-label="Filter by colour family" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
            {[{ value: "all", label: "All", hex: null }, ...COLOUR_FAMILIES].map((f) => {
              const on = family === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setFamily(f.value);
                    setActive(typed ? 0 : -1);
                  }}
                  className={cn(
                    chipButton,
                    on ? "border-accent bg-accent-soft text-accent-strong" : "border-line-strong bg-surface text-ink-muted hover:border-line-control hover:text-ink",
                  )}
                >
                  {f.hex && <ColourSwatch hex={f.hex} />}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
        <ul
          id={listId}
          role="listbox"
          aria-label="Colour suggestions"
          aria-multiselectable="true"
          className="max-h-64 overflow-y-auto overscroll-contain py-1 max-sm:max-h-56"
        >
          {listContent}
        </ul>
        {options.length === 0 && (
          <p className="px-3 pb-3 text-[13px] text-ink-muted">
            {family !== "all" ? `No colours match in ${FAMILY_LABEL.get(family)}. Choose “All” to search every family.` : "No colours match. Try another name."}
          </p>
        )}
        <p className="border-t border-line-subtle bg-surface-muted px-3 py-1.5 text-xs text-ink-muted" aria-live="polite">
          {countText}
        </p>
      </div>

      <details className="group rounded-md">
        <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-sm text-[13px] font-medium text-accent-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
          <Plus className="size-4 transition-transform duration-150 group-open:rotate-45" aria-hidden />
          Add a custom colour
        </summary>
        <div className="mt-2 rounded-md border border-line bg-surface-muted p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor={`${uid}-custom-hex`} className="block text-xs font-medium text-ink">
                Custom colour
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`${uid}-custom-hex`}
                  type="color"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-md border border-line-control bg-surface p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                />
                <span className="tabular text-xs text-ink-muted">{customHex.toUpperCase()}</span>
              </div>
            </div>
            <div className="min-w-[10rem] flex-1 space-y-1">
              <label htmlFor={`${uid}-custom-name`} className="block text-xs font-medium text-ink">
                Name of the custom colour
              </label>
              <input
                id={`${uid}-custom-name`}
                value={customName}
                maxLength={60}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="For example Dusty teal"
                aria-invalid={customError ? true : undefined}
                aria-describedby={customError ? `${uid}-custom-error` : undefined}
                className={cn(fieldClass, "h-10")}
              />
            </div>
            <button
              type="button"
              onClick={addCustom}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:border-line-control hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Plus className="size-4" aria-hidden /> Add colour
            </button>
          </div>
          {customError && (
            <p id={`${uid}-custom-error`} className="mt-1.5 text-xs font-medium text-danger-strong">
              {customError}
            </p>
          )}
          <p className="mt-2 text-xs text-ink-muted">Saved with its hex value, for example “Dusty teal ({customHex.toUpperCase()})”.</p>
        </div>
      </details>

      {hint && !message && (
        <p id={`${id}-hint`} className="text-xs leading-4 text-ink-muted">
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} data-field-error="" className="flex scroll-mt-24 items-start gap-1 text-xs font-medium leading-4 text-danger-strong">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {message}
        </p>
      )}
      <p className="sr-only" role="status">
        {status}
      </p>
    </div>
  );
}
