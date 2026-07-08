import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MilitaryService from "../components/MilitaryService";

const FIXTURE = [
  {
    type: "Full service",
    unit: "Home Front Command",
    role: "Communications & Computer Department",
  },
  {
    type: "Military Reserves",
    unit: "Armor Division",
    role: "Communications in an Armored Infantry Unit",
  },
];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MilitaryService", () => {
  it("shows skeleton loaders while fetching", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    render(<MilitaryService />);
    const pulses = document.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThan(0);
  });

  it("renders unit, type, and role after successful fetch", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(FIXTURE),
    } as Response);

    render(<MilitaryService />);

    await waitFor(() => {
      expect(screen.getByText("Home Front Command")).toBeInTheDocument();
    });
    expect(screen.getByText("Full service")).toBeInTheDocument();
    expect(
      screen.getByText("Communications & Computer Department"),
    ).toBeInTheDocument();
    expect(screen.getByText("Armor Division")).toBeInTheDocument();
    expect(screen.getByText("Military Reserves")).toBeInTheDocument();
    expect(
      screen.getByText("Communications in an Armored Infantry Unit"),
    ).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    render(<MilitaryService />);

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

    render(<MilitaryService />);

    await waitFor(() => {
      expect(
        screen.getByText("experience-api unavailable"),
      ).toBeInTheDocument();
    });
  });
});
