import { useEffect, useState } from "react";
import { API } from "./config";
import ExperienceTimeline from "./components/ExperienceTimeline";
import SkillsGrid from "./components/SkillsGrid";
import PersonaSection from "./components/PersonaSection";
import CvDownloadButton from "./components/CvDownloadButton";
import ChatPanel from "./components/ChatPanel";
import TableOfContents from "./components/TableOfContents";

type Profile = {
  name: string;
  tagline: string;
  summary: string;
  yearsOfExperience: number;
};

type ServiceHealth = {
  name: string;
  url: string;
  status: "checking" | "ok" | "down";
  latencyMs?: number;
};

const SERVICES: Omit<ServiceHealth, "status">[] = [
  { name: "experience-api", url: `${API.experience}/health` },
  { name: "persona-api", url: `${API.persona}/health` },
  { name: "agent-api", url: `${API.agent}/health` },
];

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [health, setHealth] = useState<ServiceHealth[]>(
    SERVICES.map((s) => ({ ...s, status: "checking" })),
  );
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem("theme") !== "light";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {}
  }, [isDark]);

  useEffect(() => {
    fetch(`${API.experience}/profile`)
      .then((r) => r.json())
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    const checkAll = async () => {
      const results = await Promise.all(
        SERVICES.map(async (svc): Promise<ServiceHealth> => {
          const t0 = performance.now();
          try {
            const r = await fetch(svc.url, { cache: "no-store" });
            const ms = Math.round(performance.now() - t0);
            return { ...svc, status: r.ok ? "ok" : "down", latencyMs: ms };
          } catch {
            return { ...svc, status: "down" };
          }
        }),
      );
      setHealth(results);
    };
    void checkAll();
    const id = setInterval(checkAll, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <ChatPanel />
      <TableOfContents />

      {/* Theme toggle — fixed top-left, clear of the chat panel strip on the right */}
      <button
        onClick={() => setIsDark((v) => !v)}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="fixed top-4 left-4 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors text-sm"
      >
        {isDark ? "☀" : "☾"}
      </button>

      <main className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
        <header className="animate-fade-up flex flex-col sm:flex-row gap-8 sm:gap-10 items-start">
          <img
            src="/photo.jpg"
            alt="Tal Shterzer"
            className="w-40 sm:w-56 rounded-2xl object-cover self-center sm:self-start shrink-0"
          />
          <div>
            <p className="mono text-accent-700 dark:text-accent-400">
              portfolio-display-case · v0.1.0
            </p>
            <h1 className="display mt-6 text-5xl sm:text-7xl leading-[1.05]">
              {profile?.name ?? "Tal Shterzer"}
            </h1>
            <p className="display mt-3 text-2xl sm:text-3xl text-zinc-500 dark:text-zinc-400 italic">
              {profile?.tagline ?? "Engineering Manager & Systems Architect"}
            </p>

            {profile && (
              <div className="mt-6">
                <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {profile.summary}
                </p>
                <div className="mt-6">
                  <CvDownloadButton />
                </div>
              </div>
            )}
          </div>
        </header>

        <ExperienceTimeline />
        <SkillsGrid />
        <PersonaSection />

        <section id="status" className="mt-24 animate-fade-up">
          <h2 className="mono text-xs uppercase tracking-widest text-zinc-600 dark:text-zinc-500">
            Live service status
          </h2>
          <ul className="mt-4 space-y-2">
            {health.map((svc) => (
              <li
                key={svc.name}
                className="flex items-center justify-between rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 px-4 py-3"
              >
                <span className="mono">{svc.name}</span>
                <span className="flex items-center gap-3">
                  {svc.latencyMs !== undefined && (
                    <span className="mono text-xs text-zinc-600 dark:text-zinc-500">
                      {svc.latencyMs} ms
                    </span>
                  )}
                  <Dot status={svc.status} />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 mono text-xs text-zinc-600 dark:text-zinc-500">
            Services scale to zero when idle. A slow first response is the
            cold-start — intentional, and free.
          </p>
        </section>

        <footer className="mt-24 border-t border-zinc-100 dark:border-zinc-900 pt-8 mono text-xs text-zinc-600 dark:text-zinc-500">
          Built with React, .NET 10, Python, and Claude Code · source on{" "}
          <a
            href="https://github.com/Darkanath/portfolio-display-case"
            className="text-accent-700 dark:text-accent-400 hover:text-accent-600 dark:hover:text-accent-300"
          >
            GitHub
          </a>
        </footer>
      </main>
    </div>
  );
}

function Dot({ status }: { status: ServiceHealth["status"] }) {
  const color =
    status === "ok"
      ? "bg-accent-400 shadow-[0_0_10px_rgb(45_212_191_/_0.6)]"
      : status === "down"
        ? "bg-rose-500"
        : "bg-zinc-400 dark:bg-zinc-600 animate-pulse-soft";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}
