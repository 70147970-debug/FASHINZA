import { Link, useSearchParams } from "react-router";
import { ResetPasswordForm } from "./forgot-password-forms";
import { Alert } from "@/components/ui/alert";
import { PageMeta } from "@/components/meta";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  return (
    <>
      <PageMeta title="Choose a new password" noindex />
      <p className="eyebrow mb-4 text-accent-strong">Account recovery</p>
      <h1 className="font-display text-[2rem] font-[450] leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.375rem]">Choose a new password</h1>
      <p className="mb-8 mt-3 text-[0.9375rem] leading-6 text-ink-muted">Setting a new password signs you out on every other device.</p>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="error">
          This page needs the link from your reset email.{" "}
          <Link to="/forgot-password" className="font-medium underline underline-offset-4">
            Request a new link
          </Link>
          .
        </Alert>
      )}
    </>
  );
}
