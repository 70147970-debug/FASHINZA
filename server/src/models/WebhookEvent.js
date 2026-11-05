import { CREATED_ONLY, makeSchema, mixed, model, optDate, optStr, str } from "./_schema.js";

/** Every provider webhook delivery, keyed by the provider's event id for idempotency. */
const schema = makeSchema(
  {
    provider: str(),
    eventId: str(),
    type: str(),
    payload: mixed(),
    signatureValid: { type: Boolean, required: true },
    processedAt: optDate(),
    error: optStr(),
  },
  { collection: "webhook_event", timestamps: CREATED_ONLY },
);
schema.index({ provider: 1, eventId: 1 }, { unique: true });

export const WebhookEvent = model("WebhookEvent", schema);
export default WebhookEvent;
