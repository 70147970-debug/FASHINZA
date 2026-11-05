import { BOTH, makeSchema, model, optDate, optStr, ref, str } from "./_schema.js";

/** Credentials. Password logins use providerId "credential" and an scrypt hash in `password`. */
const schema = makeSchema(
  {
    accountId: str(),
    providerId: str(),
    userId: ref("User"),
    accessToken: optStr(),
    refreshToken: optStr(),
    idToken: optStr(),
    accessTokenExpiresAt: optDate(),
    refreshTokenExpiresAt: optDate(),
    scope: optStr(),
    password: optStr(),
  },
  { collection: "account", timestamps: BOTH },
);
schema.index({ userId: 1 });
schema.index({ userId: 1, providerId: 1 });

export const Account = model("Account", schema);
export default Account;
