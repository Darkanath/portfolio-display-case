import { useEffect, useState } from "react";
import { API } from "../config";

type PersonaTopic =
  | { headline: string; body: string }
  | { headline: string; items: unknown[] };

type Persona = Record<string, PersonaTopic>;

export default function PersonaSection() {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`${API.persona}/persona`)
      .then((r) => {
        if (!r.ok) throw new Error("not ok");
        return r.json() as Promise<Persona>;
      })
      .then(setPersona)
      .catch(() => setError(true));
  }, []);

  return (
    <section aria-label="Beyond the CV" className="mt-24">
      <h2 className="mono text-xs uppercase tracking-widest text-zinc-500">
        beyond the cv
      </h2>
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-3 mono text-xs text-accent-400 hover:text-accent-300 transition-colors"
      >
        {expanded ? "Hide ↑" : "Show more about me ↓"}
      </button>

      {expanded && (
        <>
          {!persona && !error && (
            <div className="mt-8 space-y-6">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-4 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-full rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
                  <div className="h-3 w-4/5 rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="mt-8 mono text-xs text-zinc-400 dark:text-zinc-600">
              persona-api unavailable
            </p>
          )}

          {persona && (
            <div className="mt-8 space-y-8">
              {Object.entries(persona).map(([key, topic]) => (
                <div key={key}>
                  <h3 className="display text-lg text-zinc-700 dark:text-zinc-200 italic">
                    {topic.headline}
                  </h3>
                  {"body" in topic && (
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {topic.body}
                    </p>
                  )}
                  {"items" in topic &&
                    Array.isArray(topic.items) &&
                    topic.items.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {(topic.items as Record<string, string>[]).map(
                          (item, i) => (
                            <li
                              key={i}
                              className="text-sm text-zinc-500 dark:text-zinc-400 leading-snug"
                            >
                              {item.title && (
                                <span className="text-zinc-700 dark:text-zinc-300">
                                  {item.title}
                                </span>
                              )}
                              {item.author && (
                                <span className="text-zinc-400 dark:text-zinc-500">
                                  {" "}
                                  — {item.author}
                                </span>
                              )}
                              {item.blurb && (
                                <span className="block text-zinc-400 dark:text-zinc-500 mt-0.5">
                                  {item.blurb}
                                </span>
                              )}
                              {item.note && (
                                <span className="block text-zinc-400 dark:text-zinc-500 mt-0.5">
                                  {item.note}
                                </span>
                              )}
                            </li>
                          ),
                        )}
                      </ul>
                    )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
