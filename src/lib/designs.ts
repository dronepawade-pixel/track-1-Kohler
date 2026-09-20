// Local design library — persists planner snapshots to localStorage.
// Works with zero backend (no Supabase keys needed). When the Supabase
// tables (design_projects + design_versions) are wired up, swap these
// helpers for DB calls — the SavedDesign shape already mirrors that schema.
export type SavedFixture = { id: number; kind: string; x: number; y: number; w: number; h: number; rot: number; model?: string; faucet?: string; seat?: string; screen?: string; decorId?: string };
export type SavedOpening = {
  id: number;
  kind: "door" | "window";
  wall: "top" | "bottom" | "left" | "right";
  offsetM: number;
  widthM: number;
};
export type SavedRoom = { w: number; h: number; height: number; doors: number; windows: number };
// Step-1 brief carried into the 3D view so the AI matcher can pick variants
// ("clean minimal bathroom marble" + budget band → tags → bundle).
export type SavedBrief = { budgetId: string; style: string; notes: string };
export type SavedDesign = {
  id: string;
  title: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  room: SavedRoom;
  items: SavedFixture[];
  openings: SavedOpening[];
  brief?: SavedBrief;
};

const KEY = "kohler:designs:v1";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `d-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function loadDesigns(): SavedDesign[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d): d is SavedDesign =>
        !!d && typeof d.id === "string" && typeof d.title === "string" && !!d.room && Array.isArray(d.items) && Array.isArray(d.openings)
    );
  } catch {
    return [];
  }
}

function persist(all: SavedDesign[]) {
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

export function getDesign(id: string): SavedDesign | null {
  return loadDesigns().find((d) => d.id === id) ?? null;
}

/** Insert or replace by id. Returns the full list, newest first. */
export function upsertDesign(design: SavedDesign): SavedDesign[] {
  const rest = loadDesigns().filter((d) => d.id !== design.id);
  const all = [design, ...rest];
  persist(all);
  return all;
}

export function deleteDesign(id: string): SavedDesign[] {
  const all = loadDesigns().filter((d) => d.id !== id);
  persist(all);
  return all;
}

export const designMeta = (d: SavedDesign) =>
  `${d.room.w} × ${d.room.h} m · ${d.items.length} fixture${d.items.length === 1 ? "" : "s"}`;

// Kohler sells no mirrors: silently drop legacy mirror openings/fixtures so
// old saves still open cleanly after the category was removed.
export function sanitizeDesign(d: SavedDesign): SavedDesign {
  return {
    ...d,
    items: d.items.filter((f) => f.kind !== "Mirror"),
    openings: d.openings.filter((o) => (o.kind as string) === "door" || (o.kind as string) === "window"),
  };
}
