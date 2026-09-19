// Deterministic auto-layout placer for the 3D Design track.
// Pure functions, no LLM, no DOM. Takes bundle entries (metre footprints)
// + room dims, returns centre-based placements in metres + warnings.
// Callers convert to px via toSavedFixtures() for SavedDesign persistence
// (planner/3D scale: BASE_SCALE px/m, shrunk to fit MAX_W × MAX_H).
import type { CatalogEntry } from "./products";

export type RoomDims = { w: number; h: number; height: number; doors: number; windows: number };

export type Placement = {
  sku: string;
  kind: string;
  modelId: string;
  /** centre position in metres, origin = room centre (matches 3D viewer) */
  x_m: number;
  y_m: number;
  rotation_deg: 0 | 90;
  w_m: number;
  d_m: number;
};

export type LayoutResult = { placements: Placement[]; warnings: string[] };

const CLEAR = 0.15; // clearance gap between fixtures / walls (m)
const STEP = 0.1; // candidate scan resolution (m)

// Wall-anchored priority: biggest / wettest fixtures claim the far wall first.
const KIND_ORDER = ["Bathtub", "Shower", "Toilet", "Basin"] as const;

type Rect = { cx: number; cy: number; w: number; d: number };

const clash = (a: Rect, b: Rect) =>
  Math.abs(a.cx - b.cx) * 2 < a.w + b.w + CLEAR &&
  Math.abs(a.cy - b.cy) * 2 < a.d + b.d + CLEAR;

/**
 * Place each entry once. Zones: Bathtub → top-left along far wall, Shower →
 * top-right, Toilet → right wall, Basin → bottom (door) wall. Each zone scans
 * for the first non-clashing slot; falls back to room centre + warning.
 */
export function autoLayout(room: RoomDims, entries: CatalogEntry[]): LayoutResult {
  const warnings: string[] = [];
  const placed: (Rect & { sku: string; kind: string; modelId: string; rot: 0 | 90 })[] = [];

  const sorted = [...entries].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind as (typeof KIND_ORDER)[number]) - KIND_ORDER.indexOf(b.kind as (typeof KIND_ORDER)[number])
  );

  const zoneXT = (kind: string): [number, number] => {
    if (kind === "Bathtub") return [-room.w / 2, -room.w / 6];
    if (kind === "Shower") return [room.w / 6, room.w / 2];
    return [-room.w / 2, room.w / 2];
  };

  for (const e of sorted) {
    const orientations: { w: number; d: number; rot: 0 | 90 }[] =
      e.w_m <= room.w && e.d_m <= room.h
        ? [{ w: e.w_m, d: e.d_m, rot: 0 }]
        : [];
    // Rotated option only if it fits where the straight one doesn't.
    if (e.d_m <= room.w && e.w_m <= room.h && (e.w_m !== e.d_m)) {
      orientations.push({ w: e.d_m, d: e.w_m, rot: 90 });
    }
    if (orientations.length === 0) {
      warnings.push(
        `${e.sku} (${e.w_m}×${e.d_m} m) does not fit a ${room.w}×${room.h} m room — skipped.`
      );
      continue;
    }

    let slot: (Rect & { rot: 0 | 90 }) | null = null;
    const [x0, x1] = zoneXT(e.kind);
    // Scan rows from far (top, -h/2) to near wall so plumbing stacks together.
    outer: for (const o of orientations) {
      const yStart = -room.h / 2 + o.d / 2 + 0.02;
      const yEnd = e.kind === "Basin" ? room.h / 2 - o.d / 2 : room.h / 2 - o.d / 2;
      const rows: number[] = [];
      if (e.kind === "Basin") {
        for (let y = yEnd; y >= yStart - 1e-9; y -= STEP) rows.push(+y.toFixed(2));
      } else {
        for (let y = yStart; y <= yEnd + 1e-9; y += STEP) rows.push(+y.toFixed(2));
      }
      for (const cy of rows) {
        const xa = Math.max(x0, -room.w / 2 + o.w / 2 + 0.02);
        const xb = Math.min(x1, room.w / 2 - o.w / 2 - 0.02);
        for (let cx = xa; cx <= xb + 1e-9; cx += STEP) {
          const cand: Rect = { cx: +cx.toFixed(2), cy, w: o.w, d: o.d };
          if (placed.every((p) => !clash(cand, p))) {
            slot = { ...cand, rot: o.rot };
            break outer;
          }
        }
      }
    }

    if (!slot) {
      // Last resort: centre + warning (caller surfaces the clash outline).
      const o = orientations[0];
      slot = { cx: 0, cy: 0, w: o.w, d: o.d, rot: o.rot };
      warnings.push(`${e.sku} could not be placed clash-free — centred for manual adjustment.`);
    }
    placed.push({ ...slot, sku: e.sku, kind: e.kind, modelId: e.modelId });
  }

  return {
    placements: placed.map((p) => ({
      sku: p.sku, kind: p.kind, modelId: p.modelId,
      x_m: p.cx, y_m: p.cy, rotation_deg: p.rot, w_m: p.w, d_m: p.d,
    })),
    warnings,
  };
}

// Scale helpers shared with the planner + 3D view (keep in sync).
export const BASE_SCALE = 150;
export const MAX_W = 680;
export const MAX_H = 600;

export const displayScale = (room: RoomDims) =>
  Math.min(BASE_SCALE, MAX_W / room.w, MAX_H / room.h);

/** Convert metre placements → SavedFixture px items (planner/3D storage shape). */
export function toSavedFixtures(
  room: RoomDims,
  placements: Placement[],
  startId = 1
) {
  const s = displayScale(room);
  return placements.map((p, i) => ({
    id: startId + i,
    kind: p.kind,
    x: (p.x_m + room.w / 2) * s,
    y: (p.y_m + room.h / 2) * s,
    w: p.w_m * s,
    h: p.d_m * s,
    rot: p.rotation_deg,
    model: p.modelId,
  }));
}
