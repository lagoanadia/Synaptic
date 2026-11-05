import "server-only";
import { groq } from "@/lib/groq";
import type { ChatCompletionCreateParamsNonStreaming } from "groq-sdk/resources/chat/completions";
import { parseJsonLoosely } from "@/lib/json";

// The Groq models the app uses, in one place. If one gets dropped from
// Groq's free tier (it's happened), this is the only line to change.
// The vision model's image cap lives in visionLimits.ts.
export const TEXT_MODEL = "openai/gpt-oss-120b";
export const VISION_MODEL = "qwen/qwen3.8-27b";

// Groq's JSON mode occasionally rejects its own output
// ("json_validate_failed") — a one-off sampling hiccup that a second
// identical attempt usually doesn't repeat. One retry, then give up.
export async function createJsonCompletion(params: ChatCompletionCreateParamsNonStreaming) {
  try {
    return await groq.chat.completions.create(params);
  } catch {
    return await groq.chat.completions.create(params);
  }
}

// One-shot "send this prompt, get parsed JSON back". Returns null on any
// failure (network, empty answer, unparseable JSON) so callers decide
// their own fallback instead of wrapping every call in try/catch.
export async function askJson(
  prompt: string,
  opts: { maxTokens?: number; system?: string } = {},
): Promise<unknown | null> {
  try {
    const completion = await createJsonCompletion({
      model: TEXT_MODEL,
      messages: [
        ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
        { role: "user" as const, content: prompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: opts.maxTokens ?? 8000,
    });
    const text = completion.choices[0]?.message?.content;
    return text ? parseJsonLoosely(text) : null;
  } catch (err) {
    console.error("askJson failed", err);
    return null;
  }
}

// Small typed readers for AI JSON, which never matches the requested
// shape 100% of the time.
export const str = (v: unknown, max = 4000): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
