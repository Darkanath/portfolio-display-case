import { useEffect, useState } from "react";
import { API } from "../config";

type Experience = {
  id: string;
  title: string;
  company: string;
  start: string;
  end: string | null;
  current: boolean;
  highlights: string[];
  stack: string[];
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDate(raw: string | null, current: boolean): string {
  if (current || raw === null) return "present";
  // YYYY-MM
  if (raw.length === 7) {
    const month = parseInt(raw.slice(5, 7), 10);
    const year = raw.slice(0, 4);
    return `${MONTHS[month - 1]} ${year}`;
  }
  // YYYY
  return raw;
}

export default function ExperienceTimeline() {
  const [items, setItems] = useState<Experience[] | null>(null);
  const [error, setError] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API.experience}/experience`)
      .then((r) => {
        if (!r.ok) throw new Error("not ok");
        return r.json() as Promise<Experience[]>;
      })
      .then(setItems)
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (!items) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveJobId(e.target.id.replace("job-", ""));
        });
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: 0 },
    );

    items.forEach((job) => {
      const el = document.getElementById(`job-${job.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  return (
    <section id="experience" aria-label="Experience" className="mt-24">
      <h2 className="mono text-xs uppercase tracking-widest text-zinc-600 dark:text-zinc-500">
        experience
      </h2>

      {!items && !error && (
        <div className="mt-8 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-4 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-1/3 rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-8 mono text-xs text-zinc-600 dark:text-zinc-400">
          experience-api unavailable
        </p>
      )}

      {items && (
        <ol className="mt-8 relative border-l border-zinc-200 dark:border-zinc-800">
          {items.map((job, idx) => {
            const isCurrent = job.current;
            const isActive = activeJobId === job.id;
            const dateRange = `${formatDate(job.start, false)} – ${formatDate(job.end, isCurrent)}`;

            return (
              <li id={`job-${job.id}`} key={job.id} className="mb-10 ml-6 last:mb-0">
                {/* Timeline node */}
                <span
                  className={[
                    "absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors duration-300",
                    isCurrent
                      ? "border-accent-500 bg-accent-500/20"
                      : isActive
                        ? "border-accent-500 bg-accent-500/20"
                        : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {isCurrent && (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulse-soft" />
                  )}
                </span>

                <div
                  className={[
                    idx === 0 ? "animate-fade-up" : "",
                    "border-l-2 pl-3 transition-colors duration-300",
                    isActive ? "border-accent-500" : "border-transparent",
                  ].join(" ")}
                  style={
                    idx > 0 ? { animationDelay: `${idx * 80}ms` } : undefined
                  }
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="display text-xl text-zinc-900 dark:text-zinc-100">
                      {job.title}
                    </h3>
                    <span className="mono text-xs text-zinc-600 dark:text-zinc-500 shrink-0">
                      {dateRange}
                    </span>
                  </div>
                  <p className="mono text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                    {job.company}
                  </p>

                  <ul className="mt-3 space-y-1.5">
                    {job.highlights.map((h, hi) => (
                      <li
                        key={hi}
                        className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300 leading-snug"
                      >
                        <span className="text-zinc-500 dark:text-zinc-600 shrink-0 mt-px">
                          ·
                        </span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>

                  {job.stack.length > 0 && (
                    <ul
                      className="mt-3 flex flex-wrap gap-1.5"
                      aria-label="Tech stack"
                    >
                      {job.stack.map((tech) => (
                        <li
                          key={tech}
                          className="mono text-xs px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400"
                        >
                          {tech}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
