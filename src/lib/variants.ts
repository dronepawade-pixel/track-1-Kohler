// Model-variant registry — the single source of truth the AI matcher, the 3D
// swap tray and the footer admin editor read from. Seed data lives in
// assets/models/<category>/catalog.json (verified with zod at import). The
// admin editor stores a full replacement here in localStorage so edits apply
// live without a backend.
import { z } from "zod";
import { ALL_TAGS, keywordTags } from "./tags";
import bathtubsSeed from "../../assets/models/bathtubs/catalog.json";
import showersSeed from "../../assets/models/showers/catalog.json";
import toiletsSeed from "../../assets/models/toilets/catalog.json";
import sinksSeed from "../../assets/models/sinks/catalog.json";
import faucetsSeed from "../../assets/models/faucets/catalog.json";

export const FITS = ["footprint", "seat", "head", "screen", "basinTop", "faucet"] as const;
export const VARIANT_KINDS = ["Bathtub", "Shower", "Toilet", "Basin", "Faucet"] as const;

export const VariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(VARIANT_KINDS),
  fit: z.enum(FITS),
  tags: z.array(z.enum(ALL_TAGS)).default([]),
  price_inr: z.number().nonnegative(),
  dims_m: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]),
  glb: z.string().default(""),
  thumb: z.string().default(""),
});
export type Variant = z.infer<typeof VariantSchema>;

// Per-variant `kind` is optional in the JSON files: it defaults to the
// file's fixtureKind (bathtubs→Bathtub, sinks→Basin, faucets→Faucet…).
const CatalogFileSchema = z.object({
  category: z.string(),
  fixtureKind: z.enum(VARIANT_KINDS),
  variants: z.array(VariantSchema.extend({ kind: VariantSchema.shape.kind.optional() })).min(1),
});

const SEED_FILES = [bathtubsSeed, showersSeed, toiletsSeed, sinksSeed, faucetsSeed];

export const SEED_VARIANTS: Variant[] = SEED_FILES.flatMap((f) => {
  const parsed = CatalogFileSchema.safeParse(f);
  if (!parsed.success) {
    console.error("catalog seed failed zod validation", parsed.error.issues);
    return [];
  }
  return parsed.data.variants.map((v) => ({ ...v, kind: v.kind ?? parsed.data.fixtureKind }));
});

export const CATEGORY_IDS = ["bathtubs", "showers", "toilets", "sinks", "faucets"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORY_OF_KIND: Record<Variant["kind"], CategoryId> = {
  Bathtub: "bathtubs",
  Shower: "showers",
  Toilet: "toilets",
  Basin: "sinks",
  Faucet: "faucets",
};

const STORE_KEY = "kohler:variants:v2";

function readStore(): Variant[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const checked = z.array(VariantSchema).safeParse(parsed);
    if (!checked.success) return null;
    return checked.data;
  } catch {
    return null;
  }
}

/** Live registry: admin overrides if valid, else the seeded JSON files. */
export function loadVariants(): Variant[] {
  return readStore() ?? SEED_VARIANTS;
}

export function saveVariants(list: Variant[]): { ok: true } | { ok: false; error: string } {
  const checked = z.array(VariantSchema).safeParse(list);
  if (!checked.success)
    return { ok: false, error: checked.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const ids = checked.data.map((v) => v.id);
  const dupe = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupe) return { ok: false, error: `Duplicate variant id: ${dupe}` };
  window.localStorage.setItem(STORE_KEY, JSON.stringify(checked.data));
  return { ok: true };
}

export function resetVariants() {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORE_KEY);
}

export const isOverridden = () => readStore() !== null;

export const variantById = (id: string | undefined, all = loadVariants()): Variant | null =>
  !id ? null : all.find((v) => v.id === id) ?? null;

export const variantsForKind = (kind: Variant["kind"], all = loadVariants()): Variant[] =>
  all.filter((v) => v.kind === kind);

// --- budget + tag matching -------------------------------------------------

export const scoreVariant = (v: Variant, tags: string[]) =>
  v.tags.filter((t) => tags.includes(t)).length;

export type BundlePick = {
  fixtureIndex: number;
  kind: Variant["kind"];
  variant: Variant;
  score: number;
  tagHits: string[];
  overBudget: boolean;
};

export type BundleResult = {
  picks: BundlePick[];
  totalKnown: number;
  budgetCap: number;
  remaining: number;
  overBudget: boolean;
  tags: string[];
  warnings: string[];
};

const KIND_ORDER: Variant["kind"][] = ["Bathtub", "Shower", "Toilet", "Basin", "Faucet"];

