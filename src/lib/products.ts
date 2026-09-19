// Placeholder catalog rows — structure only.
// Per plan.txt NON-NEGOTIABLE DATA RULE: real specs are Unknown until
// verified against https://www.studiokohler.com/home. Never invent SKUs/prices.
export type Product = {
  sku: string;
  name: string;
  category: "Showers" | "Bathtubs" | "Basins" | "Smart Toilets" | "Faucets";
  subtype: string | null; // Kohler taxonomy type (e.g. "Vessel Sinks"); null = unverified
  collection: string;
  finish: string;
  price: number | null; // null = Unknown
  dimensions: string | null;
  url: string | null;
  // Catalog-asset columns (mirror supabase migration XXXX_catalog_assets).
  // All optional so legacy placeholder rows keep compiling.
  width_mm?: number | null;
  depth_mm?: number | null;
  height_mm?: number | null;
  style_tags?: string[]; // LOCAL matching tags, not official Kohler taxonomy
  model_glb_url?: string | null;
  footprint_svg?: string | null;
  dwg_url?: string | null;
  image_urls?: string[];
};

export const CATEGORIES = ["Showers", "Bathtubs", "Basins", "Smart Toilets", "Faucets"] as const;

// Fixed style taxonomy for AI tag normalization. Gemini must map free text
// onto these only — see POST /api/recommend.
export const STYLE_TAXONOMY = [
  "minimalist",
  "modern",
  "zen",
  "classic",
  "luxury",
  "heritage",
  "bold",
] as const;
export type StyleTag = (typeof STYLE_TAXONOMY)[number];

// Sub-types mirror Kohler's own shop taxonomy (category landing pages).
// Products link to these only after verification — never assumed.
export const SUBCATEGORIES: Record<string, string[]> = {
  Basins: [
    "Vessel Sinks",
    "Undermount Sinks",
    "Drop-In Sinks",
    "Pedestal Sinks",
    "Console Sinks",
    "Wall-Mounted Sinks",
    "Artist Editions Sinks",
  ],
  Faucets: [
    "Widespread Faucets",
    "Single Control Faucets",
    "Centerset Faucets",
    "Wall-Mounted Faucets",
    "Bathtub Faucets",
    "Shower Valves & Trim",
  ],
  Showers: [
    "Rainheads",
    "Shower Heads",
    "Handshowers",
    "Body Sprays",
    "Shower Valves & Trim",
    "Smart Showers",
    "Steam Showers",
    "Shower Doors",
    "Shower Bases",
    "Shower Columns & Kits",
    "Shower Drains",
    "Shower Fittings",
  ],
  Bathtubs: [
    "Freestanding Bathtubs",
    "Alcove Bathtubs",
    "Drop-In Bathtubs",
    "Hydrotherapy Bathtubs",
  ],
  "Smart Toilets": [
    "Smart Toilets",
    "One-Piece Toilets",
    "Two-Piece Toilets",
    "Wall-Hung Toilets",
    "Tall Toilets",
    "Bidet Seats",
  ],
};

export const PLACEHOLDER_PRODUCTS: Product[] = [
  { sku: "PENDING-001", name: "Rainshower — verification pending", category: "Showers", subtype: null, collection: "Unknown", finish: "Unknown", price: null, dimensions: null, url: null },
  { sku: "PENDING-002", name: "Freestanding bathtub — verification pending", category: "Bathtubs", subtype: null, collection: "Unknown", finish: "Unknown", price: null, dimensions: null, url: null },
  { sku: "PENDING-003", name: "Vessel basin — verification pending", category: "Basins", subtype: null, collection: "Unknown", finish: "Unknown", price: null, dimensions: null, url: null },
  { sku: "PENDING-004", name: "Wall-hung smart toilet — verification pending", category: "Smart Toilets", subtype: null, collection: "Unknown", finish: "Unknown", price: null, dimensions: null, url: null },
  { sku: "PENDING-005", name: "Single-control faucet — verification pending", category: "Faucets", subtype: null, collection: "Unknown", finish: "Unknown", price: null, dimensions: null, url: null },
];

export const fmtPrice = (p: number | null) =>
  p === null ? "Unknown" : `₹${p.toLocaleString("en-IN")}`;

// ---------------------------------------------------------------------------
// AI catalog: local scans (real GLBs + measured dims, price Unknown) joined
// with verified seed-CSV rows (real SKUs/prices, GLB pending → 3D fallback).
// `sku` values starting with "SCAN-" are LOCAL scan ids, not Kohler SKUs.
// style_tags are LOCAL matching tags, not an official Kohler taxonomy.
// ---------------------------------------------------------------------------

export type FixtureKind = "Bathtub" | "Shower" | "Toilet" | "Basin";

export type CatalogEntry = Product & {
  kind: FixtureKind;
  /** MODEL_OPTIONS id in src/lib/models.ts, or "procedural" when no GLB yet. */
  modelId: string;
  /** Footprint in metres (w = x, d = z). Measured from scans or seed CSV. */
  w_m: number;
  d_m: number;
  /** false = swap-tray accessory (seat/head/trim), never auto-placed. */
  bundleable: boolean;
};

