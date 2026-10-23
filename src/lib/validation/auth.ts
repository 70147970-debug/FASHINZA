import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

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

export type RegisterInput = z.infer<typeof registerSchema>;
