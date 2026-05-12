import "@testing-library/jest-dom";
import { vi } from "vitest";

// jsdom doesn't implement IntersectionObserver — provide a no-op stub
const mockIntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
vi.stubGlobal("IntersectionObserver", mockIntersectionObserver);
