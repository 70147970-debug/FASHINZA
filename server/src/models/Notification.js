import { NotificationType } from "@fashinza/shared/enums.js";
import { CREATED_ONLY, enumOf, makeSchema, model, optDate, optStr, ref, str } from "./_schema.js";

const schema = makeSchema(
  {
    userId: ref("User"),
    type: enumOf(NotificationType),
    title: str(),
    message: str(),
    link: optStr(),
    readAt: optDate(),
  },
  { collection: "notification", timestamps: CREATED_ONLY },
);
schema.index({ userId: 1, readAt: 1, createdAt: 1 });

export const Notification = model("Notification", schema);
export default Notification;
