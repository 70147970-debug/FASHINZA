import { redirect } from "react-router";

/**
 * /reset-password — the old reset-link page. Passwords are now reset with an emailed 6-digit code, so old links
 * (with or without ?token=) go to /forgot-password, which explains the change.
 */
export function loader() {
  throw redirect("/forgot-password?link=old");
}

export default function ResetPasswordPage() {
  return null;
}
