import { BOTH, date, makeSchema, model, optStr, ref, str } from "./_schema.js";

/** Login sessions. `token` is the SHA-256 (hex) of the cookie value; the raw token is never stored. */
const schema = makeSchema(
  {
    expiresAt: date(),
    token: str(),
    ipAddress: optStr(),
    userAgent: optStr(),
    userId: ref("User"),
  },
  { collection: "session", timestamps: BOTH },
);
schema.index({ token: 1 }, { unique: true });
schema.index({ userId: 1 });
// Expired sessions are already rejected on read; the TTL index only cleans them up.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = model("Session", schema);
export default Session;
