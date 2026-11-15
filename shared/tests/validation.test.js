import { describe, expect, it } from "vitest";
import { contactSchema } from "../src/validation/contact.js";
import { registerSchema, loginSchema, passwordSchema, passwordChecks, PASSWORD_RULES, resetCodeSchema, resetPasswordSchema } from "../src/validation/auth.js";
import { changePasswordSchema } from "../src/validation/profile.js";
import { projectDraftSchema, projectSubmitSchema, PROJECT_STEPS, REVIEW_STEP, FILES_STEP } from "../src/validation/project.js";
import { quotationSchema } from "../src/validation/quotation.js";
import { categoryLabel, fieldLabel, formatRevisionValue, sampleRequestSummary } from "../src/labels.js";
import { ATTACHMENT_KINDS } from "../src/constants.js";

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
  password: "Winter#2026ab",
  confirmPassword: "Winter#2026ab",
};

describe("registration validation", () => {
  it("accepts a valid brand registration", () => {
    expect(registerSchema.safeParse(validRegister).success).toBe(true);
  });
  it("rejects ADMIN as a self-registration role", () => {
    expect(registerSchema.safeParse({ ...validRegister, role: "ADMIN" }).success).toBe(false);
  });
  it.each([
    ["short", "Ab1!", "Use 12 to 16 characters."],
    ["17 characters", "Abcdefghijklm12!x", "Use 12 to 16 characters."],
    ["no capital letter", "winter#2026ab", "Include at least one capital letter."],
    ["no small letter", "WINTER#2026AB", "Include at least one small letter."],
    ["no number", "Winter#Garden", "Include at least one number."],
    ["no symbol", "Winter2026abc", "Include at least one symbol, such as ! @ # $ %."],
    ["a space", "Winter 2026a#", "Don't use spaces."],
  ])("rejects a weak password (%s) with the policy message", (_label, pw, message) => {
    const r = registerSchema.safeParse({ ...validRegister, password: pw, confirmPassword: pw });
    expect(r.success).toBe(false);
    expect(r.success ? null : r.error.issues[0]).toMatchObject({ path: ["password"], message });
  });
  it("accepts 12 and 16 characters, and non-English letters", () => {
    for (const pw of ["Brand#Pass26", "Factory#Pass2026", "Ünïcødé#Pass1"]) expect(passwordSchema.safeParse(pw).success, pw).toBe(true);
  });
  it("reports every unmet rule in policy order and ticks the checklist", () => {
    const r = passwordSchema.safeParse("abc");
    expect(r.success ? [] : r.error.issues.map((i) => i.message)).toEqual([
      "Use 12 to 16 characters.",
      "Include at least one capital letter.",
      "Include at least one number.",
      "Include at least one symbol, such as ! @ # $ %.",
    ]);
    expect(passwordChecks("Brand#Pass2026").every((c) => c.met)).toBe(true);
    expect(passwordChecks("").filter((c) => c.met).map((c) => c.key)).toEqual(["spaces"]);
    expect(PASSWORD_RULES.map((rule) => rule.key)).toEqual(["length", "upper", "lower", "number", "symbol", "spaces"]);
  });
  it("uses the same policy when changing a password", () => {
    const r = changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "Password123", confirmPassword: "Password123" });
    expect(r.success ? null : r.error.issues[0]).toMatchObject({ path: ["newPassword"], message: "Use 12 to 16 characters." });
  });
  it("rejects mismatched passwords on the confirm field", () => {
    const r = registerSchema.safeParse({ ...validRegister, confirmPassword: "Different#2026" });
    expect(r.success).toBe(false);
    expect(r.success ? null : r.error.issues[0].path).toEqual(["confirmPassword"]);
  });
  it("requires email and password to log in, without the new-password policy", () => {
    expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@example.com", password: "winter2026" }).success).toBe(true);
  });
});

describe("password reset code validation", () => {
  it("ignores spaces and needs exactly six digits", () => {
    expect(resetCodeSchema.parse({ email: "A@Example.com", code: " 123 456 " })).toEqual({ email: "a@example.com", code: "123456" });
    const empty = resetCodeSchema.safeParse({ email: "a@example.com", code: "" });
    expect(empty.success ? null : empty.error.issues[0].message).toBe("Enter the 6-digit code from the email.");
    for (const bad of ["12345", "1234567", "12a456"]) {
      const r = resetCodeSchema.safeParse({ email: "a@example.com", code: bad });
      expect(r.success ? null : r.error.issues[0].message).toBe("You have entered the incorrect code.");
    }
  });
  it("checks the new password and confirmation on the last step", () => {
    const r = resetPasswordSchema.safeParse({ token: "x".repeat(20), password: "Brand#Pass2026", confirmPassword: "Brand#Pass2027" });
    expect(r.success ? null : r.error.issues[0].path).toEqual(["confirmPassword"]);
  });
});

