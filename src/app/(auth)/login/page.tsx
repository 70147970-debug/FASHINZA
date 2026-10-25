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
      <h1 className="type-title text-navy">Sign in to Fashinza</h1>
      <p className="mb-7 mt-1.5 text-sm leading-6 text-muted">Use the email and password you registered with.</p>
      {reset && <Alert tone="success" className="mb-5">Your password was changed. Sign in with your new password.</Alert>}
      {signedOut && <Alert tone="info" className="mb-5">You have been signed out.</Alert>}
      <LoginForm next={next} />
      <p className="mt-7 border-t border-line-subtle pt-5 text-center text-sm text-muted">
        New to Fashinza? <Link href="/register" className="font-medium text-teal-700 hover:underline">Create an account</Link>
      </p>
    </>
  );
}
