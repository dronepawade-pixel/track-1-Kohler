// POST /api/recommend — AI bundle + auto-layout for the 3D Design track.
// AI (Gemini) does taste/language ONLY: free-text style → fixed style tags.
// Money, geometry, SKU validity stay in deterministic TS. Strict budget:
// known-price sum never exceeds budget_inr; null-price (Unknown) items are
// allowed but flagged and excluded from the sum. Never invents SKUs.
import { z } from "zod";
import { autoLayout, type RoomDims } from "@/lib/autoLayout";
import {
  CATALOG_PRODUCTS,
  STYLE_TAXONOMY,
  type CatalogEntry,
  type FixtureKind,
} from "@/lib/products";
import { MODEL_OPTIONS } from "@/lib/models";

export const runtime = "nodejs";

// --- zod boundary schemas ------------------------------------------------
// Request + Gemini reply + Supabase rows are all external input: parsed with
// zod at the boundary. Deterministic guarantees (SKU∈catalog, sum≤budget,
// fit, no overlap) stay in code below — schemas can't express those.
const RequestSchema = z.object({
  room: z.object({
    l_m: z.number().min(1.2).max(12),
    w_m: z.number().min(1.2).max(12),
    h_m: z.number().min(1.2).max(12),
  }),
  budget_inr: z.number().nonnegative(),
  style: z.string().max(500).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
  // strict (default): any style/fit/budget miss 422s the whole bundle.
  // best-effort: place what fits, report the rest as warnings (planner
  // auto-place — user can drag/undo from there).
  mode: z.enum(["strict", "best-effort"]).default("strict"),
  // Best-effort only: kinds that can't fit the remaining budget are placed
  // anyway and flagged over budget, instead of being skipped.
  include_over_budget: z.boolean().default(false),
});

const GeminiReplySchema = z.object({
  tags: z.array(z.enum(STYLE_TAXONOMY)).min(1).max(3),
});

const DbRowSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string(),
  subtype: z.string().nullable().optional(),
  collection: z.string().nullable().optional(),
  finish: z.string().nullable().optional(),
  price_inr: z.number().nonnegative().nullable().optional(),
  width_mm: z.number().positive(),
  depth_mm: z.number().positive(),
  height_mm: z.number().positive().nullable().optional(),
  style_tags: z.array(z.string()).optional().default([]),
  official_url: z.string().nullable().optional(),
  image_urls: z.array(z.string()).optional().default([]),
  model_glb_url: z.string().nullable().optional(),
});

const KIND_BY_CATEGORY: Record<string, FixtureKind | null> = {
  Showers: "Shower",
  Bathtubs: "Bathtub",
  Basins: "Basin",
  "Smart Toilets": "Toilet",
  Faucets: null, // accessory — never auto-placed
  Mirrors: null,
  Vanities: null,
};

// --- Gemini tag normalizer -----------------------------------------------

const KEYWORDS: [RegExp, string][] = [
  [/minimal|simple|clean|less is more/i, "minimal"],
  [/modern|contemporary|composed/i, "modern"],
  [/zen|spa|calm|japandi|wabi/i, "zen"],
  [/classic|timeless|traditional/i, "classic"],
  [/luxury|luxurious|premium|luxe|hotel/i, "luxury"],
  [/heritage|vintage|colonial|clawfoot/i, "heritage"],
  [/bold|statement|dramatic|dark/i, "bold"],
];

function keywordTags(text: string): string[] {
  const tags = new Set<string>();
  for (const [re, tag] of KEYWORDS) if (re.test(text)) tags.add(tag);
  return tags.size > 0 ? [...tags] : ["modern", "minimal"];
}

