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
};

export const CATEGORIES = ["Showers", "Bathtubs", "Basins", "Smart Toilets", "Faucets"] as const;

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
