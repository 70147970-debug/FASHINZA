import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";
import { getCurrentUser } from "@/server/auth/session";
import { homeFor } from "@/components/app/nav";

export const metadata: Metadata = { title: "Register", description: "Create a free Fashinza account as a fashion brand sourcing garment production or as a garment manufacturer." };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const { role } = await searchParams;
  const defaultRole = role?.toLowerCase() === "manufacturer" ? "MANUFACTURER" : "BRAND";
  return (
    <>
      <p className="eyebrow mb-4 text-accent-strong">Free registration</p>
      <h1 className="font-display text-[2rem] font-[450] leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.375rem]">Create your account</h1>
      <p className="mb-8 mt-3 text-[0.9375rem] leading-6 text-ink-muted">For fashion brands sourcing production and for factories offering it. Registration is free; you will complete your brand or factory profile next.</p>
      <RegisterForm defaultRole={defaultRole} />
      <p className="mt-8 border-t border-line pt-5 text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="py-2.5 font-medium text-accent-strong underline decoration-accent-line underline-offset-4 transition-colors duration-150 hover:decoration-accent-strong">Sign in</Link>
      </p>
    </>
  );
}