// Fixture mentions with counts: "2 toilets", "double basins", "twin sinks"
// all yield {Toilet:2}/{Basin:2}. A number within ~24 chars before the kind
// word counts; unqualified mentions mean 1. Cap 4 per kind.
const KIND_PATTERNS: [FixtureKind, RegExp][] = [
  ["Bathtub", /\b(tubs?|bathtubs?|baths?|soak(?:ing)?\s*tubs?)\b/i],
  ["Shower", /\b(showers?|rain(?:heads?|showers?)|steam)\b/i],
  ["Toilet", /\b(toilets?|wcs?|water\s+closets?|bidets?|veils?|eirs?)\b/i],
  ["Basin", /\b(basins?|sinks?|vanities|vanity|washes|wash)\b/i],
];
const COUNT_VALUE: Record<string, number> = {
  "2": 2, two: 2, double: 2, twin: 2,
  "3": 3, three: 3, triple: 3,
  "4": 4, four: 4,
};
// Number counts only when it DIRECTLY precedes the kind word (≤2 filler
// words between, e.g. "two extra toilets") — so "2 toilets and a basin"
// doesn't leak the 2 into the basin. Scanned from the END of the prefix,
// word by word: the token nearest the kind wins.
function nearCount(before: string): number | undefined {
  const toks = before.trim().split(/[\s,]+/).filter(Boolean);
  for (let back = 1; back <= Math.min(3, toks.length); back++) {
    const v = COUNT_VALUE[toks[toks.length - back].toLowerCase()];
    if (v !== undefined) return v;
  }
  return undefined;
}

export function wantedCounts(text: string): Record<FixtureKind, number> {
  const out: Record<FixtureKind, number> = { Bathtub: 0, Shower: 0, Toilet: 0, Basin: 0 };
  for (const [kind, re] of KIND_PATTERNS) {
    const gre = new RegExp(re.source, "gi");
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = gre.exec(text)) !== null) {
      // Synonyms ("vanity sinks") must not double-count: each mention is 1
      // unless a number directly precedes it; the largest wins.
      let mention = 1;
      const before = text.slice(Math.max(0, m.index - 30), m.index);
      const v = nearCount(before);
      if (v && v > 1) mention = v;
      n = Math.max(n, mention);
    }
    out[kind] = Math.min(n, 4);
  }
  return out;
}

