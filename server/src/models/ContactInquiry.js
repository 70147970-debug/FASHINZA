import { InquiryStatus } from "@fashinza/shared/enums.js";
import { CREATED_ONLY, enumOf, makeSchema, model, optStr, str } from "./_schema.js";

const schema = makeSchema(
  {
    name: str(),
    email: str(),
    company: optStr(),
    inquiryType: str(),
    subject: str(),
    message: str(),
    status: enumOf(InquiryStatus, "NEW"),
  },
  { collection: "contact_inquiry", timestamps: CREATED_ONLY },
);
schema.index({ status: 1, createdAt: 1 });

export const ContactInquiry = model("ContactInquiry", schema);
export default ContactInquiry;
