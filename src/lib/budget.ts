// Budget ranges — users pick a band, never type a number. The cap (INR)
// is the single source of truth; labels stay short for pills.
export type BudgetRange = { id: string; label: string; cap: number; blurb: string };

export const BUDGET_RANGES: BudgetRange[] = [
  { id: "essential", label: "Essential", cap: 200000, blurb: "Up to ₹2 L" },
  { id: "comfort", label: "Comfort", cap: 450000, blurb: "Up to ₹4.5 L" },
  { id: "premium", label: "Premium", cap: 700000, blurb: "Up to ₹7 L" },
  { id: "flagship", label: "Flagship", cap: 1200000, blurb: "Up to ₹12 L" },
];

export const DEFAULT_BUDGET_ID = "comfort";

export const budgetById = (id: string): BudgetRange =>
  BUDGET_RANGES.find((b) => b.id === id) ?? BUDGET_RANGES[1];
