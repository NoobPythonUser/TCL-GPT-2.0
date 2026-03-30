import { NextRequest } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const FALLBACK_OPENROUTER_API_KEY = "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";
const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY ?? FALLBACK_OPENROUTER_API_KEY).trim();
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const FIXED_MODEL = "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `You are The Content Lab AI.
You help employees in branding, advertising, and social media.

Your outputs must:

* Be sharp, insight-led, and creative
* Avoid generic responses
* Use structured formats when needed (Concept, Insight, Execution, CTA)
* Think like a strategist + creative director

Do not:

* Break brand tone
* Give irrelevant general answers

Ask clarifying questions if needed.`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { messages?: ChatMessage[] };
    const messages = body.messages ?? [];

    if (!messages.length) {
      return new Response("No messages provided", { status: 400 });
    }

    if (!OPENROUTER_API_KEY) {
      return new Response("Server misconfiguration: missing OpenRouter API key", { status: 500 });
    }

    const upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": req.nextUrl.origin,
        "X-Title": "The Content Lab AI"
      },
      body: JSON.stringify({
        model: FIXED_MODEL,
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
      })
    });

    if (!upstream.ok || !upstream.body) {
      const errorText = await upstream.text();
      const status = upstream.status || 500;

      if (status === 401) {
        return new Response(
          "OpenRouter authentication failed (401). Verify OPENROUTER_API_KEY in Vercel project settings or rotate the hardcoded fallback key.",
          { status }
        );
      }

      return new Response(`OpenRouter error: ${errorText}`, { status });
    }

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const raw of lines) {
              const line = raw.trim();
              if (!line.startsWith("data:")) continue;

              const data = line.slice(5).trim();
              if (data === "[DONE]") {
                controller.close();
                return;
              }

              try {
                const parsed = JSON.parse(data) as {
                  choices?: Array<{
                    delta?: {
                      content?: string;
                    };
                  }>;
                };
                const token = parsed.choices?.[0]?.delta?.content ?? "";
                if (token) {
                  controller.enqueue(encoder.encode(token));
                }
              } catch {
                // Ignore malformed chunks.
              }
            }
          }
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(`Server error: ${message}`, { status: 500 });
  }
}