async function geminiTags(text: string): Promise<{ tags: string[]; via: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { tags: keywordTags(text), via: "keyword-fallback (no GEMINI_API_KEY)" };
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const prompt = `Map this bathroom style description to tags. Reply with ONLY compact JSON, no markdown, no explanation.
Allowed tags: ${STYLE_TAXONOMY.join(", ")}.
Schema: {"tags":["<1-3 allowed tags, best match first>"]}
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
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        }),
      }
    );
    clearTimeout(timer);
    if (!res.ok) return { tags: keywordTags(text), via: `keyword-fallback (gemini HTTP ${res.status})` };
    const data = await res.json();
    const raw: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { tags: keywordTags(text), via: "keyword-fallback (unparseable gemini reply)" };
    let candidate: unknown;
    try {
      candidate = JSON.parse(match[0]) as unknown;
    } catch {
      return { tags: keywordTags(text), via: "keyword-fallback (unparseable gemini reply)" };
    }
    const checked = GeminiReplySchema.safeParse(candidate);
    if (!checked.success) {
      return { tags: keywordTags(text), via: "keyword-fallback (gemini tags outside taxonomy)" };
    }
    const tags = [...new Set(checked.data.tags)];
    return { tags, via: `gemini:${model}` };
  } catch {
    return { tags: keywordTags(text), via: "keyword-fallback (gemini error)" };
  }
}

// --- Catalog source: Supabase when reachable, else local join -------------

function entryFromDbRow(r: Record<string, unknown>): CatalogEntry | null {
  const checked = DbRowSchema.safeParse(r);
  if (!checked.success) return null;
  const row = checked.data;
  const kind = KIND_BY_CATEGORY[row.category];
  const w = row.width_mm;
  const d = row.depth_mm;
  const h = row.height_mm ?? null;
  const glb = row.model_glb_url;
  const base = glb?.split("/").pop() ?? "";
  const modelId = MODEL_OPTIONS.find((m) => m.glb.split("/").pop() === base)?.id ?? "procedural";
  return {
    sku: row.sku,
    name: row.name,
    category: row.category as CatalogEntry["category"],
    subtype: row.subtype ?? null,
    collection: row.collection ?? "Unknown",
    finish: row.finish ?? "Unknown",
    price: row.price_inr ?? null,
    dimensions:
      h !== null
        ? `${(w / 10).toFixed(1)} × ${(d / 10).toFixed(1)} × ${(h / 10).toFixed(1)} cm`
        : `${(w / 10).toFixed(1)} × ${(d / 10).toFixed(1)} cm`,
    url: row.official_url ?? null,
    kind: kind ?? "Basin",
    modelId,
    w_m: w / 1000,
    d_m: kind === null ? 0 : d / 1000,
    bundleable: kind !== null,
    width_mm: w,
    depth_mm: d,
    height_mm: h,
    style_tags: row.style_tags,
    model_glb_url: glb ?? null,
    image_urls: row.image_urls,
  };
}

async function loadCatalog(): Promise<{ entries: CatalogEntry[]; source: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(
        `${url.replace(/\/$/, "")}/rest/v1/products?select=*`,
        {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          signal: ctrl.signal,
        }
      );
      clearTimeout(timer);
      if (res.ok) {
        const rows = (await res.json()) as Record<string, unknown>[];
        const entries = rows
          .map(entryFromDbRow)
          .filter((e): e is CatalogEntry => e !== null);
        if (entries.length > 0) return { entries, source: `supabase (${entries.length} rows)` };
      }
    } catch {
      // fall through to local catalog
    }
  }
  return { entries: CATALOG_PRODUCTS, source: `local (${CATALOG_PRODUCTS.length} entries)` };
}

// --- Route ---------------------------------------------------------------

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = (await req.json()) as unknown;
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
  const body = checked.data;
  const l = body.room.l_m;
  const w = body.room.w_m;
  const h = body.room.h_m;
  const budget = body.budget_inr;

  const room: RoomDims = { w: l, h: w, height: Math.min(5, Math.max(2, h || 2.7)), doors: 1, windows: 1 };
  const text = `${body.style ?? ""}\n${body.notes ?? ""}`.trim();
  const { entries, source } = await loadCatalog();
  const { tags, via } = await geminiTags(text || String(body.style ?? ""));
  const warnings: string[] = [];
  const bestEffort = body.mode === "best-effort";
  const includeOver = body.include_over_budget;

  // Strict style match: tag overlap required. Best-effort relaxes to any
  // style with a warning instead of failing the whole request.
  let styled = entries.filter(
    (e) => e.bundleable && (e.style_tags ?? []).some((t) => tags.includes(t))
  );
  if (styled.length === 0) {
    if (!bestEffort) {
      return Response.json(
        { error: "No catalogue items match these style tags.", tags_used: tags, tag_source: via, catalog_source: source },
        { status: 422 }
      );
    }
    warnings.push(`No catalogue items match ${tags.join(", ")} — style relaxed, any-style picks placed.`);
    styled = entries.filter((e) => e.bundleable);
  }

  // Strict fit: at least one orientation inside the room.
  const fits = (e: CatalogEntry) =>
    (e.w_m <= room.w && e.d_m <= room.h) || (e.d_m <= room.w && e.w_m <= room.h);
  let fitting = styled.filter(fits);
  // Best-effort per-kind style fallback: a fixture the brief explicitly
  // mentions must be placed even when nothing of that kind carries the
  // requested tags — closest available wins, with a warning. Budget stays a
  // hard cap (plan.txt): only style relaxes, never money.
  const fittingAny = entries.filter((e) => e.bundleable && fits(e));
  if (fitting.length === 0 && !bestEffort) {
    return Response.json(
      { error: "Style-matching items do not fit this room size.", tags_used: tags, tag_source: via, catalog_source: source },
      { status: 422 }
    );
  }
  if (fittingAny.length === 0) {
    warnings.push(`Nothing in the catalogue fits a ${room.w} × ${room.h} m room — nothing placed.`);
  }

  // Greedy per kind (Bathtub → Shower → Toilet → Basin) × requested count
  // ("2 toilets" → 2 picks). Best style-overlap first, cheaper known price
  // breaks ties. Unknown-price items never count toward the sum but are
  // flagged. Strict 422s on a miss; best-effort skips (or includes over
  // budget when asked) with warnings. Multiples may repeat the best SKU
  // (twin vanities) once distinct options run out.
  const order: FixtureKind[] = ["Bathtub", "Shower", "Toilet", "Basin"];
  const counts = wantedCounts(`${body.style ?? ""} ${body.notes ?? ""}`);
  const noMentions = order.every((k) => counts[k] === 0);
  const score = (e: CatalogEntry) =>
    (e.style_tags ?? []).filter((t) => tags.includes(t)).length;
  const chosen: CatalogEntry[] = [];
  let remaining = budget;
  for (const kind of order) {
    const want = noMentions ? 1 : counts[kind];
    if (want === 0) continue;
    const sorted = (list: CatalogEntry[]) =>
      [...list].sort((a, b) => score(b) - score(a) || (a.price ?? Infinity) - (b.price ?? Infinity));
    const kindStyled = sorted(fitting.filter((e) => e.kind === kind));
    const kindAny = sorted(fittingAny.filter((e) => e.kind === kind));
    let relaxedWarned = false;
    let placedForKind = 0;
    for (let c = 0; c < want; c++) {
      const notChosen = (e: CatalogEntry) => !chosen.some((x) => x.sku === e.sku);
      let pool = kindStyled.filter(notChosen);
      if (pool.length === 0 && c > 0) pool = kindStyled; // multiples: repeat best SKU
      if (pool.length === 0 && bestEffort) {
        pool = kindAny.filter(notChosen).length ? kindAny.filter(notChosen) : kindAny;
        if (pool.length > 0 && !relaxedWarned) {
          relaxedWarned = true;
          warnings.push(`No ${kind.toLowerCase()} matches ${tags.join(", ")} — placed the closest available.`);
        }
      }
      if (pool.length === 0) {
        if (c === 0) warnings.push(`No ${kind} in the catalogue fits this room — skipped.`);
        break;
      }
      let pick: CatalogEntry | undefined = pool.find((e) => (e.price ?? 0) <= remaining);
      let over = false;
      if (!pick && bestEffort && includeOver && pool.length > 0) {
        pick = pool[0];
        over = true;
      }
      if (!pick) {
        if (!bestEffort) {
          return Response.json(
            {
              error: `Cheapest matching ${kind} (₹${Math.min(...pool.map((e) => e.price ?? Infinity)).toLocaleString("en-IN")}) exceeds the remaining ₹${remaining.toLocaleString("en-IN")} — strict budget, no bundle.`,
              tags_used: tags, tag_source: via, catalog_source: source,
            },
            { status: 422 }
          );
        }
        warnings.push(
          want > 1
            ? `Only ${placedForKind} of ${want} ${kind.toLowerCase()}${placedForKind === 1 ? "" : "s"} affordable within the remaining ₹${remaining.toLocaleString("en-IN")} — rest skipped.`
            : `No ${kind} affordable within the remaining ₹${remaining.toLocaleString("en-IN")} — skipped.`
        );
        break;
      }
      if (over) {
        warnings.push(`${pick.name} (₹${(pick.price ?? 0).toLocaleString("en-IN")}) exceeds the remaining ₹${remaining.toLocaleString("en-IN")} — included over budget on request.`);
        remaining = 0;
      } else {
        remaining -= pick.price ?? 0;
      }
      chosen.push(pick);
      placedForKind++;
      if (pick.price === null) warnings.push(`${pick.sku} has unverified pricing (Unknown) — excluded from total.`);
    }
  }
  if (chosen.length === 0) {
    if (!bestEffort) {
      return Response.json(
        { error: "Nothing affordable matches — strict budget, no bundle.", tags_used: tags, tag_source: via, catalog_source: source },
        { status: 422 }
      );
    }
    return Response.json({
      tags_used: tags, tag_source: via, catalog_source: source,
      bundle: [], totalCost_known: 0, budget_inr: budget, remaining_inr: remaining,
      unknownCount: 0, warnings, layout: [], room: { l_m: l, w_m: w, h_m: h },
    });
  }

  const { placements, warnings: layoutWarnings } = autoLayout(room, chosen);
  const totalCost = chosen.reduce((s, e) => s + (e.price ?? 0), 0);

  return Response.json({
    tags_used: tags,
    tag_source: via,
    catalog_source: source,
    bundle: chosen.map((e, i) => ({
      sku: e.sku,
      name: e.name,
      category: e.category,
      kind: e.kind,
      price_inr: e.price,
      modelId: e.modelId,
      reason: `Matches ${tags.filter((t) => (e.style_tags ?? []).includes(t)).join(", ") || "room fit"}; placed ${placements[i]?.x_m ?? 0}, ${placements[i]?.y_m ?? 0} m.`,
    })),
    totalCost_known: totalCost,
    budget_inr: budget,
    remaining_inr: remaining,
    over_budget: totalCost > budget,
    unknownCount: chosen.filter((e) => e.price === null).length,
    warnings: [...warnings, ...layoutWarnings],
    layout: placements,
    room: { l_m: l, w_m: w, h_m: h },
  });
}
