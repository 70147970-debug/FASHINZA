import { getCurrentUser } from "@/server/auth/session";
import { authorizeFile } from "@/server/services/files";
import { readStoredFile } from "@/server/storage";
import { errorResponse, unauthenticated } from "@/server/http";

/** Private file download. Every request re-checks that the signed-in user may see the owning record. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const actor = await getCurrentUser();
  if (!actor) return unauthenticated();
  try {
    const key = (await params).key.join("/");
    const meta = await authorizeFile(actor, key);
    const body = await readStoredFile(key);
    const download = new URL(req.url).searchParams.has("download");
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": meta.mimeType,
        "Content-Length": String(body.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
