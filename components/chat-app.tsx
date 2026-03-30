"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const starterMessage =
  "Welcome to The Content Lab AI. Ask for campaign concepts, messaging angles, social ideas, and more.";

export function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: starterMessage }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || isLoading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: prompt }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages })
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to stream response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: fullText };
          return updated;
        });

        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }
    } catch (error) {
      const fallback = error instanceof Error ? error.message : "Unexpected error";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `I couldn't complete that request. ${fallback}`
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function copyMessage(content: string) {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Clipboard can fail in restricted browsers.
    }
  }

  function clearChat() {
    setMessages([{ role: "assistant", content: starterMessage }]);
    setInput("");
  }

  return (
    <main className="mx-auto flex h-screen max-w-5xl flex-col p-4 sm:p-8">
      <header className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-tcl-panel/70 p-4 shadow-neon backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-tcl-electric/80 bg-black text-sm font-bold text-tcl-neon">
            TCL
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-tcl-electric">Logo Placeholder</p>
            <h1 className="text-lg font-semibold">The Content Lab AI</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={clearChat}
          className="rounded-md border border-white/20 px-3 py-2 text-sm text-white transition hover:border-tcl-neon hover:text-tcl-neon"
        >
          Clear Chat
        </button>
      </header>

      <section
        ref={listRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-4 shadow-electric"
      >
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={`rounded-2xl border px-4 py-3 ${
              message.role === "user"
                ? "ml-auto max-w-[85%] border-tcl-electric/50 bg-tcl-electric/10"
                : "mr-auto max-w-[90%] border-tcl-neon/50 bg-tcl-neon/10"
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{message.role}</p>
              {message.role === "assistant" && message.content && (
                <button
                  type="button"
                  onClick={() => copyMessage(message.content)}
                  className="text-xs text-tcl-electric transition hover:text-tcl-neon"
                >
                  Copy
                </button>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/95">{message.content || "Thinking..."}</p>
          </article>
        ))}
      </section>

      <form onSubmit={sendMessage} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask for a campaign concept, channel strategy, messaging framework..."
          className="min-h-24 rounded-xl border border-white/20 bg-tcl-panel p-3 text-sm text-white outline-none ring-0 placeholder:text-white/40 focus:border-tcl-electric"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-xl bg-gradient-to-r from-tcl-electric to-tcl-neon px-5 py-3 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Generating..." : "Send"}
        </button>
      </form>
    </main>
  );
}
