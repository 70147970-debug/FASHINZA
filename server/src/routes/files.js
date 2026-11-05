/**
 * Private file download (mounted at /api/files) — owner: SERVER-A (docs/mern/api.md §3.6, §6.1).
 * Port of src/app/api/files/[...key]/route.ts: every request re-checks that the signed-in user may see the owning
 * record. Unknown and forbidden keys give the same 404 so other organisations' files are not revealed.
 *   GET /*key   user   (?download → attachment disposition)
 */
import { Router } from "express";
import { getCurrentUser } from "../auth/session.js";
import { unauthenticated } from "../lib/errors.js";
import { readStoredFile } from "../lib/storage.js";
import { routeHandlerErrors } from "../middleware/errors.js";
import { authorizeFile } from "../services/files.js";

const router = Router();

/** Headers of the original route handler. */
export function fileHeaders(meta, length, download) {
  return {
    "Content-Type": meta.mimeType,
    "Content-Length": String(length),
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  };
}

router.get("/*key", routeHandlerErrors, async (req, res) => {
  const actor = await getCurrentUser(req);
  if (!actor) throw unauthenticated();
  const segments = req.params.key;
  const key = Array.isArray(segments) ? segments.join("/") : String(segments ?? "");
  const meta = await authorizeFile(actor, key);
  const body = await readStoredFile(key);
  const download = Object.hasOwn(req.query, "download");
  res.set(fileHeaders(meta, body.length, download));
  res.end(body);
});

export default router;
