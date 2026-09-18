// Swappable Kohler model catalogue for the 3D viewer.
// IDs match thumbnail files in public/images/products/<id>.jpg.
// dims are real metres (x=width, y=height, z=depth) measured from the scans.
export type ModelFit = "footprint" | "seat" | "head" | "screen";

export type ModelOption = {
  id: string;
  label: string;
  kinds: string[]; // fixture kinds this option fits
  glb: string;
  thumb: string;
  dims: [number, number, number];
  fit: ModelFit;
};

export const PROCEDURAL = "procedural";

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "tub-21000", label: "Clawfoot Tub 21000", kinds: ["Bathtub"], glb: "/models/21000-P5-plain.glb", thumb: "/images/products/tub-21000.jpg", dims: [1.681, 0.705, 0.826], fit: "footprint" },
  { id: "toilet-75790", label: "Two-Piece 75790", kinds: ["Toilet"], glb: "/models/75790-plain.glb", thumb: "/images/products/toilet-75790.jpg", dims: [0.361, 0.712, 0.831], fit: "footprint" },
  { id: "seat-30754", label: "Smart Seat 30754", kinds: ["Toilet"], glb: "/models/30754-PA-plain.glb", thumb: "/images/products/toilet-smart-30754.jpg", dims: [0.315, 0.383, 0.295], fit: "seat" },
  { id: "head-22170", label: "Rainhead 22170", kinds: ["Shower"], glb: "/models/22170-plain.glb", thumb: "/images/products/head-22170.jpg", dims: [0.139, 0.135, 0.128], fit: "head" },
  { id: "trim-13696", label: "Shower Trim 13696", kinds: ["Shower"], glb: "/models/13696-G-plain.glb", thumb: "/images/products/trim-13696.jpg", dims: [0.1, 0.028, 0.1], fit: "head" },
  { id: "screen-707002", label: "Shower Door 707002", kinds: ["Shower"], glb: "/models/707002-D3-plain.glb", thumb: "/images/products/door-707002.jpg", dims: [1.514, 1.573, 0.127], fit: "screen" },
  { id: "screen-706008", label: "Shower Panel 706008", kinds: ["Shower"], glb: "/models/706008-L-plain.glb", thumb: "/images/products/panel-706008.jpg", dims: [0.446, 0.736, 0.035], fit: "screen" },
];

export const optionsForKind = (kind: string): ModelOption[] =>
  MODEL_OPTIONS.filter((m) => m.kinds.includes(kind));

export const optionById = (id: string | undefined): ModelOption | null =>
  MODEL_OPTIONS.find((m) => m.id === id) ?? null;
