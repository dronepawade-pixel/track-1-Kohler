// Unified tag taxonomy for AI style matching. Three groups: style, color,
// material. Gemini maps free text onto these ONLY (see /api/tags); the
// keyword fallback below keeps matching alive without an API key.
export const STYLE_TAGS = [
  "minimal",
  "modern",
  "zen",
  "classic",
  "luxury",
  "heritage",
  "bold",
] as const;

export const COLOR_TAGS = [
  "white",
  "black",
  "chrome",
  "nickel",
  "brass",
  "gold",
] as const;

export const MATERIAL_TAGS = [
  "marble",
  "ceramic",
  "stone",
  "wood",
  "glass",
] as const;

export const ALL_TAGS = [...STYLE_TAGS, ...COLOR_TAGS, ...MATERIAL_TAGS] as const;
export type Tag = (typeof ALL_TAGS)[number];

export const isTag = (t: string): t is Tag => (ALL_TAGS as readonly string[]).includes(t);

// Keyword fallback: free text → tags, no LLM needed. Order matters only for
// display; "clean" implies minimalist + white per the product brief.
const KEYWORDS: [RegExp, Tag[]][] = [
  [/minimal|simple|clean|less is more/i, ["minimal", "white"]],
  [/modern|contemporary|composed/i, ["modern"]],
  [/zen|spa|calm|japandi|wabi/i, ["zen"]],
  [/classic|timeless|traditional/i, ["classic"]],
  [/luxury|luxurious|premium|luxe|hotel/i, ["luxury"]],
  [/heritage|vintage|colonial|clawfoot/i, ["heritage"]],
  [/bold|statement|dramatic/i, ["bold"]],
  [/marble|quartz/i, ["marble"]],
  [/granite|terrazzo|concrete|stone/i, ["stone"]],
  [/wood|timber|oak|walnut/i, ["wood"]],
  [/glass/i, ["glass"]],
  [/ceramic|porcelain/i, ["ceramic"]],
  [/black|dark|charcoal|graphite/i, ["black"]],
  [/white|ivory|cream|bright/i, ["white"]],
  [/chrome|polished|steel/i, ["chrome"]],
  [/nickel|brushed/i, ["nickel"]],
  [/brass/i, ["brass"]],
  [/gold|gilded/i, ["gold"]],
];

export function keywordTags(text: string): Tag[] {
  const tags = new Set<Tag>();
  for (const [re, t] of KEYWORDS) if (re.test(text)) t.forEach((x) => tags.add(x));
  if (tags.size === 0) return ["modern", "minimal", "white"];
  return [...tags].slice(0, 6);
}
