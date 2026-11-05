import { CREATED_ONLY, makeSchema, model, optMixed, optRef, str } from "./_schema.js";

/** Append-only history of project and order events. Never updated or deleted by the app. */
const schema = makeSchema(
  {
    projectId: optRef("Project"),
    orderId: optRef("Order"),
    actorId: optRef("User"),
    type: str(),
    message: str(),
    metadata: optMixed(),
  },
  { collection: "activity_log", timestamps: CREATED_ONLY },
);
schema.index({ projectId: 1, createdAt: 1 });
schema.index({ orderId: 1, createdAt: 1 });

export const ActivityLog = model("ActivityLog", schema);
export default ActivityLog;
