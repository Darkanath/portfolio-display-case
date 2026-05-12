import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ExperienceTimeline from "../components/ExperienceTimeline";

const FIXTURE = [
  {
    id: "acme",
    title: "Engineering Manager",
    company: "Acme Corp",
    start: "2023-03",
    end: null,
    current: true,
    highlights: ["Led a team of 8 engineers", "Shipped three major features"],
    stack: ["TypeScript", "React"],
  },
  {
    id: "beta",
    title: "Senior Developer",
    company: "Beta Ltd",
    start: "2020-01",
    end: "2023-02",
    current: false,
    highlights: ["Built the billing service"],
    stack: ["C#", ".NET"],
  },
];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ExperienceTimeline", () => {
  it("shows skeleton loaders while fetching", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    render(<ExperienceTimeline />);
    const pulses = document.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThan(0);
  });

  it("renders job titles and companies after successful fetch", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(FIXTURE),
    } as Response);

    render(<ExperienceTimeline />);

    await waitFor(() => {
      expect(screen.getByText("Engineering Manager")).toBeInTheDocument();
    });
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    expect(screen.getByText("Beta Ltd")).toBeInTheDocument();
  });

  it("renders correct date range for current role", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(FIXTURE),
    } as Response);

    render(<ExperienceTimeline />);

    await waitFor(() => {
      expect(screen.getByText("Mar 2023 – present")).toBeInTheDocument();
    });
  });

  it("renders correct date range for past role", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(FIXTURE),
    } as Response);

    render(<ExperienceTimeline />);

    await waitFor(() => {
      expect(screen.getByText("Jan 2020 – Feb 2023")).toBeInTheDocument();
    });
  });

  it("renders highlights as list items", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(FIXTURE),
    } as Response);

    render(<ExperienceTimeline />);

    await waitFor(() => {
      expect(screen.getByText("Led a team of 8 engineers")).toBeInTheDocument();
      expect(
        screen.getByText("Shipped three major features"),
      ).toBeInTheDocument();
    });
  });

  it("renders stack tags", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(FIXTURE),
    } as Response);

    render(<ExperienceTimeline />);

    await waitFor(() => {
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.getByText("React")).toBeInTheDocument();
    });
  });

  it("shows error message when fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    render(<ExperienceTimeline />);

    await waitFor(() => {
      expect(
        screen.getByText("experience-api unavailable"),
      ).toBeInTheDocument();
    });
  });

  it("shows error message on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve(null),
    } as Response);

    render(<ExperienceTimeline />);

    await waitFor(() => {
      expect(
        screen.getByText("experience-api unavailable"),
      ).toBeInTheDocument();
    });
  });
});
