import { z } from "zod";

/** Allowed length of a new password, in characters (Unicode code points). */
export const PASSWORD_LENGTH = Object.freeze({ min: 12, max: 16 });

/**
 * The password policy for every NEW password (registration, reset, change password; signing in does not apply
 * it, so older passwords keep working). One entry per rule, in the order the messages are reported:
 * `message` is the validation error, `label` the wording of the live checklist under the field
 * (client/src/components/forms/password-requirements.jsx). Letters and numbers follow Unicode categories, so
 * "É" counts as a capital letter; a symbol is anything that is not a letter, a number or a space.
 * @type {readonly { key: string, label: string, message: string, test: (value: string) => boolean }[]}
 */
export const PASSWORD_RULES = Object.freeze([
  {
    key: "length",
    label: `${PASSWORD_LENGTH.min} to ${PASSWORD_LENGTH.max} characters`,
    message: `Use ${PASSWORD_LENGTH.min} to ${PASSWORD_LENGTH.max} characters.`,
    test: (v) => [...v].length >= PASSWORD_LENGTH.min && [...v].length <= PASSWORD_LENGTH.max,
  },
  { key: "upper", label: "A capital letter (A–Z)", message: "Include at least one capital letter.", test: (v) => /\p{Lu}/u.test(v) },
  { key: "lower", label: "A small letter (a–z)", message: "Include at least one small letter.", test: (v) => /\p{Ll}/u.test(v) },
  { key: "number", label: "A number (0–9)", message: "Include at least one number.", test: (v) => /\p{N}/u.test(v) },
  { key: "symbol", label: "A symbol, such as ! @ # $ %", message: "Include at least one symbol, such as ! @ # $ %.", test: (v) => /[^\p{L}\p{N}\s]/u.test(v) },
  { key: "spaces", label: "No spaces", message: "Don't use spaces.", test: (v) => !/\s/u.test(v) },
]);

/**
 * Each rule with whether `value` meets it (for the live checklist).
 * @param {string | null | undefined} value
 * @returns {{ key: string, label: string, met: boolean }[]}
 */
export function passwordChecks(value) {
  const v = typeof value === "string" ? value : "";
  return PASSWORD_RULES.map((r) => ({ key: r.key, label: r.label, met: r.test(v) }));
}

/** A new password: every rule of PASSWORD_RULES, reported in order (the field shows the first). */
export const passwordSchema = z.string().superRefine((value, ctx) => {
  for (const rule of PASSWORD_RULES) if (!rule.test(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: rule.message });
});

export const registerSchema = z
  .object({
    role: z.enum(["BRAND", "MANUFACTURER"], { errorMap: () => ({ message: "Choose an account type." }) }),
    name: z.string().trim().min(2, "Enter your full name.").max(100),
    organization: z.string().trim().min(2, "Enter your company or factory name.").max(150),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const emailField = z.string({ required_error: "Enter a valid email address." }).trim().toLowerCase().email("Enter a valid email address.").max(200);

/** Forgot password, step 1: where to send the 6-digit code. */
export const forgotPasswordSchema = z.object({ email: emailField });

/** Number of digits in an emailed password-reset code. */
export const RESET_CODE_LENGTH = 6;

/**
 * Forgot password, step 2: the emailed code. Spaces are ignored (codes are often pasted as "123 456"); anything
 * that is not six digits cannot be the right code.
 */
export const resetCodeSchema = z.object({
  email: emailField,
  code: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s+/g, "") : v),
    z
      .string({ required_error: "Enter the 6-digit code from the email." })
      .min(1, "Enter the 6-digit code from the email.")
      .regex(new RegExp(`^\\d{${RESET_CODE_LENGTH}}$`), "You have entered the incorrect code."),
  ),
});

/** Forgot password, step 3: the new password, with the reset token issued when the code was verified. */
export const resetPasswordSchema = z
  .object({ token: z.string().min(10, "Your reset session has expired. Request a new code."), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

/** @typedef {z.infer<typeof registerSchema>} RegisterInput */
