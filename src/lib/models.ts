// Swappable model catalogue for the 3D viewer, derived from the variant
// registry (assets/models/<category>/catalog.json + admin overrides).
// Variant ids double as model ids; a variant with an empty `glb` still
// resolves here so finish/price lookups work, but the viewer keeps its
// procedural mesh in that case (ModelPart is only used when glb is set).
import { loadVariants, type Variant } from "./variants";

export type ModelFit = "footprint" | "seat" | "head" | "screen" | "basinTop" | "faucet" | "part";

export type ModelOption = {
  id: string;
  label: string;
  kinds: string[]; // fixture kinds this option fits
  glb: string;
  thumb: string;
  dims: [number, number, number];
  fit: ModelFit;
  variant: Variant;
};

export const PROCEDURAL = "procedural";

const KIND_BY_FIT: Record<Variant["fit"], string[]> = {
  footprint: ["Bathtub", "Toilet", "Shower"],
  seat: ["Toilet"],
  head: ["Shower"],
  screen: ["Shower"],
  basinTop: ["Basin"],
  faucet: ["Basin"],
  // "part" accessories (valve trims, controls, fittings) have no
  // auto-placement yet — registry + admin only until the viewer learns them.
  part: [],
};

// footprint variants render under their own fixture kind, not all three.
const KIND_BY_VARIANT: Record<Variant["kind"], string[]> = {
  Bathtub: ["Bathtub"],
  Shower: ["Shower"],
  Toilet: ["Toilet"],
  Basin: ["Basin"],
  Faucet: ["Basin"], // faucets mount on basins
};

const toOption = (v: Variant): ModelOption => ({
  id: v.id,
  label: v.name,
  kinds: KIND_BY_VARIANT[v.kind],
  glb: v.glb,
  thumb: v.thumb,
  dims: [v.dims_m[0], v.dims_m[1], v.dims_m[2]],
  fit: v.fit,
  variant: v,
});

/** Live options from the registry (seed JSON unless the admin editor saved
 *  overrides). Called per render pass — cheap for catalogue-sized lists. */
export const modelOptions = (): ModelOption[] =>
  loadVariants().filter((v) => v.kind !== "Faucet" || v.fit === "faucet").map(toOption);

export const MODEL_OPTIONS: ModelOption[] = loadVariants().map(toOption);

export const optionsForKind = (kind: string): ModelOption[] =>
  modelOptions().filter(
    (m) =>
      m.kinds.includes(kind) &&
      (m.variant.kind === "Faucet" ? false : true) // swap tray lists primaries only
  );

export const optionById = (id: string | undefined): ModelOption | null =>
  !id || id === PROCEDURAL ? null : modelOptions().find((m) => m.id === id) ?? null;

export const faucetForBasin = (id: string | undefined): ModelOption | null =>
  !id || id === PROCEDURAL ? null : modelOptions().find((m) => m.id === id && m.variant.kind === "Faucet") ?? null;

export { KIND_BY_FIT };
