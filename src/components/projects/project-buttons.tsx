"use client";

import { RefreshCw, Trash2, XCircle } from "lucide-react";
import { ActionDialog } from "@/components/forms/action-dialog";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import {
  acceptQuotationAction, cancelProjectAction, deleteAttachmentAction, deleteDraftAction, rejectQuotationAction, requestRevisionAction, rerunMatchingAction, submitProjectAction,
} from "@/app/(app)/projects/actions";

export function DeleteAttachmentButton({ id, name, projectId }: { id: string; name: string; projectId: string }) {
  return (
    <ActionDialog
      trigger={<Button variant="ghost" size="icon" aria-label={`Remove ${name}`}><Trash2 className="size-4" /></Button>}
      title="Remove this file?"
      description={`“${name}” will be deleted. Files on submitted projects are kept as history and cannot be removed.`}
      action={deleteAttachmentAction}
      hidden={{ attachmentId: id, projectId }}
      confirmLabel="Remove file"
      tone="danger"
    />
  );
}

export function SubmitProjectForm({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  return (
    <ActionForm action={submitProjectAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <SubmitButton variant="accent" size="lg" disabled={disabled} pendingText="Submitting and matching…">Submit project for matching</SubmitButton>
    </ActionForm>
  );
}

export function RerunMatchingButton({ projectId }: { projectId: string }) {
  return (
    <ActionForm action={rerunMatchingAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <SubmitButton variant="outline" size="sm" pendingText="Matching…"><RefreshCw /> Run matching again</SubmitButton>
    </ActionForm>
  );
}

export function CancelProjectButton({ projectId }: { projectId: string }) {
  return (
    <ActionDialog
      trigger={<Button variant="outline"><XCircle /> Cancel project</Button>}
      title="Cancel this project?"
      description="Open quotations are closed and the factories are notified. This cannot be undone."
      action={cancelProjectAction}
      hidden={{ projectId }}
      confirmLabel="Cancel project"
      tone="danger"
    >
      <Field id="reason" label="Reason" required>
        <Textarea name="reason" rows={3} />
      </Field>
    </ActionDialog>
  );
}

export function DeleteDraftButton({ projectId }: { projectId: string }) {
  return (
    <ActionDialog
      trigger={<Button variant="outline"><Trash2 /> Delete draft</Button>}
      title="Delete this draft?"
      description="The draft and its uploaded files are deleted permanently."
      action={deleteDraftAction}
      hidden={{ projectId }}
      confirmLabel="Delete draft"
      tone="danger"
    />
  );
}

export function QuotationDecisionButtons({ quotationId, projectId, factory, total, canAccept }: { quotationId: string; projectId: string; factory: string; total: string; canAccept: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {canAccept && (
        <ActionDialog
          trigger={<Button variant="accent" size="sm">Accept</Button>}
          title={`Accept ${factory}'s quotation?`}
          description={`This creates the production order for ${total} using the quoted terms, starts the production plan, and declines every other quotation on this project.`}
          action={acceptQuotationAction}
          hidden={{ quotationId, projectId }}
          confirmLabel="Accept and create order"
          pendingLabel="Creating order…"
          tone="accent"
        />
      )}
      <ActionDialog
        trigger={<Button variant="outline" size="sm">Request revision</Button>}
        title="Request a revised quotation"
        description="The factory is notified and can send a new version. Earlier versions stay in the history."
        action={requestRevisionAction}
        hidden={{ quotationId, projectId }}
        confirmLabel="Send request"
      >
        <Field id="note" label="What should change?" required>
          <Textarea name="note" rows={3} placeholder="For example: reduce the sampling charge or shorten production to 35 days." />
        </Field>
      </ActionDialog>
      <ActionDialog
        trigger={<Button variant="ghost" size="sm">Decline</Button>}
        title="Decline this quotation?"
        description="The factory is notified with your reason. A declined quotation cannot be accepted later."
        action={rejectQuotationAction}
        hidden={{ quotationId, projectId }}
        confirmLabel="Decline quotation"
        tone="danger"
      >
        <Field id="note" label="Reason" required>
          <Textarea name="note" rows={3} />
        </Field>
      </ActionDialog>
    </div>
  );
}
