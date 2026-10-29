import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { Alert } from "@/components/ui/alert";
import { getCurrentUser } from "@/server/auth/session";
import { homeFor } from "@/components/app/nav";

export const metadata: Metadata = { title: "Login", description: "Sign in to your Fashinza account." };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; signedOut?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const { next, reset, signedOut } = await searchParams;
  return (
    <>
      <p className="eyebrow mb-4 text-accent-strong">Your account</p>
      <h1 className="font-display text-[2rem] font-[450] leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.375rem]">Sign in to Fashinza</h1>
      <p className="mb-8 mt-3 text-[0.9375rem] leading-6 text-ink-muted">Use the email and password you registered with.</p>
      {reset && <Alert tone="success" className="mb-5">Your password was changed. Sign in with your new password.</Alert>}
      {signedOut && <Alert tone="info" className="mb-5">You have been signed out.</Alert>}
      <LoginForm next={next} />
      <p className="mt-8 border-t border-line pt-5 text-sm text-ink-muted">
        New to Fashinza? <Link href="/register" className="font-medium text-accent-strong underline decoration-accent-line underline-offset-4 transition-colors duration-150 hover:decoration-accent-strong">Create an account</Link>
      </p>
    </>
  );
}
