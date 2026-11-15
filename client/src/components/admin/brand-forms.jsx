import { BadgeCheck, XCircle } from "lucide-react";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Approve / Reject for a brand (POST /api/admin/brands/:id/approval). Approving marks it as a verified brand
 * (an optional note goes to the brand); rejecting needs a reason, which the brand sees. Decisions can be
 * revisited, so only the button for the current status is left out.
 * @param {{ brandId: string, name: string, status: "PENDING" | "APPROVED" | "REJECTED" }} props
 */
export function BrandDecision({ brandId, name, status }) {
  const action = `/api/admin/brands/${brandId}/approval`;
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "APPROVED" && (
        <ActionDialog
          trigger={
            <Button variant="accent">
              <BadgeCheck /> Approve brand
            </Button>
          }
          title={`Approve ${name}?`}
          description="The brand is shown as a verified brand and can create production projects straight away. It is told by email and in the app."
          action={action}
          hidden={{ decision: "APPROVED" }}
          confirmLabel="Approve brand"
          tone="accent"
        >
          <Field id="note" label="Note to the brand" hint="Recorded in the audit log and included in the brand's notification.">
            <Textarea name="note" rows={3} />
          </Field>
        </ActionDialog>
      )}
      {status !== "REJECTED" && (
        <ActionDialog
          trigger={
            <Button variant="outline">
              <XCircle /> {status === "APPROVED" ? "Withdraw approval" : "Reject brand"}
            </Button>
          }
          title={status === "APPROVED" ? `Withdraw ${name}'s approval?` : `Reject ${name}?`}
          description="The brand can still sign in and edit its company profile, but cannot create, edit or submit projects. It sees your reason by email and in the app, and you can approve it later."
          action={action}
          hidden={{ decision: "REJECTED" }}
          confirmLabel="Reject brand"
          tone="danger"
        >
          <Field id="note" label="Reason (shown to the brand)" required>
            <Textarea name="note" rows={3} />
          </Field>
        </ActionDialog>
      )}
    </div>
  );
}
