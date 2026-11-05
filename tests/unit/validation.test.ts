import { describe, expect, it } from "vitest";
import { contactSchema } from "@/lib/validation/contact";
import { registerSchema, loginSchema } from "@/lib/validation/auth";
import { projectDraftSchema, projectSubmitSchema, PROJECT_STEPS, REVIEW_STEP, FILES_STEP } from "@/lib/validation/project";
import { quotationSchema } from "@/lib/validation/quotation";
import { categoryLabel, fieldLabel, formatRevisionValue, sampleRequestSummary } from "@/lib/labels";
import { ATTACHMENT_KINDS } from "@/lib/constants";

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
