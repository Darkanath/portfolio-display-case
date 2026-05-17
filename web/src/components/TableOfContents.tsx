import { useEffect, useState } from "react";
import { useActiveSection } from "../hooks/useActiveSection";

const SECTIONS = [
  { id: "experience", label: "experience" },
  { id: "skills", label: "skills" },
  { id: "persona", label: "beyond the cv" },
  { id: "status", label: "status" },
];

const SECTION_IDS = SECTIONS.map((s) => s.id);

export default function TableOfContents() {
  const activeId = useActiveSection(SECTION_IDS);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 80);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const activeLabel =
    SECTIONS.find((s) => s.id === activeId)?.label ?? SECTIONS[0].label;

  return (
    <>
      {/* Desktop: fixed sidebar outside the content column, xl screens only */}
      <nav
        aria-label="Page sections"
        className="hidden xl:flex fixed top-32 z-20 right-[calc(50%+25rem)] w-40 flex-col gap-1"
      >
        {SECTIONS.map((section) => {
          const isActive = activeId === section.id;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={(e) => {
                e.preventDefault();
                jumpTo(section.id);
              }}
              className={[
                "mono text-xs uppercase tracking-widest transition-colors duration-200",
                "border-l-2 pl-2 py-0.5",
                isActive
                  ? "text-accent-700 dark:text-accent-400 border-accent-500"
                  : "text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-700 dark:hover:text-zinc-300",
              ].join(" ")}
            >
              {section.label}
            </a>
          );
        })}
      </nav>

      {/* Mobile: sticky top bar, slides in after 80px scroll */}
      <nav
        aria-label="Page sections"
        className={[
          "fixed top-0 left-0 right-0 z-30 md:hidden",
          "bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm",
          "border-b border-zinc-200 dark:border-zinc-800",
          "transition-transform duration-200",
          scrolled ? "translate-y-0" : "-translate-y-full",
        ].join(" ")}
      >
        <div className="flex items-center px-4 py-2">
          <div className="flex-1" />
          <span className="mono text-xs uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
            {activeLabel}
          </span>
          <div className="flex-1 flex justify-end">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle section menu"
              aria-expanded={menuOpen}
              className="flex h-7 w-7 items-center justify-center rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ListIcon />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-zinc-200 dark:border-zinc-800">
            {SECTIONS.map((section) => {
              const isActive = activeId === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => jumpTo(section.id)}
                  className={[
                    "block w-full text-left px-4 py-3",
                    "mono text-xs uppercase tracking-widest transition-colors",
                    isActive
                      ? "text-accent-700 dark:text-accent-400"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200",
                  ].join(" ")}
                >
                  {section.label}
                </button>
              );
            })}
          </div>
        )}
      </nav>
    </>
  );
}

function ListIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
