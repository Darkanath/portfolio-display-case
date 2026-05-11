import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SkillsGrid from "../components/SkillsGrid";

const FIXTURE = {
  languages: ["C#", "TypeScript", "Python"],
  cloud: ["Azure", "Azure Container Apps"],
  data: ["SQL Server", "Snowflake"],
  ai: ["Claude Code", "GitHub Copilot"],
  leadership: ["hiring", "roadmapping"],
  practices: ["microservices", "CI/CD"],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SkillsGrid", () => {
  it("shows skeleton loaders while fetching", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    render(<SkillsGrid />);
    const pulses = document.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThan(0);
  });

  it("renders all skill categories after fetch", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(FIXTURE),
    } as Response);

    render(<SkillsGrid />);

    await waitFor(() => {
      expect(screen.getByText("languages")).toBeInTheDocument();
    });
    expect(screen.getByText("cloud")).toBeInTheDocument();
    expect(screen.getByText("data")).toBeInTheDocument();
    expect(screen.getByText("ai & tooling")).toBeInTheDocument();
    expect(screen.getByText("leadership")).toBeInTheDocument();
    expect(screen.getByText("practices")).toBeInTheDocument();
  });

  it("renders skill items", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(FIXTURE),
    } as Response);

    render(<SkillsGrid />);

    await waitFor(() => {
      expect(screen.getByText("C#")).toBeInTheDocument();
    });
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText("Snowflake")).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    render(<SkillsGrid />);

    await waitFor(() => {
      expect(screen.getByText("experience-api unavailable")).toBeInTheDocument();
    });
  });

  it("shows error on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve(null),
    } as Response);

    render(<SkillsGrid />);

    await waitFor(() => {
      expect(screen.getByText("experience-api unavailable")).toBeInTheDocument();
    });
  });
});
