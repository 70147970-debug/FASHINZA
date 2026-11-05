/**
 * Contact enquiries from the public contact form (port of src/app/(public)/contact/actions.ts).
 */
import { AppError } from "../lib/errors.js";
import { ContactInquiry } from "../models/ContactInquiry.js";

/**
 * Stores a validated enquiry. A storage failure is logged and reported with today's message.
 * @param {{ name: string, email: string, company?: string, inquiryType: string, subject: string, message: string }} data
 */
export async function createInquiry(data) {
  try {
    await ContactInquiry.create(data);
  } catch (err) {
    console.error("contact inquiry save failed", err);
    throw new AppError("We could not send your message right now. Please try again later.", "INTERNAL");
  }
}
