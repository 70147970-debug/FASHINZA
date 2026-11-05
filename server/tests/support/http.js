/**
 * HTTP test helpers (supertest). `sessionCookie(userId)` signs a user in by writing a session row directly,
 * exactly as createSession would, and returns the Cookie header value. Needs a database connection.
 */
import { Session } from "../../src/models/Session.js";
import { newToken, sha256 } from "../../src/auth/password.js";
import { SESSION_COOKIE, SESSION_DAYS } from "../../src/auth/session.js";

export async function sessionCookie(userId, { expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000) } = {}) {
  const token = newToken();
  await Session.create({ userId, token: sha256(token), expiresAt });
  return `${SESSION_COOKIE}=${token}`;
}

/**
 * Makes a supertest request look like a same-origin browser request (Host and Origin agree), e.g.
 * `sameOrigin(request(app).post("/api/x"))`. supertest only knows its port once the request is sent, so a fixed
 * host is used.
 */
export function sameOrigin(test, host = "localhost:4000") {
  return test.set("Host", host).set("Origin", `http://${host}`);
}