/**
 * Deterministic bundle builder. For each fixture the planner added (in
 * Bathtub → Shower → Toilet → Basin order), pick the variant with the most
 * tag overlap, cheapest breaking ties, staying inside the budget cap. When no
 * affordable option exists, the cheapest match is still returned and flagged
 * overBudget (never silently dropped — the user chose "cheapest + warn").
 * A Basin also pulls a Faucet pick so sink + tap always ship together.
 */
export function buildBundle(
  fixtures: { kind: string }[],
  tags: string[],
  budgetCap: number,
  room: { w: number; h: number }
): BundleResult {
  const all = loadVariants();
  const warnings: string[] = [];
  const picks: BundlePick[] = [];
  const used = new Set<string>();
  let remaining = budgetCap;

  const wanted: { index: number; kind: Variant["kind"] }[] = fixtures
    .map((f, i) => ({ index: i, kind: f.kind as Variant["kind"] }))
    .filter((f) => (VARIANT_KINDS as readonly string[]).includes(f.kind))
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.index - b.index
    );

  const basinIndexes = wanted.filter((w) => w.kind === "Basin");

  for (const w of wanted) {
    let pool = all.filter((v) => v.kind === w.kind);
    if (w.kind !== "Faucet") {
      const primary = pool.filter((v) => v.fit === "footprint" || v.fit === "basinTop");
      if (primary.length > 0) pool = primary;
    }
    pool = pool.filter((v) => fitsRoom(v, room));
    if (pool.length === 0) {
      warnings.push(`No ${w.kind.toLowerCase()} in the catalogue fits a ${room.w}×${room.h} m room — left procedural.`);
      continue;
    }
    const scored = [...pool].sort(
      (a, b) => scoreVariant(b, tags) - scoreVariant(a, tags) || a.price_inr - b.price_inr
    );
    const unseen = scored.filter((v) => !used.has(v.id));
    const ranked = unseen.length > 0 ? unseen : scored;
    let pick = ranked.find((v) => v.price_inr <= remaining);
    let overBudget = false;
    if (!pick) {
      pick = ranked[0];
      overBudget = true;
      warnings.push(
        `${pick.name} (₹${pick.price_inr.toLocaleString("en-IN")}) exceeds the remaining ₹${remaining.toLocaleString("en-IN")} — cheapest matching ${w.kind.toLowerCase()} shown anyway.`
      );
      remaining = 0;
    } else {
      remaining -= pick.price_inr;
    }
    used.add(pick.id);
    const tagHits = pick.tags.filter((t) => tags.includes(t));
    if (tagHits.length === 0)
      warnings.push(`${pick.name} matches none of ${tags.join(", ")} — closest available ${w.kind.toLowerCase()}.`);
    picks.push({
      fixtureIndex: w.index,
      kind: w.kind,
      variant: pick,
      score: scoreVariant(pick, tags),
      tagHits,
      overBudget,
    });

    // Every Basin gets a faucet companion (same budget rules).
    if (w.kind === "Basin" && basinIndexes.length > 0 && !picks.some((p) => p.kind === "Faucet")) {
      const faucets = all
        .filter((v) => v.kind === "Faucet")
        .sort((a, b) => scoreVariant(b, tags) - scoreVariant(a, tags) || a.price_inr - b.price_inr);
      if (faucets.length === 0) {
        warnings.push("No faucets in the catalogue — basin ships without a tap.");
      } else {
        const fp = faucets.find((v) => v.price_inr <= remaining) ?? faucets[0];
        const fOver = fp.price_inr > remaining;
        remaining = Math.max(0, remaining - fp.price_inr);
        used.add(fp.id);
        picks.push({
          fixtureIndex: w.index,
          kind: "Faucet",
          variant: fp,
          score: scoreVariant(fp, tags),
          tagHits: fp.tags.filter((t) => tags.includes(t)),
          overBudget: fOver,
        });
        if (fOver)
          warnings.push(`Faucet ${fp.name} pushed the bundle over budget — cheapest shown.`);
      }
    }
  }

  const totalKnown = picks.reduce((s, p) => s + p.variant.price_inr, 0);
  return {
    picks,
    totalKnown,
    budgetCap,
    remaining: Math.max(0, budgetCap - totalKnown),
    overBudget: totalKnown > budgetCap || picks.some((p) => p.overBudget),
    tags,
    warnings,
  };
}

/** Footprint variants must physically fit the room in either rotation;
 *  attached parts (seat/head/screen/basinTop/faucet) always "fit". */
function fitsRoom(v: Variant, room: { w: number; h: number }): boolean {
  if (v.fit !== "footprint") return true;
  const [w, , d] = v.dims_m;
  return (w <= room.w && d <= room.h) || (d <= room.w && w <= room.h);
}

/** Free text → tags, deterministic, no network (used as API fallback and by
 *  the 3D page when the tags endpoint is unreachable). */
export const tagsFromText = (text: string): string[] => keywordTags(text);