export const CATALOG_PRODUCTS: CatalogEntry[] = [
  {
    sku: "SCAN-21000-P5", name: "Clawfoot Tub (local scan 21000-P5)",
    category: "Bathtubs", subtype: "Freestanding Bathtubs", collection: "Unknown",
    finish: "Unknown", price: null, dimensions: "168.1 × 82.6 cm (measured from scan)",
    url: null, kind: "Bathtub", modelId: "tub-21000", w_m: 1.681, d_m: 0.826,
    bundleable: true, width_mm: 1681, depth_mm: 826, height_mm: 705,
    style_tags: ["classic", "luxury", "heritage"],
    model_glb_url: "/models/21000-P5-plain.glb", image_urls: [],
  },
  {
    sku: "SCAN-75790", name: "Two-Piece Toilet (local scan 75790)",
    category: "Smart Toilets", subtype: "Two-Piece Toilets", collection: "Unknown",
    finish: "Unknown", price: null, dimensions: "36.1 × 83.1 cm (measured from scan)",
    url: null, kind: "Toilet", modelId: "toilet-75790", w_m: 0.361, d_m: 0.831,
    bundleable: true, width_mm: 361, depth_mm: 831, height_mm: 712,
    style_tags: ["modern", "minimalist"],
    model_glb_url: "/models/75790-plain.glb", image_urls: [],
  },
  {
    sku: "SCAN-707002-D3", name: "Shower Door enclosure (local scan 707002-D3)",
    category: "Showers", subtype: "Shower Doors", collection: "Unknown",
    finish: "Unknown", price: null, dimensions: "151.4 × 12.7 cm (measured from scan)",
    url: null, kind: "Shower", modelId: "screen-707002", w_m: 1.514, d_m: 0.6,
    bundleable: true, width_mm: 1514, depth_mm: 600, height_mm: 1573,
    style_tags: ["modern", "minimalist"],
    model_glb_url: "/models/707002-D3-plain.glb", image_urls: [],
  },
  {
    sku: "SCAN-706008-L", name: "Shower Panel (local scan 706008-L)",
    category: "Showers", subtype: "Shower Doors", collection: "Unknown",
    finish: "Unknown", price: null, dimensions: "44.6 × 3.5 cm (measured from scan)",
    url: null, kind: "Shower", modelId: "screen-706008", w_m: 0.446, d_m: 0.4,
    bundleable: false, width_mm: 446, depth_mm: 400, height_mm: 736,
    style_tags: ["modern", "minimalist"],
    model_glb_url: "/models/706008-L-plain.glb", image_urls: [],
  },
  {
    sku: "K-1234", name: "Composed Vessel Basin",
    category: "Basins", subtype: "Vessel Sinks", collection: "Composed",
    finish: "Matte Black", price: 32000, dimensions: "55 × 42 × 16 cm",
    url: "https://www.studiokohler.com/home/products/composed-k-1234",
    kind: "Basin", modelId: "procedural", w_m: 0.55, d_m: 0.42,
    bundleable: true, width_mm: 550, depth_mm: 420, height_mm: 160,
    style_tags: ["minimalist", "modern"],
    model_glb_url: null, image_urls: ["images/K-1234-hero.jpg"],
  },
  {
    sku: "K-5401", name: "Veil Wall-Hung Smart Toilet",
    category: "Smart Toilets", subtype: "Wall-Hung Toilets", collection: "Veil",
    finish: "White", price: 145000, dimensions: "70 × 58 × 45 cm",
    url: "https://www.studiokohler.com/home/products/veil-k-5401",
    kind: "Toilet", modelId: "procedural", w_m: 0.7, d_m: 0.58,
    bundleable: true, width_mm: 700, depth_mm: 580, height_mm: 450,
    style_tags: ["minimalist", "modern", "zen"],
    model_glb_url: "models/K-5401.glb", image_urls: ["images/K-5401-hero.jpg"],
  },
  {
    sku: "K-77795", name: "Eir One-piece elongated smart toilet dual-flush",
    category: "Smart Toilets", subtype: "One-Piece Toilets", collection: "Eir",
    finish: "White", price: null, dimensions: "41.8 × 70 × 41.6 cm",
    url: "https://www.kohler.com/products/bathroom/toilets/77795",
    kind: "Toilet", modelId: "procedural", w_m: 0.418, d_m: 0.7,
    bundleable: true, width_mm: 418, depth_mm: 700, height_mm: 416,
    style_tags: ["minimalist", "modern"],
    model_glb_url: "models/K-77795.glb", image_urls: ["images/K-77795-hero.jpg"],
  },
];

/** Swap-tray accessories: present in the 3D viewer, never auto-placed. */
export const ACCESSORY_IDS = ["seat-30754", "head-22170", "trim-13696", "screen-706008"];
