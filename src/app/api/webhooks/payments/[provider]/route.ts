import { NextResponse } from "next/server";
import { processPaymentWebhook } from "@/server/services/payments";
import { isAppError } from "@/server/errors";

/**
 * Payment provider webhook. The raw body is verified against the provider signature before
 * anything is parsed or stored. Duplicates are acknowledged with 200 so the provider stops retrying.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const raw = await req.text();
  if (raw.length > 64 * 1024) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  try {
    const result = await processPaymentWebhook(provider, raw, req.headers.get("x-fashinza-signature"));
    return NextResponse.json(result);
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[webhook] processing failed", e);
    // 500 tells the provider to retry later; the event is stored with its error for review.
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
