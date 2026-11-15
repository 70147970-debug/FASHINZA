import { useContext, useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  AtSign,
  Briefcase,
  Camera,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CirclePlay,
  CircleX,
  ExternalLink,
  Globe,
  Loader2,
  Music2,
  Palette,
  Pin,
  Plus,
  Store,
  Trash2,
  Users,
} from "lucide-react";
import { FormErrorsContext } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ApiError, apiPost } from "@/lib/api";
import { formatDate } from "@fashinza/shared/format.js";
import { LINK_CHECK_STATUS, LINK_NOT_FOUND_MESSAGE, SOCIAL_LIMITS, SOCIAL_PLATFORMS, detectPlatform, platformOf, validate } from "@fashinza/shared/social.js";
import { cn } from "@fashinza/shared/utils.js";

/*
 * Social media links on brand and factory profiles (decision 5). SocialLinksEditor sits inside a profile
 * ActionForm and posts each row as the parallel keys `socialPlatform` / `socialUrl`; SocialLinksList shows saved
 * links read-only (admin review, other parties).
 */

/** Generic line icons (no brand logos): the platform name is always written next to them. */
const PLATFORM_ICON = {
  INSTAGRAM: Camera,
  FACEBOOK: Users,
  LINKEDIN: Briefcase,
  TIKTOK: Music2,
  X: AtSign,
  PINTEREST: Pin,
  YOUTUBE: CirclePlay,
  BEHANCE: Palette,
  ETSY: Store,
  OTHER: Globe,
};

const STATUS_ICON = { FOUND: CircleCheck, NOT_FOUND: CircleX, UNCONFIRMED: CircleHelp, SKIPPED: CircleDashed };
const STATUS_COLOR = { FOUND: "text-success-strong", NOT_FOUND: "text-danger-strong", UNCONFIRMED: "text-warning-strong", SKIPPED: "text-ink-muted" };

export function PlatformIcon({ platform, className }) {
  const Icon = PLATFORM_ICON[platform] ?? Globe;
  return <Icon className={cn("size-4 shrink-0", className)} aria-hidden />;
}

/**
 * Text for a check result. Saved checks use the fixed labels; a live check (from the Check link button) adds
 * its more specific reason where it says more than the label.
 */
function statusText(check) {
  const label = LINK_CHECK_STATUS[check.status]?.label ?? LINK_CHECK_STATUS.SKIPPED.label;
  const message = check.message?.replace(/\.$/, "");
  if (!message) return { label };
  if (check.status === "UNCONFIRMED") return { label: message };
  if (check.status === "NOT_FOUND") {
    return { label, detail: check.message === LINK_NOT_FOUND_MESSAGE ? "check the link and try again" : `${message.charAt(0).toLowerCase()}${message.slice(1)}` };
  }
  return { label };
}

/** Icon + text for a link check result (`check` = { status, message?, checkedAt? }). */
export function LinkCheckStatus({ check, showDate = false, id, className }) {
  if (!check?.status) return null;
  const Icon = STATUS_ICON[check.status] ?? CircleDashed;
  const { label, detail } = statusText(check);
  return (
    <p id={id} className={cn("flex items-start gap-1.5 text-xs leading-4", STATUS_COLOR[check.status] ?? "text-ink-muted", className)}>
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="font-medium">{label}</span>
        {detail && <span> — {detail}</span>}
        {showDate && check.checkedAt && check.status !== "SKIPPED" && <span className="text-ink-muted"> · checked {formatDate(check.checkedAt)}</span>}
      </span>
    </p>
  );
}

/** "https://www.instagram.com/yourbrand/" → "instagram.com/yourbrand". */
function displayUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")}${u.search}`;
  } catch {
    return url;
  }
}

const isWebUrl = (url) => /^https?:\/\//i.test(String(url ?? ""));

/**
 * Read-only list of saved social links: platform icon and name, the link (new tab, no referrer, nofollow) and the
 * stored check result.
 */
