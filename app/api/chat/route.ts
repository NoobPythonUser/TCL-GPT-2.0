import { NextRequest } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const FALLBACK_OPENROUTER_API_KEY = "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";
const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY ?? FALLBACK_OPENROUTER_API_KEY).trim();
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODEL_CANDIDATES = [
  process.env.OPENROUTER_MODEL?.trim(),
  "meta-llama/llama-3.3-8b-instruct:free",
  "google/gemma-2-9b-it:free",
  "openai/gpt-4o-mini"
].filter((model): model is string => Boolean(model));

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

    const payload = {
      stream: true,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
    };

    let upstream: Response | null = null;
    let attemptedModel: string | null = null;
    let lastErrorText = "";

    for (const model of MODEL_CANDIDATES) {
      attemptedModel = model;
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": req.nextUrl.origin,
          "X-Title": "The Content Lab AI"
        },
        body: JSON.stringify({ ...payload, model })
      });

      if (response.ok && response.body) {
        upstream = response;
        break;
      }

      const errorText = await response.text();
      lastErrorText = errorText;

      if (response.status === 401) {
        return new Response(
          "OpenRouter authentication failed (401). Verify OPENROUTER_API_KEY in Vercel project settings or rotate the hardcoded fallback key.",
          { status: response.status }
        );
      }

      // Try next model for no-credit or unavailable-model responses.
      if (response.status === 402 || response.status === 404 || response.status === 400) {
        continue;
      }

      return new Response(`OpenRouter error (${response.status}): ${errorText}`, { status: response.status || 500 });
    }

    if (!upstream?.body) {
      return new Response(
        `OpenRouter error: no available models succeeded. Last attempted model: ${attemptedModel}. Last error: ${lastErrorText}`,
        { status: 502 }
      );
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
