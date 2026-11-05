import { BOTH, date, makeSchema, model, str } from "./_schema.js";

/** One-time tokens (password reset). `value` holds a SHA-256 hash of the token. */
const schema = makeSchema(
  {
    identifier: str(),
    value: str(),
    expiresAt: date(),
  },
  { collection: "verification", timestamps: BOTH },
);
schema.index({ identifier: 1 });
schema.index({ value: 1 });

export const Verification = model("Verification", schema);
export default Verification;
