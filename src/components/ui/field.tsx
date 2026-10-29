"use client";
import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "./label";
import { FormErrorsContext } from "@/components/forms/action-form";

/** Label + control + hint/error, wired for screen readers. Errors come from props or the enclosing ActionForm. */
export function Field({
  id,
  label,
  error,
  hint,
  required,
  name,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Error key when it differs from id (defaults to id). */
  name?: string;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string; required?: boolean }>;
  className?: string;
}) {
  const ctx = React.useContext(FormErrorsContext);
  const message = error ?? ctx[name ?? id];
  const describedBy = [hint && `${id}-hint`, message && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const control = React.cloneElement(children, {
    id,
    "aria-invalid": message ? true : undefined,
    "aria-describedby": describedBy,
    required,
  });
  return (
    <div className={className ?? "space-y-1.5"}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-accent-strong" aria-hidden> *</span> : <span className="font-normal text-ink-muted"> (optional)</span>}
      </Label>
      {control}
      {hint && !message && <p id={`${id}-hint`} className="text-xs leading-4 text-ink-muted">{hint}</p>}
      {message && (
        <p id={`${id}-error`} className="flex items-start gap-1 text-xs font-medium leading-4 text-danger-strong">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {message}
        </p>
      )}
    </div>
  );
}

/** Error line for groups (checkbox sets, file pickers) that are not a single labelled control. */
export function FieldError({ name, className }: { name: string; className?: string }) {
  const message = React.useContext(FormErrorsContext)[name];
  if (!message) return null;
  return <p className={className ?? "mt-1.5 text-xs font-medium leading-4 text-danger-strong"}>{message}</p>;
}
