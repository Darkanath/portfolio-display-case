import { useEffect, useRef, useState } from "react";
import { API } from "../config";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type DisplayMessage = {
  role: "user" | "assistant";
  content: string;
  tools_used?: string[];
  isError?: boolean;
};

const STORAGE_KEY = "chat-panel-open";

const ERROR_MESSAGES: Record<number, string> = {
  429: "Too many questions for now — try again in a bit, or email me directly.",
  503: "The chat is taking a break. Try refreshing, or use the contact link.",
};
const NETWORK_ERROR = "Couldn't reach the server. Check that the service is running.";

export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const desktopToggleRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isOpen));
    } catch {}
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
    } else {
      const isMd = window.matchMedia("(min-width: 768px)").matches;
      (isMd ? desktopToggleRef : mobileToggleRef).current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userTurn: ChatTurn = { role: "user", content: text };
    setMessages((prev) => [...prev, userTurn]);
    setIsLoading(true);

    const historyForRequest = history.slice(-10);

    try {
      const resp = await fetch(`${API.agent}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: historyForRequest }),
      });

      if (!resp.ok) {
        const msg =
          ERROR_MESSAGES[resp.status] ??
          "The chat is taking a break. Try refreshing, or use the contact link.";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: msg, isError: true },
        ]);
      } else {
        const data = (await resp.json()) as {
          reply: string;
          tools_used: string[];
        };
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply, tools_used: data.tools_used },
        ]);
        setHistory((prev) =>
          [...prev, userTurn, { role: "assistant" as const, content: data.reply }].slice(-10)
        );
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: NETWORK_ERROR, isError: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
  };

  return (
    <>
      {/* Mobile: floating round button */}
      <button
        ref={mobileToggleRef}
        onClick={open}
        aria-label="Open Ask Tal chat"
        aria-expanded={isOpen}
        className="md:hidden fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-accent-400 shadow-lg hover:bg-zinc-700 transition-colors"
      >
        <ChatIcon />
      </button>

      {/* Mobile: full-screen overlay */}
      {isOpen && (
        <aside
          aria-label="Ask Tal chat"
          className="md:hidden fixed inset-0 z-50 flex flex-col bg-zinc-950"
        >
          <PanelHeader onClose={close} />
          <MessageList
            messages={messages}
            isLoading={isLoading}
            messagesEndRef={messagesEndRef}
          />
          <InputArea
            input={input}
            isLoading={isLoading}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onSend={() => void handleSend()}
            textareaRef={textareaRef}
          />
        </aside>
      )}

      {/* Desktop: collapsed strip */}
      {!isOpen && (
        <button
          ref={desktopToggleRef}
          onClick={open}
          aria-label="Open Ask Tal chat"
          aria-expanded={false}
          className="hidden md:flex fixed top-0 right-0 h-full w-12 z-40 flex-col items-center justify-center gap-4 bg-zinc-900 border-l border-zinc-800 hover:bg-zinc-800 transition-colors"
        >
          <ChatIcon className="text-accent-400" />
          <span
            className="mono text-[11px] font-medium text-zinc-400 tracking-[0.15em] uppercase select-none"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Ask Tal
          </span>
        </button>
      )}

      {/* Desktop: expanded panel */}
      {isOpen && (
        <aside
          aria-label="Ask Tal chat"
          className="hidden md:flex fixed top-0 right-0 h-full w-[360px] z-40 flex-col bg-zinc-900 border-l border-zinc-800"
        >
          <PanelHeader onClose={close} />
          <MessageList
            messages={messages}
            isLoading={isLoading}
            messagesEndRef={messagesEndRef}
          />
          <InputArea
            input={input}
            isLoading={isLoading}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onSend={() => void handleSend()}
            textareaRef={textareaRef}
          />
        </aside>
      )}
    </>
  );
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
      <h2 className="font-sans text-sm font-medium text-zinc-200">Ask Tal</h2>
      <button
        onClick={onClose}
        aria-label="Close chat"
        className="flex items-center justify-center h-8 w-8 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function MessageList({
  messages,
  isLoading,
  messagesEndRef,
}: {
  messages: DisplayMessage[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={
              msg.isError
                ? "max-w-[85%] rounded-lg px-3 py-2 text-sm text-zinc-500 italic"
                : msg.role === "user"
                ? "max-w-[85%] rounded-lg px-3 py-2 text-sm bg-zinc-700 text-zinc-100"
                : "max-w-[85%] rounded-lg px-3 py-2 text-sm bg-zinc-800/60 border border-zinc-700/50 text-zinc-200"
            }
          >
            {msg.content}
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="rounded-lg px-3 py-2 text-sm bg-zinc-800/60 border border-zinc-700/50 text-zinc-500 italic animate-pulse-soft">
            thinking…
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

function InputArea({
  input,
  isLoading,
  onInput,
  onKeyDown,
  onSend,
  textareaRef,
}: {
  input: string;
  isLoading: boolean;
  onInput: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="shrink-0 border-t border-zinc-800 px-3 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={onInput}
          onKeyDown={onKeyDown}
          placeholder="Ask anything about Tal…"
          disabled={isLoading}
          rows={1}
          className="flex-1 resize-none rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-accent-600 disabled:opacity-50 transition-colors overflow-y-auto"
          style={{ minHeight: "2.5rem", maxHeight: "8rem" }}
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-accent-400 hover:border-accent-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <SendIcon />
        </button>
      </div>
      <p className="mt-1.5 mono text-[10px] text-zinc-600">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  );
}

function ChatIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
