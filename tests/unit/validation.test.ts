import { describe, expect, it } from "vitest";
import { contactSchema } from "@/lib/validation/contact";
import { registerSchema, loginSchema } from "@/lib/validation/auth";

const validContact = {
  name: "Ayesha Khan",
  email: "AYESHA@Example.com ",
  company: "",
  inquiryType: "Brand enquiry",
  subject: "Hoodie production",
  message: "We want to produce 300 hoodies for our winter collection.",
};

describe("contact form validation", () => {
  it("accepts a valid enquiry and normalises the email", () => {
    const r = contactSchema.safeParse(validContact);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("ayesha@example.com");
      expect(r.data.company).toBeUndefined();
    }
  });
  it("rejects an invalid email, unknown enquiry type and short message", () => {
    const r = contactSchema.safeParse({ ...validContact, email: "nope", inquiryType: "Spam", message: "hi" });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["email", "inquiryType", "message"]));
  });
  it("rejects messages over 5,000 characters", () => {
    expect(contactSchema.safeParse({ ...validContact, message: "x".repeat(5001) }).success).toBe(false);
  });
});

const validRegister = {
  role: "BRAND",
  name: "Ayesha Khan",
  organization: "North Thread",
  email: "ayesha@example.com",
  password: "winter2026",
  confirmPassword: "winter2026",
};

describe("registration validation", () => {
  it("accepts a valid brand registration", () => {
    expect(registerSchema.safeParse(validRegister).success).toBe(true);
  });
  it("rejects ADMIN as a self-registration role", () => {
    expect(registerSchema.safeParse({ ...validRegister, role: "ADMIN" }).success).toBe(false);
  });
  it.each([
    ["short", "abc1"],
    ["no number", "abcdefgh"],
    ["no letter", "12345678"],
  ])("rejects a weak password (%s)", (_label, pw) => {
    expect(registerSchema.safeParse({ ...validRegister, password: pw, confirmPassword: pw }).success).toBe(false);
  });
  it("rejects mismatched passwords on the confirm field", () => {
    const r = registerSchema.safeParse({ ...validRegister, confirmPassword: "different1" });
    expect(r.success).toBe(false);
    expect(r.success ? null : r.error.issues[0].path).toEqual(["confirmPassword"]);
  });
  it("requires email and password to log in", () => {
    expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(false);
  });
});
