import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Login", description: "Sign in to your Fashinza account." };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in to Fashinza</h1>
      <p className="mb-8 mt-2 text-sm text-muted">Use the email and password you registered with.</p>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-muted">
        New to Fashinza? <Link href="/register" className="font-medium text-teal hover:underline">Create an account</Link>
      </p>
    </>
  );
}
