import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatPanel from "../components/ChatPanel";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  // jsdom doesn't implement matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Opens the panel by clicking the first available toggle button.
async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getAllByRole("button", { name: "Open Ask Tal chat" })[0],
  );
}

describe("ChatPanel — closed state", () => {
  it("renders at least one toggle button", () => {
    render(<ChatPanel />);
    const toggles = screen.getAllByRole("button", {
      name: "Open Ask Tal chat",
    });
    expect(toggles.length).toBeGreaterThan(0);
  });

  it("toggle button reports aria-expanded false", () => {
    render(<ChatPanel />);
    const [toggle] = screen.getAllByRole("button", {
      name: "Open Ask Tal chat",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

describe("ChatPanel — empty state", () => {
  it("shows all three suggestion chips after opening", async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);
    await openPanel(user);

    expect(
      screen.getAllByText("What kind of teams has Tal led?").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Tell me about Tal's experience with Azure.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("What does Tal do outside of work?").length,
    ).toBeGreaterThan(0);
  });

  it("clicking a suggestion pre-fills input without sending", async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);
    await openPanel(user);

    await user.click(screen.getAllByText("What kind of teams has Tal led?")[0]);

    const textarea = screen.getAllByPlaceholderText(
      "Ask anything about Tal…",
    )[0];
    expect(textarea).toHaveValue("What kind of teams has Tal led?");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("ChatPanel — sending messages", () => {
  it("shows thinking while loading then renders reply with tools_used", async () => {
    const user = userEvent.setup();

    // Deferred json() keeps the loading state alive until we resolve it.
    let resolveJson!: (v: { reply: string; tools_used: string[] }) => void;
    const jsonPromise = new Promise<{ reply: string; tools_used: string[] }>(
      (res) => {
        resolveJson = res;
      },
    );
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => jsonPromise,
    } as unknown as Response);

    render(<ChatPanel />);
    await openPanel(user);

    const textarea = screen.getAllByPlaceholderText(
      "Ask anything about Tal…",
    )[0];
    await user.type(textarea, "What teams?");
    await user.keyboard("{Enter}");

    // json() is still pending — loading skeleton should be visible
    await waitFor(() =>
      expect(
        screen.getAllByRole("status", { name: "Thinking" }).length,
      ).toBeGreaterThan(0),
    );

    // Unblock the response
    resolveJson({
      reply: "Tal has led cross-functional teams.",
      tools_used: ["get_work_experience"],
    });

    await waitFor(() =>
      expect(
        screen.getAllByText("Tal has led cross-functional teams.").length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.getAllByText(/via get_work_experience/).length,
    ).toBeGreaterThan(0);
  });

  it("does not show tools_used line when tools_used is empty", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ reply: "No tools needed.", tools_used: [] }),
    } as Response);

    render(<ChatPanel />);
    await openPanel(user);

    await user.type(
      screen.getAllByPlaceholderText("Ask anything about Tal…")[0],
      "hi",
    );
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(screen.getAllByText("No tools needed.").length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/^via /)).not.toBeInTheDocument();
  });

  it("hides suggestion chips once a message is in the list", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply: "Some reply.", tools_used: [] }),
    } as Response);

    render(<ChatPanel />);
    await openPanel(user);

    // Chips are present before sending
    expect(
      screen.getAllByText("What does Tal do outside of work?").length,
    ).toBeGreaterThan(0);

    // Click a chip to pre-fill, then send
    await user.click(screen.getAllByText("What kind of teams has Tal led?")[0]);
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(screen.getAllByText("Some reply.").length).toBeGreaterThan(0),
    );

    // The other chip texts should no longer appear
    expect(
      screen.queryAllByText("Tell me about Tal's experience with Azure."),
    ).toHaveLength(0);
  });

  it("Shift+Enter inserts a newline instead of sending", async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);
    await openPanel(user);

    const textarea = screen.getAllByPlaceholderText(
      "Ask anything about Tal…",
    )[0];
    await user.type(textarea, "line one");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(fetch).not.toHaveBeenCalled();
    expect((textarea as HTMLTextAreaElement).value).toContain("line one");
  });
});

describe("ChatPanel — error handling", () => {
  it("shows 429 error message inline", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 429 } as Response);

    render(<ChatPanel />);
    await openPanel(user);
    await user.type(
      screen.getAllByPlaceholderText("Ask anything about Tal…")[0],
      "hi",
    );
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(
        screen.getAllByText(
          "Too many questions for now — try again in a bit, or email me directly.",
        ).length,
      ).toBeGreaterThan(0),
    );
  });

  it("shows 503 error message inline", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);

    render(<ChatPanel />);
    await openPanel(user);
    await user.type(
      screen.getAllByPlaceholderText("Ask anything about Tal…")[0],
      "hi",
    );
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(
        screen.getAllByText(
          "The chat is taking a break. Try refreshing, or use the contact link.",
        ).length,
      ).toBeGreaterThan(0),
    );
  });

  it("shows network error message inline when fetch throws", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    render(<ChatPanel />);
    await openPanel(user);
    await user.type(
      screen.getAllByPlaceholderText("Ask anything about Tal…")[0],
      "hi",
    );
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(
        screen.getAllByText(
          "Couldn't reach the server. Check that the service is running.",
        ).length,
      ).toBeGreaterThan(0),
    );
  });

  it("shows a retry button after an error, and retry resends the same message", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ reply: "Second time's the charm.", tools_used: [] }),
      } as Response);

    render(<ChatPanel />);
    await openPanel(user);
    await user.type(
      screen.getAllByPlaceholderText("Ask anything about Tal…")[0],
      "hi",
    );
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(screen.getAllByText("Retry").length).toBeGreaterThan(0),
    );

    await user.click(screen.getAllByText("Retry")[0]);

    await waitFor(() =>
      expect(
        screen.getAllByText("Second time's the charm.").length,
      ).toBeGreaterThan(0),
    );
    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string)).toMatchObject(
      { message: "hi" },
    );
  });

  it("does not show a retry button before any error has occurred", async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);
    await openPanel(user);

    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
  });
});

describe("ChatPanel — keyboard and accessibility", () => {
  it("Escape closes the panel", async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);
    await openPanel(user);

    expect(
      screen.getAllByRole("button", { name: "Close chat" }).length,
    ).toBeGreaterThan(0);

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(
        screen.queryAllByRole("button", { name: "Close chat" }),
      ).toHaveLength(0),
    );
  });

  it("close button collapses the panel", async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);
    await openPanel(user);

    const closeButtons = screen.getAllByRole("button", { name: "Close chat" });
    await user.click(closeButtons[0]);

    await waitFor(() =>
      expect(
        screen.queryAllByRole("button", { name: "Close chat" }),
      ).toHaveLength(0),
    );
  });
});
