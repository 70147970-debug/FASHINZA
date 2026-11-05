/**
 * Server entry: `node server/src/index.js` (port 4000 by default, PORT env).
 * Starts listening immediately and connects to MongoDB in the background, retrying until it is reachable;
 * GET /api/health reports 503 until then, and API calls that need the database answer 503
 * DATABASE_UNAVAILABLE, while the client app and the public pages are still served.
 */
import { config, redactUri } from "./config.js";
import { connectDb, disconnectDb, ensureCollections } from "./db.js";
import { createApp } from "./app.js";

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port} (${config.env})`);
});

let stopping = false;

async function connectWithRetry(attempt = 1) {
  try {
    await connectDb();
    console.log(`[db] connected to ${redactUri(config.mongodbUri)}`);
    // Collections and indexes (unique rules included) must exist before transactions write to them.
    await ensureCollections().catch((e) => console.error(`[db] creating collections/indexes failed: ${e instanceof Error ? e.message : e}`));
  } catch (e) {
    if (stopping) return;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
    console.error(`[db] connection failed (${e instanceof Error ? e.message : e}); retrying in ${Math.round(delay / 1000)} s`);
    setTimeout(() => connectWithRetry(attempt + 1), delay).unref();
  }
}
connectWithRetry();

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[server] ${signal} received, shutting down`);
  server.close();
  await disconnectDb().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
