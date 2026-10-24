"use client";

import { BadgeCheck, Ban, RotateCcw, ShieldOff, XCircle } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field } from "@/components/ui/field";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  decideVerificationAction, refundAction, reviewDocumentAction, revokeVerificationAction, setEnquiryStatusAction, setUserStatusAction, updateDisputeAction,
} from "@/app/(app)/admin/actions";

function Reason({ label = "Reason (recorded in the audit log)" }: { label?: string }) {
  return (
    <Field id="reason" label={label} required>
      <Textarea name="reason" rows={3} />
    </Field>
  );
}

export function DocumentReviewButtons({ documentId, profileId }: { documentId: string; profileId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionDialog
        trigger={<Button variant="outline" size="sm"><BadgeCheck /> Verify</Button>}
        title="Verify this document?"
        description="Confirm you checked the document is genuine and current. Verified certifications count in matching."
        action={reviewDocumentAction}
        hidden={{ documentId, profileId, status: "VERIFIED" }}
        confirmLabel="Verify document"
        tone="accent"
      >
        <Field id="note" label="Note"><Textarea name="note" rows={2} /></Field>
      </ActionDialog>
      <ActionDialog
        trigger={<Button variant="ghost" size="sm"><XCircle /> Reject</Button>}
        title="Reject this document?"
        description="The factory sees your reason and can upload a replacement."
        action={reviewDocumentAction}
        hidden={{ documentId, profileId, status: "REJECTED" }}
        confirmLabel="Reject document"
        tone="danger"
      >
        <Field id="note" label="Reason" required><Textarea name="note" rows={3} /></Field>
      </ActionDialog>
    </div>
  );
}

export function VerificationDecision({ profileId, name }: { profileId: string; name: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionDialog
        trigger={<Button variant="accent"><BadgeCheck /> Approve factory</Button>}
        title={`Verify ${name}?`}
        description="The factory will be matched to brand projects and can send quotations. Its business registration must already be verified."
        action={decideVerificationAction}
        hidden={{ profileId, decision: "VERIFIED" }}
        confirmLabel="Approve"
        tone="accent"
      >
        <Reason label="Verification note (recorded in the audit log)" />
      </ActionDialog>
      <ActionDialog
        trigger={<Button variant="outline"><XCircle /> Reject</Button>}
        title={`Reject ${name}'s verification?`}
        description="The factory is told the reason and can fix its documents and apply again."
        action={decideVerificationAction}
        hidden={{ profileId, decision: "REJECTED" }}
        confirmLabel="Reject verification"
        tone="danger"
      >
        <Reason />
      </ActionDialog>
    </div>
  );
}

export function RevokeVerificationButton({ profileId, name }: { profileId: string; name: string }) {
  return (
    <ActionDialog
      trigger={<Button variant="outline"><ShieldOff /> Revoke verification</Button>}
      title={`Revoke ${name}'s verification?`}
      description="The factory stops receiving new matches immediately. Existing orders continue."
      action={revokeVerificationAction}
      hidden={{ profileId }}
      confirmLabel="Revoke"
      tone="danger"
    >
      <Reason />
    </ActionDialog>
  );
}

export function UserStatusButton({ userId, name, suspended }: { userId: string; name: string; suspended: boolean }) {
  return (
    <ActionDialog
      trigger={suspended ? <Button variant="outline" size="sm"><RotateCcw /> Reactivate</Button> : <Button variant="ghost" size="sm"><Ban /> Suspend</Button>}
      title={suspended ? `Reactivate ${name}?` : `Suspend ${name}?`}
      description={suspended ? "The user can sign in again." : "The user is signed out everywhere and cannot sign in until reactivated. Their records are kept."}
      action={setUserStatusAction}
      hidden={{ userId, status: suspended ? "ACTIVE" : "SUSPENDED" }}
      confirmLabel={suspended ? "Reactivate" : "Suspend account"}
      tone={suspended ? "accent" : "danger"}
    >
      <Reason />
    </ActionDialog>
  );
}

export function RefundButton({ paymentMilestoneId, amount }: { paymentMilestoneId: string; amount: string }) {
  return (
    <ActionDialog
      trigger={<Button variant="outline" size="sm"><RotateCcw /> Refund</Button>}
      title={`Refund ${amount}?`}
      description="A refund is requested from the (sandbox) provider and the milestone is marked refunded when the provider confirms it."
      action={refundAction}
      hidden={{ paymentMilestoneId }}
      confirmLabel="Issue refund"
      tone="danger"
    >
      <Reason />
    </ActionDialog>
  );
}

export function DisputeUpdateForm({ id, status, adminNote, resolution }: { id: string; status: string; adminNote: string; resolution: string }) {
  return (
    <ActionForm action={updateDisputeAction} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <Field id="status" label="Status" required>
        <Select name="status" defaultValue={status}>
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </Select>
      </Field>
      <Field id="adminNote" label="Internal note to the parties"><Textarea name="adminNote" rows={3} defaultValue={adminNote} /></Field>
      <Field id="resolution" label="Resolution" hint="Required to resolve or close."><Textarea name="resolution" rows={3} defaultValue={resolution} /></Field>
      <SubmitButton pendingText="Saving…">Save update</SubmitButton>
    </ActionForm>
  );
}

export function EnquiryStatusForm({ id, status }: { id: string; status: string }) {
  return (
    <ActionForm action={setEnquiryStatusAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`enq-${id}`} className="sr-only">Status</label>
      <Select id={`enq-${id}`} name="status" defaultValue={status} className="h-8 w-36 text-xs">
        <option value="NEW">New</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="RESOLVED">Resolved</option>
      </Select>
      <SubmitButton variant="outline" size="sm" pendingText="…">Save</SubmitButton>
    </ActionForm>
  );
}
