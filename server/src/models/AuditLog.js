import { CREATED_ONLY, makeSchema, model, optMixed, optStr, ref, str } from "./_schema.js";

/** Records sensitive administrative actions. Append-only. */
const schema = makeSchema(
  {
    actorId: ref("User"),
    action: str(),
    targetType: str(),
    targetId: str(),
    reason: optStr(),
    metadata: optMixed(),
  },
  { collection: "audit_log", timestamps: CREATED_ONLY },
);
schema.index({ targetType: 1, targetId: 1 });
schema.index({ createdAt: 1 });

export const AuditLog = model("AuditLog", schema);
export default AuditLog;
