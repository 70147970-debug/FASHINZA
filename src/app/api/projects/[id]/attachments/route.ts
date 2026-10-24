import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/session";
import { addAttachment } from "@/server/services/projects";
import { errorResponse, unauthenticated } from "@/server/http";
import { invalid } from "@/server/errors";
import { UPLOAD_LIMITS } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Multipart upload endpoint for project files. A route handler (rather than a server action)
 * is used so the browser can report upload progress through XMLHttpRequest.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return unauthenticated();
  if (!rateLimit(`upload:${actor.id}`, 60, 10 * 60 * 1000).ok) return NextResponse.json({ error: "Too many uploads. Please wait a few minutes." }, { status: 429 });
  try {
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > UPLOAD_LIMITS.maxBytes + 64 * 1024) throw invalid(`Files must be ${UPLOAD_LIMITS.maxBytes / 1024 / 1024} MB or smaller.`);
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "OTHER");
    if (!(file instanceof File)) throw invalid("Choose a file to upload.");
    if (!["TECH_PACK", "SKETCH", "OTHER"].includes(kind)) throw invalid("Unknown file type.");
    const notes = String(form.get("notes") ?? "").trim().slice(0, 300) || undefined;
    const att = await addAttachment(actor, id, file, kind as "TECH_PACK" | "SKETCH" | "OTHER", notes);
    revalidatePath(`/projects/${id}`);
    return NextResponse.json({ id: att.id, version: att.version, fileName: att.fileName }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
