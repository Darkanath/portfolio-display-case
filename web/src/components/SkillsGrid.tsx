import { useEffect, useState } from "react";
import { API } from "../config";

type Skills = Record<string, string[]>;

const CATEGORY_LABELS: Record<string, string> = {
  languages: "languages",
  cloud: "cloud",
  data: "data",
  ai: "ai & tooling",
  leadership: "leadership",
  practices: "practices",
};

export default function SkillsGrid() {
  const [skills, setSkills] = useState<Skills | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API.experience}/skills`)
      .then((r) => {
        if (!r.ok) throw new Error("not ok");
        return r.json() as Promise<Skills>;
      })
      .then(setSkills)
      .catch(() => setError(true));
  }, []);

  return (
    <section aria-label="Skills" className="mt-24">
      <h2 className="mono text-xs uppercase tracking-widest text-zinc-500">
        skills
      </h2>

      {!skills && !error && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-3 w-1/3 rounded bg-zinc-800" />
              <div className="h-3 w-2/3 rounded bg-zinc-800/60" />
              <div className="h-3 w-1/2 rounded bg-zinc-800/60" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-8 mono text-xs text-zinc-600">
          experience-api unavailable
        </p>
      )}

      {skills && (
        <dl className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-8">
          {Object.entries(skills).map(([category, items]) => (
            <div key={category}>
              <dt className="mono text-xs uppercase tracking-widest text-zinc-500 mb-3">
                {CATEGORY_LABELS[category] ?? category}
              </dt>
              <dd>
                <ul className="space-y-1.5">
                  {items.map((skill) => (
                    <li key={skill} className="text-sm text-zinc-300 leading-snug">
                      {skill}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
