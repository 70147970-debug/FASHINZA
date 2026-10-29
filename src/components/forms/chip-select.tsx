"use client";

import { useId, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldError } from "@/components/ui/field";
import { fieldClass } from "@/components/ui/input";

/**
 * Multi-select rendered as toggle chips. Each chip is a real checkbox named `name`, so the
 * selection is posted with the form like any checkbox group (FormData.getAll(name)).
 */
export function ChipSelect({
  name,
  label,
  options,
  defaultValue = [],
  allowCustom = false,
  required = false,
  hint,
}: {
  name: string;
  label: string;
  options: readonly (string | { value: string; label: string })[];
  defaultValue?: string[];
  allowCustom?: boolean;
  required?: boolean;
  hint?: string;
}) {
  const id = useId();
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [custom, setCustom] = useState<string[]>(defaultValue.filter((v) => !opts.some((o) => o.value === v)));
  const [draft, setDraft] = useState("");
  const all = [...opts, ...custom.map((c) => ({ value: c, label: c }))];

  const toggle = (v: string) => setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  const addCustom = () => {
    const v = draft.trim();
    if (!v || v.length > 80) return;
    if (!all.some((o) => o.value.toLowerCase() === v.toLowerCase())) setCustom((c) => [...c, v]);
    setSelected((s) => (s.includes(v) ? s : [...s, v]));
    setDraft("");
  };

  return (
    <fieldset aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="mb-2 text-[13px] font-medium leading-5 text-ink">
        {label}
        {required ? <span className="text-accent-strong" aria-hidden> *</span> : <span className="font-normal text-ink-muted"> (optional)</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {all.map((o) => {
          const on = selected.includes(o.value);
          return (
            <label
              key={o.value}
              className={cn(
                "inline-flex min-h-8 cursor-pointer select-none items-center gap-1.5 rounded-md border px-3 py-1 text-[13px] font-medium transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus max-sm:min-h-10",
                on ? "border-accent bg-accent-soft text-accent-strong" : "border-line-strong bg-surface text-ink-muted hover:border-line-control hover:text-ink",
              )}
            >
              <input type="checkbox" name={name} value={o.value} checked={on} onChange={() => toggle(o.value)} className="sr-only" />
              {on && <Check className="size-3.5" aria-hidden />}
              {o.label}
              {custom.includes(o.value) && (
                <button
                  type="button"
                  className="-mr-1 rounded-sm p-0.5 hover:bg-accent/15"
                  aria-label={`Remove ${o.label}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setCustom((c) => c.filter((x) => x !== o.value));
                    setSelected((s) => s.filter((x) => x !== o.value));
                  }}
                >
                  <X className="size-3" aria-hidden />
                </button>
              )}
            </label>
          );
        })}
      </div>
      {allowCustom && (
        <div className="mt-2 flex max-w-sm gap-2">
          <label htmlFor={`${id}-custom`} className="sr-only">Add another {label.toLowerCase()}</label>
          <input
            id={`${id}-custom`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Add another…"
            className={cn(fieldClass, "h-9 max-sm:h-10")}
          />
          <button
            type="button"
            onClick={addCustom}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:border-line-control hover:bg-surface-hover max-sm:h-10"
          >
            <Plus className="size-4" aria-hidden /> Add
          </button>
        </div>
      )}
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
      <FieldError name={name} />
    </fieldset>
  );
}
