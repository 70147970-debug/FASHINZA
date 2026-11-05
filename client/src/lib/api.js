/**
 * JSON API client for the Express server (docs/mern/api.md).
 *
 * - Every request is same-origin under /api (Vite proxies it in dev) and sends the session cookie.
 * - Errors follow the contract shape `{ error: { code, message, fieldErrors? } }` and are thrown as ApiError.
 * - Mutations used by forms go through `submitForm`, which never throws: it returns today's FormState
 *   (`{ status, message, fieldErrors, redirectTo }`) so ActionForm can treat it like a server action result.
 * - Page loaders use `loadJson`, which turns the gate errors into the same redirects the Next pages made
 *   (sign in, `?denied=1`, onboarding) and a 404 into the route's not-found card.
 * - Uploads that need progress (file-uploader) use `uploadWithProgress` (XMLHttpRequest).
 */
import { data, redirect } from "react-router";

/** Message of today's `runAction` when a mutation fails unexpectedly (also used for network failures). */
export const MUTATION_FAILED = "Something went wrong on our side. Your changes were not saved — please try again.";
/** Message of today's `errorResponse` for GET endpoints, uploads and downloads. */
export const REQUEST_FAILED = "Something went wrong. Please try again.";

export class ApiError extends Error {
  /**
   * @param {{ status: number, code: string, message: string, fieldErrors?: Record<string, string> }} init
   */
  constructor({ status, code, message, fieldErrors }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/** `{ a: "1", b: undefined }` → `?a=1` (empty and nullish values are left out); "" when nothing is set. */
export function buildQuery(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((item) => q.append(k, String(item)));
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Path (with search) of the page the user is on, for `?next=`. */
export function currentPath(location = window.location) {
  return `${location.pathname}${location.search}`;
}

/** Path + search of a loader's Request. */
export function requestPath(request) {
  const u = new URL(request.url);
  return `${u.pathname}${u.search}`;
}

/** `/login?next=<encoded path+search>` — what today's proxy (src/proxy.ts) redirected signed-out visitors to. */
export function loginPath(path = currentPath()) {
  return `/login?next=${encodeURIComponent(path)}`;
}

/**
 * Where the client goes for a gate error, as the Next pages did: UNAUTHENTICATED → login with a return path,
 * ROLE_DENIED → `/dashboard?denied=1`, PROFILE_INCOMPLETE → `/onboarding`. Null for every other error.
 * @param {unknown} error
 * @param {string} [path] current path + search (defaults to the browser location)
 */
export function gateRedirect(error, path) {
  if (!(error instanceof ApiError)) return null;
  if (error.code === "UNAUTHENTICATED") return loginPath(path);
  if (error.code === "ROLE_DENIED") return "/dashboard?denied=1";
  if (error.code === "PROFILE_INCOMPLETE") return "/onboarding";
  return null;
}

async function parseBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Low-level request. `body` may be FormData (sent as multipart, like `new FormData(form)`), URLSearchParams,
 * or a plain object (sent as JSON). Resolves with the parsed JSON (or null); throws ApiError otherwise.
 * @param {string} path e.g. "/api/projects"
 * @param {{ method?: string, body?: FormData | URLSearchParams | Record<string, unknown>, query?: Record<string, unknown>, signal?: AbortSignal, headers?: Record<string, string> }} [options]
 */
export async function api(path, { method = "GET", body, query, signal, headers = {} } = {}) {
  const init = { method, credentials: "include", signal, headers: { Accept: "application/json", ...headers } };
  if (body !== undefined && body !== null) {
    if (body instanceof FormData || body instanceof URLSearchParams) init.body = body;
    else {
      init.body = JSON.stringify(body);
      init.headers["Content-Type"] = "application/json";
    }
  }
  let res;
  try {
    res = await fetch(`${path}${query ? buildQuery(query) : ""}`, init);
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError({ status: 0, code: "NETWORK", message: method === "GET" ? REQUEST_FAILED : MUTATION_FAILED });
  }
  const json = await parseBody(res);
  if (!res.ok) {
    const e = json?.error;
    throw new ApiError({
      status: res.status,
      code: e?.code ?? (res.status === 404 ? "NOT_FOUND" : "INTERNAL"),
      message: e?.message ?? (method === "GET" ? REQUEST_FAILED : MUTATION_FAILED),
      fieldErrors: e?.fieldErrors,
    });
  }
  return json;
}

export const apiGet = (path, query, options = {}) => api(path, { ...options, method: "GET", query });
export const apiPost = (path, body, options = {}) => api(path, { ...options, method: "POST", body });
export const apiPut = (path, body, options = {}) => api(path, { ...options, method: "PUT", body });
export const apiDelete = (path, body, options = {}) => api(path, { ...options, method: "DELETE", body });

/**
 * Converts an API mutation into today's FormState. Never throws (except on abort).
 * Success → `{ status: "success", ...response }` (message, redirectTo and any extra keys);
 * failure → `{ status: "error", message, fieldErrors, code, goTo }` where `goTo` is set for gate errors
 * (ActionForm navigates there, as the server actions' redirect() did).
 * @param {string} path
 * @param {FormData | Record<string, unknown>} body
 * @param {{ method?: string, path?: string }} [options] `path`: current page path + search, for `?next=`
 * @returns {Promise<import("@fashinza/shared/form-state.js").FormState & Record<string, unknown>>}
 */
export async function submitForm(path, body, { method = "POST", path: here } = {}) {
  try {
    const res = await api(path, { method, body });
    const result = { ...(res ?? {}), status: "success" };
    delete result.ok;
    return result;
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    if (err instanceof ApiError) {
      return { status: "error", code: err.code, message: err.message, fieldErrors: err.fieldErrors, goTo: gateRedirect(err, here) ?? undefined };
    }
    return { status: "error", message: MUTATION_FAILED };
  }
}

/**
 * For route loaders: GET JSON with the request's abort signal. Gate errors become the redirects the Next pages
 * made; NOT_FOUND becomes a 404 route error (rendered as the not-found card); other errors are re-thrown for the
 * route's error boundary.
 * @param {string} path
 * @param {{ request?: Request, query?: Record<string, unknown> }} [options]
 */
export async function loadJson(path, { request, query } = {}) {
  try {
    return await api(path, { query, signal: request?.signal });
  } catch (err) {
    const to = gateRedirect(err, request ? requestPath(request) : undefined);
    if (to) throw redirect(to);
    if (err instanceof ApiError && err.code === "NOT_FOUND") throw data({ message: err.message }, { status: 404 });
    throw err;
  }
}

/**
 * Multipart upload through XMLHttpRequest so the page can show real progress (as the file uploader does
 * today). Never rejects: resolves `{ ok, status, data, error }`, where `error` is the contract error object
 * (`{ code, message, fieldErrors? }`) for an HTTP error, or `{ code: "NETWORK" }` when the request failed.
 * @param {string} path
 * @param {FormData} body
 * @param {{ method?: string, onProgress?: (percent: number, event: ProgressEvent) => void, signal?: AbortSignal }} [options]
 *   `onProgress` receives the uploaded percentage (0–100) whenever the length is computable.
 * @returns {Promise<{ ok: boolean, status: number, data: any, error: { code: string, message?: string, fieldErrors?: Record<string, string> } | null }>}
 */
export function uploadWithProgress(path, body, { method = "POST", onProgress, signal } = {}) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, path);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100), e);
      };
    }
    xhr.onload = () => {
      let json = null;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        json = null;
      }
      const ok = xhr.status >= 200 && xhr.status < 300;
      resolve({ ok, status: xhr.status, data: ok ? json : null, error: ok ? null : (json?.error ?? { code: "INTERNAL" }) });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, data: null, error: { code: "NETWORK" } });
    xhr.onabort = () => resolve({ ok: false, status: 0, data: null, error: { code: "ABORTED" } });
    if (signal) {
      if (signal.aborted) return xhr.abort();
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(body);
  });
}
