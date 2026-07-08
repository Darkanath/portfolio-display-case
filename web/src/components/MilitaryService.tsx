import { useEffect, useState } from "react";
import { API } from "../config";

type MilitaryServiceEntry = {
  type: string;
  unit: string;
  role: string;
};

export default function MilitaryService() {
  const [items, setItems] = useState<MilitaryServiceEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API.experience}/api/v1/military`)
      .then((r) => {
        if (!r.ok) throw new Error("not ok");
        return r.json() as Promise<MilitaryServiceEntry[]>;
      })
      .then(setItems)
      .catch(() => setError(true));
  }, []);

  return (
    <section id="military" aria-label="Military service" className="mt-24">
      <h2 className="mono text-xs uppercase tracking-widest text-zinc-600 dark:text-zinc-500">
        military service
      </h2>

      {!items && !error && (
        <div className="mt-8 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-4 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
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
        <ul className="mt-8 space-y-4">
          {items.map((entry, idx) => (
            <li
              key={idx}
              className="animate-fade-up rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 px-4 py-3"
              style={idx > 0 ? { animationDelay: `${idx * 80}ms` } : undefined}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="display text-xl text-zinc-900 dark:text-zinc-100">
                  {entry.unit}
                </h3>
                <span className="mono text-xs text-zinc-600 dark:text-zinc-500 shrink-0">
                  {entry.type}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                {entry.role}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