const completeProject = {
  name: "Organic tee",
  category: "T_SHIRTS",
  description: "Heavyweight organic cotton crew-neck tee with a front screen print.",
  fabricRequirements: "100% organic cotton jersey, 220 gsm",
  colors: "Black",
  sizes: ["S", "M"],
  quantity: 500,
  deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
};

describe("project sample request validation", () => {
  it("reads the Yes/No radio values and keeps optional sample fields optional", () => {
    const yes = projectDraftSchema.partial().parse({ sampleRequired: "true", sampleQuantity: "2", sampleSizes: ["M"], sampleNotes: "" });
    expect(yes).toMatchObject({ sampleRequired: true, sampleQuantity: 2, sampleSizes: ["M"], sampleNotes: undefined });
    expect(projectDraftSchema.partial().parse({ sampleRequired: "false", sampleQuantity: "" })).toMatchObject({ sampleRequired: false, sampleQuantity: undefined });
  });
  it("limits sample pieces to whole numbers from 1 to 50", () => {
    for (const bad of ["0", "51", "2.5", "abc"]) expect(projectDraftSchema.partial().safeParse({ sampleQuantity: bad }).success).toBe(false);
  });
  it("needs a sample quantity on submission only when samples are requested", () => {
    expect(projectSubmitSchema.safeParse({ ...completeProject, sampleRequired: true, sampleQuantity: 1 }).success).toBe(true);
    expect(projectSubmitSchema.safeParse({ ...completeProject, sampleRequired: false }).success).toBe(true);
    const missing = projectSubmitSchema.safeParse({ ...completeProject, sampleRequired: true });
    expect(missing.success ? [] : missing.error.issues.map((i) => i.path[0])).toContain("sampleQuantity");
  });
  it("has a Samples step before the files and review steps", () => {
    expect(PROJECT_STEPS.map((s) => s.title)).toEqual(["Basics", "Specifications", "Quantity & budget", "Sustainability", "Samples", "Tech pack & files", "Review & submit"]);
    expect([FILES_STEP, REVIEW_STEP]).toEqual([6, 7]);
  });
});

describe("quotation sample proposal validation", () => {
  const quote = { quantity: "500", unitPrice: "3.10", minQuantity: "300", productionDays: "40", validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) };
  it("accepts an optional sample lead time and notes", () => {
    expect(quotationSchema.parse({ ...quote, sampleLeadTimeDays: "", sampleNotes: "" })).toMatchObject({ sampleLeadTimeDays: undefined, sampleNotes: undefined });
    expect(quotationSchema.parse({ ...quote, sampleLeadTimeDays: "14", sampleNotes: "Fit sample in production fabric." })).toMatchObject({ sampleLeadTimeDays: 14 });
  });
  it("rejects a sample lead time outside 1–120 days", () => {
    for (const bad of ["0", "121", "3.5"]) expect(quotationSchema.safeParse({ ...quote, sampleLeadTimeDays: bad }).success).toBe(false);
  });
});

describe("garment categories and file kinds", () => {
  it("labels outerwear as jackets", () => {
    expect(categoryLabel("OUTERWEAR")).toBe("Jackets & outerwear");
  });
  it("accepts only images for reference images and sketches", () => {
    expect(ATTACHMENT_KINDS.filter((k) => k.imagesOnly).map((k) => k.value).sort()).toEqual(["REFERENCE_IMAGE", "SKETCH"]);
    expect(ATTACHMENT_KINDS.find((k) => k.value === "MEASUREMENT_CHART")?.imagesOnly).toBe(false);
  });
});

describe("requirement change labels", () => {
  it("uses readable field names", () => {
    expect(fieldLabel("targetUnitPrice")).toBe("Target price");
    expect(fieldLabel("sampleQuantity")).toBe("Sample pieces");
    expect(fieldLabel("someNewField")).toBe("Some new field");
  });
  it("formats stored change values", () => {
    expect(formatRevisionValue("deadline", "2027-03-01T00:00:00.000Z")).toBe("1 Mar 2027");
    expect(formatRevisionValue("targetUnitPrice", "4.5", "GBP")).toBe("£4.50");
    expect(formatRevisionValue("quantity", "1200")).toBe("1,200");
    expect(formatRevisionValue("sizes", '["S","M"]')).toBe("S, M");
    expect(formatRevisionValue("sampleRequired", "false")).toBe("No");
    expect(formatRevisionValue("category", "OUTERWEAR")).toBe("Jackets & outerwear");
    expect(formatRevisionValue("colors", null)).toBe("not set");
    expect(formatRevisionValue("description", "x".repeat(200))).toHaveLength(80);
  });
  it("summarises the sample request", () => {
    expect(sampleRequestSummary({ sampleRequired: true, sampleQuantity: 2, sampleSizes: ["M", "L"] })).toBe("2 pieces · sizes M, L");
    expect(sampleRequestSummary({ sampleRequired: true, sampleQuantity: 1, sampleSizes: ["M"] })).toBe("1 piece · size M");
    expect(sampleRequestSummary({ sampleRequired: false, sampleQuantity: null, sampleSizes: [] })).toMatch(/Not requested/);
  });
});
