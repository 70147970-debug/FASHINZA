import { BOTH, date, int, makeSchema, model, str } from "./_schema.js";

/**
 * One-time secrets for password recovery (services/accounts.js). `identifier` names the purpose and the user:
 *   password-reset-code:<userId>   the emailed 6-digit code; `value` is a salted scrypt hash of it and `attempts`
 *                                  counts the guesses made (the code stops working after 5 wrong ones);
 *   password-reset-token:<userId>  the short-lived token issued once the code was verified; `value` is its SHA-256.
 * Older rows (`password-reset:<userId>`, reset links) are no longer accepted and expire on their own.
 */
const schema = makeSchema(
  {
    identifier: str(),
    value: str(),
    expiresAt: date(),
    attempts: int(0),
  },
  { collection: "verification", timestamps: BOTH },
);
schema.index({ identifier: 1 });
schema.index({ value: 1 });
// Expired rows are rejected on read; this only cleans them up a day later (the delay keeps "This code has
// expired" answerable for a while instead of turning into "incorrect code").
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const Verification = model("Verification", schema);
export default Verification;
