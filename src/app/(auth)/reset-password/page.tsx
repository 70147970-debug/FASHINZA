import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "../forgot-password/forms";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="type-title text-navy">Choose a new password</h1>
      <p className="mb-7 mt-1.5 text-sm leading-6 text-muted">Setting a new password signs you out on every other device.</p>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="error">
          This page needs the link from your reset email. <Link href="/forgot-password" className="font-medium underline">Request a new link</Link>.
        </Alert>
      )}
    </>
  );
}
