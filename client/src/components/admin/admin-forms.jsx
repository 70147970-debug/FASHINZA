import { BadgeCheck, Ban, RotateCcw, ShieldOff, XCircle } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field } from "@/components/ui/field";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/*
 * Admin forms. Each posts to its endpoint in docs/mern/api.md §11, §12 and §15 (the server actions of
 * src/app/(app)/admin/actions.ts); ids are in the URL path, the hidden inputs are kept as today.
 */

function Reason({ label = "Reason (recorded in the audit log)" }) {
  return (
    <Field id="reason" label={label} required>
      <Textarea name="reason" rows={3} />
    </Field>
  );
}

export function DocumentReviewButtons({ documentId, profileId }) {
  const action = `/api/admin/documents/${documentId}/review`;
  return (
    <div className="flex flex-wrap gap-2">
      <ActionDialog
        trigger={
          <Button variant="outline" size="sm">
            <BadgeCheck /> Verify
          </Button>
        }
        title="Verify this document?"
        description="Confirm you checked the document is genuine and current. Verified certifications count in matching."
        action={action}
        hidden={{ documentId, profileId, status: "VERIFIED" }}
        confirmLabel="Verify document"
        tone="accent"
      >
        <Field id="note" label="Note">
          <Textarea name="note" rows={2} />
        </Field>
      </ActionDialog>
      <ActionDialog
        trigger={
          <Button variant="ghost" size="sm">
            <XCircle /> Reject
          </Button>
        }
        title="Reject this document?"
        description="The factory sees your reason and can upload a replacement."
        action={action}
        hidden={{ documentId, profileId, status: "REJECTED" }}
        confirmLabel="Reject document"
        tone="danger"
      >
        <Field id="note" label="Reason" required>
          <Textarea name="note" rows={3} />
        </Field>
      </ActionDialog>
    </div>
  );
}

/**
 * Approve / Reject for a pending factory. While approval cannot succeed (`canApprove` false: the business
 * registration is not verified yet) Approve renders disabled, outside any dialog, and points at the element
 * that explains why (`blockedReasonId`). The server checks the same rule again.
 */
export function VerificationDecision({ profileId, name, canApprove = true, blockedReasonId }) {
  const action = `/api/admin/factories/${profileId}/verification`;
  return (
    <div className="flex flex-wrap gap-2">
      {canApprove ? (
        <ActionDialog
          trigger={
            <Button variant="accent">
              <BadgeCheck /> Approve factory
            </Button>
          }
          title={`Verify ${name}?`}
          description="The factory will be matched to brand projects and can send quotations. Its business registration must already be verified."
          action={action}
          hidden={{ profileId, decision: "VERIFIED" }}
          confirmLabel="Approve"
          tone="accent"
        >
          <Reason label="Verification note (recorded in the audit log)" />
        </ActionDialog>
      ) : (
        <Button variant="accent" disabled aria-describedby={blockedReasonId}>
          <BadgeCheck /> Approve factory
        </Button>
      )}
      <ActionDialog
        trigger={
          <Button variant="outline">
            <XCircle /> Reject
          </Button>
        }
        title={`Reject ${name}'s verification?`}
        description="The factory is told the reason and can fix its documents and apply again."
        action={action}
        hidden={{ profileId, decision: "REJECTED" }}
        confirmLabel="Reject verification"
        tone="danger"
      >
        <Reason />
      </ActionDialog>
    </div>
  );
}

export function RevokeVerificationButton({ profileId, name }) {
  return (
    <ActionDialog
      trigger={
        <Button variant="outline">
          <ShieldOff /> Revoke verification
        </Button>
      }
      title={`Revoke ${name}'s verification?`}
      description="The factory stops receiving new matches immediately. Existing orders continue."
      action={`/api/admin/factories/${profileId}/revoke`}
      hidden={{ profileId }}
      confirmLabel="Revoke"
      tone="danger"
    >
      <Reason />
    </ActionDialog>
  );
}

/** `size`: height only — "md" when the button sits in a page header next to other md actions. */
export function UserStatusButton({ userId, name, suspended, size = "sm" }) {
  // Suspending is an account action, not a verification decision, so it stays visibly secondary (ghost).
  return (
    <ActionDialog
      trigger={
        suspended ? (
          <Button variant="outline" size={size}>
            <RotateCcw /> Reactivate
          </Button>
        ) : (
          <Button variant="ghost" size={size}>
            <Ban /> Suspend
          </Button>
        )
      }
      title={suspended ? `Reactivate ${name}?` : `Suspend ${name}?`}
      description={suspended ? "The user can sign in again." : "The user is signed out everywhere and cannot sign in until reactivated. Their records are kept."}
      action={`/api/admin/users/${userId}/status`}
      hidden={{ userId, status: suspended ? "ACTIVE" : "SUSPENDED" }}
      confirmLabel={suspended ? "Reactivate" : "Suspend account"}
      tone={suspended ? "accent" : "danger"}
    >
      <Reason />
    </ActionDialog>
  );
}

export function RefundButton({ paymentMilestoneId, amount }) {
  return (
    <ActionDialog
      trigger={
        <Button variant="outline" size="sm">
          <RotateCcw /> Refund
        </Button>
      }
      title={`Refund ${amount}?`}
      description="A refund is requested from the payment provider (test mode: no real money moves) and the milestone is marked refunded when the provider confirms it."
      action={`/api/admin/payments/milestones/${paymentMilestoneId}/refund`}
      hidden={{ paymentMilestoneId }}
      confirmLabel="Issue refund"
      tone="danger"
    >
      <Reason />
    </ActionDialog>
  );
}

export function DisputeUpdateForm({ id, status, adminNote, resolution }) {
  return (
    <ActionForm action={`/api/admin/disputes/${id}`} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <Field id="status" label="Status" required>
        <Select name="status" defaultValue={status}>
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </Select>
      </Field>
      <Field id="adminNote" label="Internal note to the parties">
        <Textarea name="adminNote" rows={3} defaultValue={adminNote} />
      </Field>
      <Field id="resolution" label="Resolution" hint="Required to resolve or close.">
        <Textarea name="resolution" rows={3} defaultValue={resolution} />
      </Field>
      <SubmitButton pendingText="Saving…">Save update</SubmitButton>
    </ActionForm>
  );
}

export function EnquiryStatusForm({ id, status }) {
  return (
    <ActionForm action={`/api/admin/enquiries/${id}/status`} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`enq-${id}`} className="sr-only">
        Status
      </label>
      <Select id={`enq-${id}`} name="status" defaultValue={status} className="w-40 sm:h-8 sm:text-[13px]">
        <option value="NEW">New</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="RESOLVED">Resolved</option>
      </Select>
      <SubmitButton variant="outline" size="sm" pendingText="…">
        Save
      </SubmitButton>
    </ActionForm>
  );
}
