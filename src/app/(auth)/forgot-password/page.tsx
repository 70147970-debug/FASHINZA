import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forms";

export const metadata: Metadata = { title: "Forgot password", description: "Request a link to reset your Fashinza password." };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="type-title text-navy">Reset your password</h1>
      <p className="mb-7 mt-1.5 text-sm leading-6 text-muted">Enter the email you registered with and we will issue a reset link that is valid for one hour.</p>
      <ForgotPasswordForm />
      <p className="mt-7 border-t border-line-subtle pt-5 text-center text-sm text-muted">
        Remembered it? <Link href="/login" className="font-medium text-teal-700 hover:underline">Back to sign in</Link>
      </p>
    </>
  );
}
