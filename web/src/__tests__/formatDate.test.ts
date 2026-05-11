import { describe, it, expect } from "vitest";
import { formatDate } from "../components/ExperienceTimeline";

describe("formatDate", () => {
  it("returns 'present' for current role with null end", () => {
    expect(formatDate(null, true)).toBe("present");
  });

  it("returns 'present' when current=true even if end date provided", () => {
    expect(formatDate("2025-01", true)).toBe("present");
  });

  it("formats YYYY-MM correctly", () => {
    expect(formatDate("2025-01", false)).toBe("Jan 2025");
    expect(formatDate("2024-12", false)).toBe("Dec 2024");
    expect(formatDate("2011-06", false)).toBe("Jun 2011");
  });

  it("returns year as-is for YYYY input", () => {
    expect(formatDate("2011", false)).toBe("2011");
    expect(formatDate("2007", false)).toBe("2007");
  });

  it("returns 'present' for null end and current=false (graceful fallback)", () => {
    expect(formatDate(null, false)).toBe("present");
  });
});
