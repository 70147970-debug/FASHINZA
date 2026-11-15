import { Link, useSearchParams } from "react-router";
import { ForgotPasswordForm } from "./forgot-password-forms";
import { Alert } from "@/components/ui/alert";
import { PageMeta } from "@/components/meta";

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  // Old reset links (/reset-password?token=…) arrive here: links are no longer used, codes are.
  const fromLink = searchParams.get("link") === "old";
  return (
    <>
      <PageMeta title="Forgot password" description="Reset your Fashinza password with a 6-digit code sent to your email." />
      <p className="eyebrow mb-4 text-accent-strong">Account recovery</p>
      <h1 className="font-display text-[2rem] font-[450] leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.375rem]">Reset your password</h1>
      <p className="mb-8 mt-3 text-[0.9375rem] leading-6 text-ink-muted">
        Enter the email you registered with. We'll send you a 6-digit code that is valid for 10 minutes, then you can choose a new password.
      </p>
      {fromLink && (
        <Alert tone="info" title="Reset links are no longer used" className="mb-6">
          For your security, Fashinza now sends a 6-digit code instead of a link. Enter your email below to get a code.
        </Alert>
      )}
      <ForgotPasswordForm />
      <p className="mt-8 border-t border-line pt-5 text-sm text-ink-muted">
        Remembered it?{" "}
        <Link
          to="/login"
          className="py-2.5 font-medium text-accent-strong underline decoration-accent-line underline-offset-4 transition-colors duration-150 hover:decoration-accent-strong"
        >
          Back to sign in
        </Link>
      </p>
    </>
  );
}
