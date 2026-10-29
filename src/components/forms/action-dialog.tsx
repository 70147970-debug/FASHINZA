"use client";

import * as React from "react";
import { useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ActionForm, SubmitButton, type ServerAction } from "./action-form";

/**
 * Confirmation dialog for sensitive or irreversible actions. The trigger opens a modal that
 * explains the consequence; the action only runs when the user confirms inside it.
 */
export function ActionDialog({
  trigger,
  title,
  description,
  action,
  hidden = {},
  confirmLabel = "Confirm",
  pendingLabel,
  tone = "primary",
  children,
}: {
  trigger: React.ReactElement;
  title: string;
  description?: React.ReactNode;
  action: ServerAction;
  hidden?: Record<string, string>;
  confirmLabel?: string;
  pendingLabel?: string;
  tone?: "primary" | "accent" | "danger";
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description}>
        <ActionForm action={action} onSuccess={() => setOpen(false)} className="space-y-4">
          {Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {children}
          <div className="-mx-6 -mb-6 mt-6 flex flex-col-reverse gap-2 border-t border-line bg-surface-muted/60 px-6 py-4 max-sm:-mx-5 max-sm:-mb-5 max-sm:px-5 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <SubmitButton variant={tone as ButtonProps["variant"]} pendingText={pendingLabel}>
              {confirmLabel}
            </SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
