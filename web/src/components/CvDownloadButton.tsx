import { API } from "../config";

export default function CvDownloadButton() {
  return (
    <a
      href={`${API.experience}/api/v1/cv-pdf`}
      download="Tal_Shterzer_CV.pdf"
      className="inline-flex items-center gap-2 mono text-sm px-4 py-2 rounded border border-accent-600 text-accent-700 dark:text-accent-400 hover:bg-accent-500/10 hover:border-accent-500 hover:text-accent-600 dark:hover:text-accent-300 transition-colors"
    >
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
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      download cv
    </a>
  );
}
