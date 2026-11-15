import { Link } from "react-router";
import { BadgeCheck, Building2, Check, Clock, Mail, Plus, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@fashinza/shared/utils.js";

/*
 * Brand approval on the brand's own pages (decision 1 of the MERN feature work). New brands are PENDING until an
 * administrator checks them (usually within 24–48 hours); until then they can edit their company profile but not
 * create projects. The session user (GET /api/auth/me) carries `approvalStatus` and `approvalNote`.
 */

/** The element the disabled "Create production project" buttons point at for their reason. */
export const APPROVAL_NOTICE_ID = "brand-approval";

/** Whether this signed-in user may create projects (non-brands are never limited here). */
export function brandIsApproved(user) {
  return !user || user.role !== "BRAND" || (user.approvalStatus ?? "APPROVED") === "APPROVED";
}

/**
 * "Create production project": a link for approved brands; for brands awaiting approval (or rejected) a disabled
 * button that points at the approval notice for its reason.
 */
export function CreateProjectButton({ user, className }) {
  if (brandIsApproved(user)) {
    return (
      <Button asChild variant="accent" className={className}>
        <Link to="/projects/new">
          <Plus /> Create production project
        </Link>
      </Button>
    );
  }
  const reason = user.approvalStatus === "REJECTED" ? "Your brand was not approved." : "Available once Fashinza approves your brand.";
  return (
    <Button variant="accent" disabled aria-describedby={APPROVAL_NOTICE_ID} title={reason} className={className}>
      <Plus /> Create production project
    </Button>
  );
}

/** "Verified brand" for approved brands; "Awaiting approval" / "Not approved" otherwise. */
export function BrandApprovalBadge({ status, className }) {
  const value = status ?? "APPROVED";
  if (value === "APPROVED") {
    return (
      <Badge tone="success" className={className}>
        <BadgeCheck className="size-3.5" aria-hidden /> Verified brand
      </Badge>
    );
  }
  return (
    <Badge tone={value === "REJECTED" ? "danger" : "warning"} dot className={className}>
      {value === "REJECTED" ? "Not approved" : "Awaiting approval"}
    </Badge>
  );
}

function Step({ state, children }) {
  return (
    <li className="flex items-start gap-2 text-[13px] leading-5">
      {state === "done" ? (
        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-success-line bg-success-soft text-success-strong" aria-hidden>
          <Check className="size-2.5" strokeWidth={3.5} />
        </span>
      ) : state === "current" ? (
        <Clock className="mt-0.5 size-4 shrink-0 text-warning-strong" strokeWidth={2} aria-hidden />
      ) : (
        <span className="mt-0.5 size-4 shrink-0 rounded-full border border-line-strong bg-surface" aria-hidden />
      )}
      <span className={state === "todo" ? "text-ink-muted" : "text-ink"}>
        {children}
        <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (in progress)" : " (to do)"}</span>
      </span>
    </li>
  );
}

/**
 * The approval notice for a brand that is not approved yet (nothing renders for approved brands).
 * `profileLink` adds a "Complete company profile" link (leave it off on the profile and onboarding pages).
 * @param {{ user: { role: string, approvalStatus?: string, approvalNote?: string | null, profileCompleted?: boolean } | null, profileLink?: boolean, className?: string }} props
 */
export function BrandApprovalNotice({ user, profileLink = true, className }) {
  if (brandIsApproved(user)) return null;
  const rejected = user.approvalStatus === "REJECTED";
  return (
    <section
      id={APPROVAL_NOTICE_ID}
      aria-labelledby={`${APPROVAL_NOTICE_ID}-title`}
      className={cn(
        "mb-6 min-w-0 rounded-lg border p-4 sm:p-5",
        rejected ? "border-danger-line bg-danger-soft/60" : "border-warning-line bg-warning-soft/60",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-md border bg-surface",
            rejected ? "border-danger-line text-danger-strong" : "border-warning-line text-warning-strong",
          )}
          aria-hidden
        >
          {rejected ? <XCircle className="size-5" strokeWidth={1.75} /> : <Clock className="size-5" strokeWidth={1.75} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("eyebrow", rejected ? "text-danger-strong" : "text-warning-strong")}>Brand approval</p>
          <h2 id={`${APPROVAL_NOTICE_ID}-title`} className="type-heading mt-1 break-words text-ink">
            {rejected ? "Your brand was not approved" : "Your brand is under review"}
          </h2>
          {rejected ? (
            <div className="mt-1 max-w-2xl space-y-2 text-sm leading-6 text-ink">
              {user.approvalNote && (
                <p>
                  <span className="font-medium">Reason from the Fashinza team:</span> <span className="break-words">{user.approvalNote}</span>
                </p>
              )}
              <p className="text-ink-muted">
                You can't create production projects at the moment. You can still update your company profile. If you think this is a mistake, contact
                us.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">
                Fashinza checks every new brand within 24–48 hours. You'll get an email and a notification as soon as your brand is approved, and
                then you can create production projects. Meanwhile, complete your company profile: a website or social media link and a short
                description help us confirm your brand.
              </p>
              <ol aria-label="Approval progress" className="mt-3 grid gap-1.5 sm:grid-cols-3">
                <Step state="done">Account created</Step>
                <Step state={user.profileCompleted ? "done" : "current"}>Company profile</Step>
                <Step state="current">Fashinza review (24–48 hours)</Step>
              </ol>
            </>
          )}
          {(profileLink || rejected) && (
            <div className="mt-4 flex flex-wrap gap-2 max-sm:[&>*]:grow">
              {profileLink && (
                <Button asChild variant="outline">
                  <Link to="/profile">
                    <Building2 /> {rejected || user.profileCompleted ? "Update company profile" : "Complete company profile"}
                  </Link>
                </Button>
              )}
              {rejected && (
                <Button asChild variant="ghost">
                  <Link to="/contact">
                    <Mail /> Contact us
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
