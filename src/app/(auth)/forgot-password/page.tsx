import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forms";

export const metadata: Metadata = { title: "Forgot password", description: "Request a link to reset your Fashinza password." };

export default function ForgotPasswordPage() {
  return (
    <>
      <p className="eyebrow mb-4 text-accent-strong">Account recovery</p>
      <h1 className="font-display text-[2rem] font-[450] leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.375rem]">Reset your password</h1>
      <p className="mb-8 mt-3 text-[0.9375rem] leading-6 text-ink-muted">Enter the email you registered with and we will issue a reset link that is valid for one hour.</p>
      <ForgotPasswordForm />
      <p className="mt-8 border-t border-line pt-5 text-sm text-ink-muted">
        Remembered it? <Link href="/login" className="font-medium text-accent-strong underline decoration-accent-line underline-offset-4 transition-colors duration-150 hover:decoration-accent-strong">Back to sign in</Link>
      </p>
    </>
  );
}
