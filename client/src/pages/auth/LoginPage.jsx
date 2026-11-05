import { Link, useSearchParams } from "react-router";
import { LoginForm } from "./login-form";
import { Alert } from "@/components/ui/alert";
import { PageMeta } from "@/components/meta";

/** Signed-in visitors are sent to their workspace by the router before this page renders (src/router.jsx). */
export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") ?? undefined;
  const reset = searchParams.get("reset");
  const signedOut = searchParams.get("signedOut");
  return (
    <>
      <PageMeta title="Login" description="Sign in to manage your garment projects, quotations and production orders on Fashinza." />
      <p className="eyebrow mb-4 text-accent-strong">Welcome back</p>
      <h1 className="font-display text-[2rem] font-[450] leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.375rem]">Sign in to Fashinza</h1>
      <p className="mb-8 mt-3 text-[0.9375rem] leading-6 text-ink-muted">Pick up your projects, quotations and production orders where you left them.</p>
      {reset && (
        <Alert tone="success" className="mb-5">
          Your password was changed. Sign in with your new password.
        </Alert>
      )}
      {signedOut && (
        <Alert tone="info" className="mb-5">
          You have been signed out.
        </Alert>
      )}
      <LoginForm next={next} />
      <p className="mt-8 border-t border-line pt-5 text-sm text-ink-muted">
        New to Fashinza?{" "}
        <Link
          to="/register"
          className="py-2.5 font-medium text-accent-strong underline decoration-accent-line underline-offset-4 transition-colors duration-150 hover:decoration-accent-strong"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
