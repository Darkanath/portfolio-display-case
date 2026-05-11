import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PersonaSection from "../components/PersonaSection";

const FIXTURE = {
  storytelling: {
    headline: "I tell stories at tables, not just in standups.",
    body: "When I'm not running engineering teams, I'm usually running tabletop adventures.",
  },
  reading: {
    headline: "What I've been reading lately.",
    items: [
      { title: "Dune", author: "Frank Herbert", note: "Classic for a reason." },
    ],
  },
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PersonaSection", () => {
  it("shows skeleton loaders while fetching", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    render(<PersonaSection />);
    const pulses = document.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThan(0);
  });

  it("renders topic headlines after fetch", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(FIXTURE),
    } as Response);

    render(<PersonaSection />);

    await waitFor(() => {
      expect(
        screen.getByText("I tell stories at tables, not just in standups.")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("What I've been reading lately.")).toBeInTheDocument();
  });

  it("renders body text for text-body topics", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(FIXTURE),
    } as Response);

    render(<PersonaSection />);

    await waitFor(() => {
      expect(
        screen.getByText(/When I'm not running engineering teams/)
      ).toBeInTheDocument();
    });
  });

  it("renders item titles for list topics", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(FIXTURE),
    } as Response);

    render(<PersonaSection />);

    await waitFor(() => {
      expect(screen.getByText("Dune")).toBeInTheDocument();
    });
    expect(screen.getByText("— Frank Herbert")).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    render(<PersonaSection />);

    await waitFor(() => {
      expect(screen.getByText("persona-api unavailable")).toBeInTheDocument();
    });
  });

  it("shows error on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve(null),
    } as Response);

    render(<PersonaSection />);

    await waitFor(() => {
      expect(screen.getByText("persona-api unavailable")).toBeInTheDocument();
    });
  });
});
