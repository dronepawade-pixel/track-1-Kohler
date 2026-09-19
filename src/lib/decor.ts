// Decor catalogue — movable styling pieces for the 2D planner + 3D view.
// Decor is NEVER a product: no SKU, no price, excluded from budget totals
// and clash warnings. Positions persist in SavedDesign.items via `decorId`;
// the GLB renders when assets arrive, otherwise a monochrome fallback box.
export type DecorOption = {
  id: string;
  label: string;
  w: number; // footprint metres (x)
  h: number; // footprint metres (z)
  tall: number; // display height in metres for the 3D view
  glb: string | null; // /models/decor-*.glb once converted — null = fallback box
  glyph: string; // 2D canvas label
};

export const DECOR_OPTIONS: DecorOption[] = [
  { id: "plant", label: "Monstera plant", w: 0.4, h: 0.49, tall: 0.46, glb: "/models/decor-plant-plain.glb", glyph: "Plant" },
  { id: "plant-pot", label: "Flower pot", w: 0.3, h: 0.3, tall: 0.52, glb: "/models/decor-plant-pot-plain.glb", glyph: "Pot" },
  { id: "towel-ladder", label: "Towel ladder", w: 0.5, h: 0.15, tall: 1.5, glb: null, glyph: "Ladder" },
  { id: "towel-stack", label: "Towel stack", w: 0.4, h: 0.33, tall: 0.35, glb: "/models/decor-towels-plain.glb", glyph: "Towels" },
  { id: "tray-set", label: "Soap tray set", w: 0.3, h: 0.15, tall: 0.18, glb: null, glyph: "Tray" },
  { id: "hamper", label: "Laundry hamper", w: 0.4, h: 0.4, tall: 0.6, glb: null, glyph: "Hamper" },
  { id: "stool", label: "Bath stool", w: 0.35, h: 0.35, tall: 0.43, glb: "/models/decor-stool-plain.glb", glyph: "Stool" },
  { id: "bath-caddy", label: "Bath caddy", w: 0.8, h: 0.2, tall: 0.06, glb: null, glyph: "Caddy" },
];

export const decorById = (id: string | undefined | null): DecorOption | null =>
  DECOR_OPTIONS.find((d) => d.id === id) ?? null;

// Rim heights (m) that decor rests on when dropped over a fixture in 2D.
export const SURFACE_TOP: Record<string, number> = {
  Basin: 0.94,
  Bathtub: 0.6,
  Toilet: 0.7,
  Shower: 0.1,
  Vanity: 0.9,
};

export const isDecorFixture = (f: { decorId?: string | null }): boolean => !!f.decorId;
