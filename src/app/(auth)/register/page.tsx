import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Register", description: "Create a Fashinza account as a fashion brand or a manufacturer." };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const defaultRole = role?.toLowerCase() === "manufacturer" ? "MANUFACTURER" : "BRAND";
  return (
    <>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mb-8 mt-2 text-sm text-muted">Registration is free. You will complete your profile after signing in.</p>
      <RegisterForm defaultRole={defaultRole} />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-medium text-teal hover:underline">Sign in</Link>
      </p>
    </>
  );
}
