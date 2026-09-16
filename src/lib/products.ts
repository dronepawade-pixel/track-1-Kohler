// Placeholder catalog rows — structure only.
// Per plan.txt NON-NEGOTIABLE DATA RULE: real specs are Unknown until
// verified against https://www.studiokohler.com/home. Never invent SKUs/prices.
export type Product = {
  sku: string;
  name: string;
  category: "Showers" | "Bathtubs" | "Basins" | "Smart Toilets" | "Faucets" | "Mirrors";
  collection: string;
  finish: string;
  price: number | null; // null = Unknown
  dimensions: string | null;
  url: string | null;
};

export const CATEGORIES = ["Showers", "Bathtubs", "Basins", "Smart Toilets", "Faucets", "Mirrors"] as const;

export const PLACEHOLDER_PRODUCTS: Product[] = [
  { sku: "PENDING-001", name: "Rainshower — verification pending", category: "Showers", collection: "Unknown", finish: "Unknown", price: null, dimensions: null, url: null },
  { sku: "PENDING-002", name: "Freestanding bathtub — verification pending", category: "Bathtubs", collection: "Unknown", finish: "Unknown", price: null, dimensions: null, url: null },
  { sku: "PENDING-003", name: "Vessel basin — verification pending", category: "Basins", collection: "Unknown", finish: "Unknown", price: null, dimensions: null, url: null },
  { sku: "PENDING-004", name: "Wall-hung smart toilet — verification pending", category: "Smart Toilets", collection: "Unknown", finish: "Unknown", price: null, dimensions: null, url: null },
  { sku: "PENDING-005", name: "Single-control faucet — verification pending", category: "Faucets", collection: "Unknown", finish: "Unknown", price: null, dimensions: null, url: null },
  { sku: "PENDING-006", name: "Lighted mirror — verification pending", category: "Mirrors", collection: "Unknown", finish: "Unknown", price: null, dimensions: null, url: null },
];

export const fmtPrice = (p: number | null) =>
  p === null ? "Unknown" : `₹${p.toLocaleString("en-IN")}`;
