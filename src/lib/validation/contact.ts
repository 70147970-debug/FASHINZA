import { z } from "zod";

export const INQUIRY_TYPES = ["Brand enquiry", "Manufacturer enquiry", "Partnership", "Support", "Other"] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name (at least 2 characters).").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  company: z.string().trim().max(150).optional().transform((v) => v || undefined),
  inquiryType: z.enum(INQUIRY_TYPES, { errorMap: () => ({ message: "Choose an enquiry type." }) }),
  subject: z.string().trim().min(3, "Enter a subject (at least 3 characters).").max(150),
  message: z.string().trim().min(20, "Write at least 20 characters so we can help.").max(5000, "Keep your message under 5,000 characters."),
});

export type ContactInput = z.infer<typeof contactSchema>;
