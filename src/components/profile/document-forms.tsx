"use client";

import { useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, FieldError } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CERTIFICATIONS, UPLOAD_LIMITS } from "@/lib/constants";
import { deleteDocumentAction, requestVerificationAction, uploadDocumentAction } from "@/app/(app)/profile-actions";

export function UploadDocumentForm() {
  const [type, setType] = useState("BUSINESS_REGISTRATION");
  return (
    <ActionForm action={uploadDocumentAction} resetOnSuccess className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field id="doc-type" name="type" label="Document type" required>
        <Select name="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="BUSINESS_REGISTRATION">Business registration</option>
          <option value="CERTIFICATION">Certification</option>
          <option value="OTHER">Other</option>
        </Select>
      </Field>
      {type === "CERTIFICATION" ? (
        <Field id="certificationName" label="Certification" required>
          <Select name="certificationName" defaultValue="">
            <option value="" disabled>Choose one</option>
            {CERTIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      ) : (
        <div className="hidden sm:block" />
      )}
      <div className="sm:col-span-2">
        <label htmlFor="doc-file" className="mb-1.5 block text-sm font-medium text-ink">File <span className="text-danger" aria-hidden>*</span></label>
        <input
          id="doc-file"
          name="file"
          type="file"
          accept={UPLOAD_LIMITS.allowedMime.join(",")}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-navy hover:file:bg-navy-50"
        />
        <p className="mt-1 text-xs text-muted">PDF, PNG, JPEG or WebP, up to {UPLOAD_LIMITS.maxBytes / 1024 / 1024} MB. Stored privately; only you and administrators can open it.</p>
        <FieldError name="file" />
      </div>
      <SubmitButton variant="outline" pendingText="Uploading…"><Upload /> Upload</SubmitButton>
    </ActionForm>
  );
}

export function DeleteDocumentButton({ id, name }: { id: string; name: string }) {
  return (
    <ActionDialog
      trigger={<Button variant="ghost" size="icon" aria-label={`Delete ${name}`}><Trash2 className="size-4" /></Button>}
      title="Delete this document?"
      description={`“${name}” will be removed permanently. You can upload a replacement afterwards.`}
      action={deleteDocumentAction}
      hidden={{ documentId: id }}
      confirmLabel="Delete document"
      tone="danger"
    />
  );
}

export function RequestVerificationButton({ disabled }: { disabled?: boolean }) {
  return (
    <ActionDialog
      trigger={<Button variant="accent" disabled={disabled}>Request verification</Button>}
      title="Request verification?"
      description="An administrator will review your profile and documents. You will be notified of the decision, and you can keep editing your profile meanwhile."
      action={requestVerificationAction}
      confirmLabel="Send request"
      tone="accent"
    />
  );
}
