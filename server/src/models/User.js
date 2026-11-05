import { Role, UserStatus } from "@fashinza/shared/enums.js";
import { BOTH, bool, enumOf, makeSchema, model, optDate, optStr } from "./_schema.js";

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
  },
  { collection: "user", timestamps: BOTH },
);
schema.index({ email: 1 }, { unique: true });
schema.index({ role: 1, status: 1 });

export const User = model("User", schema);
export default User;
