import { ApprovalStatus, Role, UserStatus } from "@fashinza/shared/enums.js";
import { BOTH, bool, enumOf, makeSchema, model, optDate, optRef, optStr } from "./_schema.js";

const schema = makeSchema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    emailVerified: bool(false),
    image: optStr(),
    role: enumOf(Role, "BRAND"),
    status: enumOf(UserStatus, "ACTIVE"),
    statusReason: optStr(),
    profileCompleted: bool(false),
    lastLoginAt: optDate(),
    // Brand approval (MERN addition). New BRAND accounts are created PENDING (services/accounts.js registerAccount)
    // and stay unable to create, edit or submit projects until an administrator approves them. The default keeps
    // existing users, manufacturers and administrators approved. Lean reads of older documents may lack the
    // field: treat a missing value as APPROVED (services/brand-approval.js approvalOf).
    approvalStatus: enumOf(ApprovalStatus, "APPROVED"),
    approvalNote: optStr(),
    approvalReviewedAt: optDate(),
    approvalReviewedById: optRef("User"),
  },
  { collection: "user", timestamps: BOTH },
);
schema.index({ email: 1 }, { unique: true });
schema.index({ role: 1, status: 1 });
schema.index({ role: 1, approvalStatus: 1, createdAt: -1 });

export const User = model("User", schema);
export default User;