export function SocialLinksList({ links, empty = "No social links added.", showStatus = true, className }) {
  const list = Array.isArray(links) ? links : [];
  if (list.length === 0) return <p className={cn("text-sm text-ink-muted", className)}>{empty}</p>;
  return (
    <ul className={cn("space-y-3", className)}>
      {list.map((l) => {
        const label = platformOf(l.platform)?.label ?? "Other";
        return (
          <li key={`${l.platform} ${l.url}`} className="flex items-start gap-2.5 text-[13px]">
            <PlatformIcon platform={l.platform} className="mt-0.5 text-ink-subtle" />
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-5 text-ink">{label}</p>
              {isWebUrl(l.url) ? (
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex max-w-full items-start gap-1 rounded-xs break-all text-accent-strong underline-offset-4 hover:underline"
                >
                  <span className="min-w-0">{displayUrl(l.url)}</span>
                  <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
                  <span className="sr-only"> ({label}, opens in a new tab)</span>
                </a>
              ) : (
                <span className="break-all text-ink">{l.url}</span>
              )}
              {showStatus && <LinkCheckStatus check={l.check} showDate className="mt-1" />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

let nextKey = 0;
const newKey = () => `row-${nextKey++}`;

/** Editor rows from saved links. `saved` remembers what was stored, so the stored check only shows while unchanged. */
function rowsFrom(links) {
  return (Array.isArray(links) ? links : []).map((l) => ({
    key: newKey(),
    platform: l.platform ?? "",
    url: l.url ?? "",
    saved: { platform: l.platform, url: l.url, check: l.check ?? null },
    live: null,
    error: null,
    checking: false,
  }));
}

const signature = (links) => JSON.stringify((Array.isArray(links) ? links : []).map((l) => [l.platform, l.url, l.check?.status ?? null]));

/**
 * Social media rows for a profile form: [platform] [link] [Check link] [Remove] per row and "Add social link".
 * Links are checked in the browser as you type (format and platform), live on "Check link", and again by the
 * server when the form is saved.
 */
export function SocialLinksEditor({ defaultValue = [] }) {
  const id = useId();
  const errors = useContext(FormErrorsContext);
  const [rows, setRows] = useState(() => rowsFrom(defaultValue));
  // Re-sync after a save: the page data is loaded again with normalised links and their check results.
  const [source, setSource] = useState(() => signature(defaultValue));
  const incoming = signature(defaultValue);
  if (incoming !== source) {
    setSource(incoming);
    setRows(rowsFrom(defaultValue));
  }
  // Server errors are keyed by row position; once rows change after a submit they no longer line up, so they are
  // hidden until the next submit.
  const [errorsSeen, setErrorsSeen] = useState(errors);
  const [staleRows, setStaleRows] = useState(() => new Set());
  if (errorsSeen !== errors) {
    setErrorsSeen(errors);
    setStaleRows(new Set());
  }
  const markStale = (keys) => setStaleRows((s) => new Set([...s, ...keys]));

  const addButton = useRef(null);
  const focusKey = useRef(null);
  useEffect(() => {
    if (!focusKey.current) return;
    document.getElementById(`${id}-platform-${focusKey.current}`)?.focus();
    focusKey.current = null;
  });

  const full = rows.length >= SOCIAL_LIMITS.links;
  const update = (key, patch) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = () => {
    if (full) return;
    const key = newKey();
    focusKey.current = key;
    setRows((list) => [...list, { key, platform: "", url: "", saved: null, live: null, error: null, checking: false }]);
  };
  const remove = (key) => {
    markStale(rows.map((r) => r.key));
    setRows((list) => list.filter((r) => r.key !== key));
    addButton.current?.focus();
  };

  const changePlatform = (r, platform) => {
    markStale([r.key]);
    update(r.key, { platform, live: null, error: r.url.trim() && platform ? validate(platform, r.url) : null });
  };
  const changeUrl = (r, url) => {
    markStale([r.key]);
    update(r.key, { url, live: null, error: null });
  };
  const blurUrl = (r) => {
    const url = r.url.trim();
    if (!url) return;
    if (!r.platform) {
      const detected = detectPlatform(url);
      if (detected) update(r.key, { platform: detected, error: validate(detected, url) });
      return;
    }
    update(r.key, { error: validate(r.platform, url) });
  };

  const check = async (r) => {
    const url = r.url.trim();
    const platform = r.platform || detectPlatform(url) || "";
    if (!platform) return update(r.key, { error: "Choose the platform for this link.", live: null });
    const error = validate(platform, url);
    if (error) return update(r.key, { platform, error, live: null });
    markStale([r.key]);
    update(r.key, { platform, error: null, live: null, checking: true });
    try {
      const res = await apiPost("/api/profile/check-link", { platform, url });
      setRows((list) =>
        list.map((x) =>
          x.key === r.key && x.url === r.url ? { ...x, url: res.url ?? x.url, checking: false, live: { status: res.status, message: res.message, checkedAt: res.checkedAt } } : x.key === r.key ? { ...x, checking: false } : x,
        ),
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? (err.fieldErrors?.url ?? err.fieldErrors?.platform ?? err.message) : "We couldn't check the link. Please try again.";
      update(r.key, { checking: false, error: message });
    }
  };

  return (
    <fieldset aria-describedby={`${id}-hint`} className="min-w-0">
      <legend className="text-[13px] font-medium leading-5 text-ink">
        Social media <span className="font-normal text-ink-muted">(optional)</span>
      </legend>
      <p id={`${id}-hint`} className="mt-0.5 text-xs leading-4 text-ink-muted">
        No website? Add your social media pages instead.
      </p>

      {rows.length > 0 && (
        <ul className="mt-3 space-y-3">
          {rows.map((r, i) => {
            const n = i + 1;
            const p = platformOf(r.platform);
            const stale = staleRows.has(r.key);
            const serverPlatformError = stale ? undefined : errors[`socialLinks.${i}.platform`];
            const serverUrlError = stale ? undefined : errors[`socialLinks.${i}.url`];
            const platformError = !r.error ? serverPlatformError : undefined;
            const urlError = r.error ?? serverUrlError;
            const unchanged = r.saved && r.saved.platform === r.platform && r.saved.url === r.url;
            const shown = r.live ?? (unchanged ? r.saved.check : null);
            const name = p ? `${p.label} link` : `link ${n}`;
            const ids = { platform: `${id}-platform-${r.key}`, url: `${id}-url-${r.key}`, pErr: `${id}-perr-${r.key}`, uErr: `${id}-uerr-${r.key}`, status: `${id}-status-${r.key}` };
            const urlDescribedBy = [urlError && ids.uErr, shown && !r.checking && ids.status].filter(Boolean).join(" ") || undefined;
            return (
              <li key={r.key} className="rounded-md border border-line-subtle bg-surface-muted/40 p-2.5 sm:border-0 sm:bg-transparent sm:p-0">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[11rem_minmax(0,1fr)_auto_auto]">
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <label htmlFor={ids.platform} className="sr-only">
                      Platform for social link {n}
                    </label>
                    <Select
                      id={ids.platform}
                      name="socialPlatform"
                      value={r.platform}
                      onChange={(e) => changePlatform(r, e.target.value)}
                      aria-invalid={platformError ? true : undefined}
                      aria-describedby={platformError ? ids.pErr : undefined}
                    >
                      <option value="">Choose platform</option>
                      {SOCIAL_PLATFORMS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <label htmlFor={ids.url} className="sr-only">
                      Link for social link {n}
                      {p ? ` (${p.label})` : ""}
                    </label>
                    <Input
                      id={ids.url}
                      name="socialUrl"
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      spellCheck={false}
                      value={r.url}
                      maxLength={SOCIAL_LIMITS.urlLength + 20}
                      placeholder={p?.example ?? "https://instagram.com/yourbrand"}
                      onChange={(e) => changeUrl(r, e.target.value)}
                      onBlur={() => blurUrl(r)}
                      aria-invalid={urlError ? true : undefined}
                      aria-describedby={urlDescribedBy}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-self-start sm:h-9"
                    onClick={() => check(r)}
                    disabled={!r.url.trim() || r.checking}
                    aria-busy={r.checking || undefined}
                  >
                    {r.checking ? <Loader2 className="animate-spin" aria-hidden /> : <CircleCheck aria-hidden />}
                    Check link<span className="sr-only"> ({p ? p.label : `social link ${n}`})</span>
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="justify-self-end sm:size-9" onClick={() => remove(r.key)} aria-label={`Remove ${name}`}>
                    <Trash2 className="text-ink-muted" />
                  </Button>
                </div>
                <div className="space-y-1 sm:pl-[11.5rem] [&:not(:empty)]:mt-1.5" aria-live="polite">
                  {platformError && (
                    <p id={ids.pErr} className="flex items-start gap-1 text-xs font-medium leading-4 text-danger-strong">
                      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                      {platformError}
                    </p>
                  )}
                  {urlError && (
                    <p id={ids.uErr} className="flex items-start gap-1 text-xs font-medium leading-4 text-danger-strong">
                      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                      {urlError}
                    </p>
                  )}
                  {r.checking && (
                    <p className="flex items-center gap-1.5 text-xs leading-4 text-ink-muted">
                      <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                      Checking the link…
                    </p>
                  )}
                  {!r.checking && !urlError && shown && <LinkCheckStatus id={ids.status} check={shown} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button ref={addButton} type="button" variant="outline" size="sm" onClick={add} disabled={full}>
          <Plus /> Add social link
        </Button>
        <p className={cn("text-xs text-ink-muted", full && "text-warning-strong")}>
          {full ? `You can add up to ${SOCIAL_LIMITS.links} social links.` : "One link per platform. Choose Other for any other site."}
        </p>
      </div>
      {errors.socialLinks && (
        <p data-field-error="" className="mt-1.5 text-xs font-medium leading-4 text-danger-strong">
          {errors.socialLinks}
        </p>
      )}
      <p className="mt-2 text-xs leading-4 text-ink-muted">
        We open each link to check the page exists. Instagram, Facebook, TikTok and Pinterest hide pages from automatic checks, so their links usually show
        “Couldn't confirm”. That doesn't mean the link is wrong.
      </p>
    </fieldset>
  );
}
