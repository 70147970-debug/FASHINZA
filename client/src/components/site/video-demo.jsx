import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@fashinza/shared/utils.js";

/**
 * The User Guide's screen recording: a walkthrough of the real app on demo data, recorded by
 * `npm run mern:record-guide` (tests-mern/demo/record-user-guide.js). The recorder writes the video, its poster,
 * a WebVTT caption track and the chapter list beside the video into public/videos/; the chapter list is loaded
 * at runtime so a new recording needs no code change. Without the chapter file the video still plays.
 */
const BASE = "/videos/user-guide-demo";

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function VideoDemo() {
  const video = useRef(null);
  const [chapters, setChapters] = useState([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.chapters)) setChapters(d.chapters);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function onTimeUpdate() {
    const t = video.current?.currentTime ?? 0;
    let index = 0;
    chapters.forEach((c, i) => {
      if (t >= c.start) index = i;
    });
    setCurrent(index);
  }

  function seek(start) {
    const v = video.current;
    if (!v) return;
    v.currentTime = start;
    v.play().catch(() => {});
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
      <figure className="min-w-0 lg:col-span-8">
        <div className="overflow-hidden rounded-xl border border-line bg-inverse shadow-sm">
          <video
            ref={video}
            className="block aspect-video w-full bg-inverse"
            controls
            preload="metadata"
            playsInline
            poster={`${BASE}-poster.jpg`}
            onTimeUpdate={onTimeUpdate}
            aria-describedby="video-demo-note"
          >
            <source src={`${BASE}.webm`} type="video/webm" />
            <track kind="captions" src={`${BASE}.vtt`} srcLang="en" label="English" default />
            Your browser cannot play this video. The steps below describe the same process.
          </video>
        </div>
        <figcaption id="video-demo-note" className="mt-3 text-[13px] leading-5 text-ink-muted">
          Recorded from the Fashinza app using demo accounts and example data. Payments use the sandbox provider, so no real money moves.
        </figcaption>
      </figure>

      {chapters.length > 0 && (
        <nav aria-label="Video chapters" className="min-w-0 lg:col-span-4">
          <p className="label-caps border-b border-line-strong pb-3 text-ink-muted">Chapters</p>
          <ol>
            {chapters.map((c, i) => (
              <li key={c.start} className="border-b border-line">
                <button
                  type="button"
                  onClick={() => seek(c.start)}
                  aria-current={i === current ? "true" : undefined}
                  className={cn(
                    "group flex min-h-12 w-full items-center gap-3 py-2.5 text-left transition-colors duration-150",
                    i === current ? "text-accent-strong" : "text-ink hover:text-accent-strong",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-xs font-medium tabular",
                      i === current ? "bg-accent text-accent-fg" : "bg-surface-muted text-ink-muted group-hover:bg-accent-soft group-hover:text-accent-strong",
                    )}
                    aria-hidden
                  >
                    {i === current ? <Play className="size-3" fill="currentColor" /> : i + 1}
                  </span>
                  <span className="flex-1 text-[0.9375rem] font-medium leading-5">{c.title}</span>
                  <span className="text-[13px] text-ink-muted tabular">{clock(c.start)}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  );
}
