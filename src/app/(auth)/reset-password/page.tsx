import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "../forgot-password/forms";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <p className="eyebrow mb-4 text-accent-strong">Account recovery</p>
      <h1 className="font-display text-[2rem] font-[450] leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.375rem]">Choose a new password</h1>
      <p className="mb-8 mt-3 text-[0.9375rem] leading-6 text-ink-muted">Setting a new password signs you out on every other device.</p>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="error">
          This page needs the link from your reset email. <Link href="/forgot-password" className="font-medium underline underline-offset-4">Request a new link</Link>.
        </Alert>
      )}
    </>
  );
}
