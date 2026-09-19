// POST /api/tags — free-text style brief → predefined tags (zod-validated).
// "clean minimal bathroom marble" → ["minimal","white","marble"].
// Gemini does language taste ONLY; without a key (or on any failure) the
// deterministic keyword mapper answers — the route never 500s on AI trouble.
import { z } from "zod";
import { ALL_TAGS, keywordTags, type Tag } from "@/lib/tags";

export const runtime = "nodejs";

const RequestSchema = z.object({
  text: z.string().min(1).max(2000),
});

const GeminiReplySchema = z.object({
  tags: z.array(z.enum(ALL_TAGS)).min(1).max(6),
});

async function geminiTags(text: string): Promise<{ tags: Tag[]; via: string } | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const prompt = `Map this bathroom style description to tags. Reply with ONLY compact JSON, no markdown, no explanation.
Allowed tags (${ALL_TAGS.length}): ${ALL_TAGS.join(", ")}.
Schema: {"tags":["<1-6 allowed tags, best match first>"]}
Rules: pick style tags (e.g. minimal, luxury), colour/finish tags (white, black, chrome...) and material tags (marble, wood...) that the description implies. "clean"/"bright" implies white. Only tags from the allowed list.
Description: ${text.slice(0, 1000)}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 128 },
        }),
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const candidates = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates;
    const parts = candidates?.[0]?.content?.parts;
    const raw = (parts ?? []).map((p) => p.text ?? "").join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const checked = GeminiReplySchema.safeParse(JSON.parse(match[0]) as unknown);
    if (!checked.success) return null;
    return { tags: [...new Set(checked.data.tags)], via: `gemini:${model}` };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const checked = RequestSchema.safeParse(raw);
  if (!checked.success) {
    return Response.json(
      {
        error: "Invalid request.",
        issues: checked.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
      },
      { status: 400 }
    );
  }
  const ai = await geminiTags(checked.data.text);
  if (ai) return Response.json({ tags: ai.tags, via: ai.via });
  return Response.json({ tags: keywordTags(checked.data.text), via: "keyword-fallback" });
}
