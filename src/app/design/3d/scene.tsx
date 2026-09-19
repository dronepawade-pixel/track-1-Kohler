"use client";
import { useEffect, useRef, useState } from "react";
import { decorById } from "@/lib/decor";

// Dollhouse isometric renderer — dependency-free SVG, monochrome per design.md.
// Camera orbits when you drag; front-facing walls drop to cutaway height so the
// room interior stays visible from every angle.

export type MetreFixture = {
  id: number;
  kind: string;
  cx: number; // centre-x in metres, room-centred
  cz: number; // centre-z in metres, room-centred
  w: number;
  d: number;
  h: number;
  y0?: number; // base height in metres (wall-mounted pieces float)
  glass?: boolean;
  decorId?: string; // set for movable decor placed on the 2D canvas
  rot?: number; // yaw degrees from the 2D canvas Rotate (0/90/180/270)
};
export type MetreOpening = {
  kind: "door" | "window";
  wall: "top" | "bottom" | "left" | "right";
  offsetM: number;
  widthM: number;
};
export type RoomDims = { w: number; h: number; height: number };

type Box3 = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };
type Palette = { top: string; front: string; side: string; edge: string; opacity?: number };

const WALL_T = 0.12;
const CUT_H = 1.1;

const rotY = (x: number, z: number, th: number): [number, number] => [
  x * Math.cos(th) - z * Math.sin(th),
  x * Math.sin(th) + z * Math.cos(th),
];

const useProjector = (th: number, k: number) => {
  const proj = (x: number, y: number, z: number): [number, number] => {
    const [xr, zr] = rotY(x, z, th);
    return [xr * k, (zr * 0.5 - y) * k];
  };
  const depth = (x: number, z: number) => rotY(x, z, th)[1];
  return { proj, depth };
};

function Box({
  box,
  pal,
  th,
  k,
}: {
  box: Box3;
  pal: Palette;
  th: number;
  k: number;
}) {
  const { proj, depth } = useProjector(th, k);
  const v: [number, number, number] = [Math.sin(th), 0, Math.cos(th)];
  const dot = (n: [number, number, number]) => n[0] * v[0] + n[1] * v[1] + n[2] * v[2];
  const { x0, x1, y0, y1, z0, z1 } = box;
  const faces: { n: [number, number, number]; pts: [number, number, number][]; fill: string }[] = [
    { n: [0, 1, 0], pts: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], fill: pal.top },
    { n: [1, 0, 0], pts: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], fill: pal.side },
    { n: [-1, 0, 0], pts: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], fill: pal.side },
    { n: [0, 0, 1], pts: [[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], fill: pal.front },
    { n: [0, 0, -1], pts: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], fill: pal.front },
  ];
  const op = pal.opacity ?? 1;
  return (
    <g opacity={op}>
      {faces
        .filter((f) => (f.n[1] === 1 ? true : dot(f.n) > 0.01))
        .sort((a, b) => {
          const da = a.pts.reduce((s, p) => s + depth(p[0], p[2]), 0) / a.pts.length;
          const db = b.pts.reduce((s, p) => s + depth(p[0], p[2]), 0) / b.pts.length;
          return da - db;
        })
        .map((f, i) => (
          <polygon
            key={i}
            points={f.pts.map(([x, y, z]) => proj(x, y, z).join(",")).join(" ")}
            fill={f.fill}
            stroke={pal.edge}
            strokeWidth={1}
            strokeLinejoin="round"
          />
        ))}
    </g>
  );
}

const WALL_PAL: Palette = { top: "#1e1e1e", front: "#101010", side: "#161616", edge: "#2c2c2c" };
const CAP_PAL: Palette = { top: "#333333", front: "#1d1d1d", side: "#242424", edge: "#3d3d3d" };
const SKIRT_PAL: Palette = { top: "#2a2a2a", front: "#181818", side: "#1f1f1f", edge: "#383838" };
const FIXTURE_PAL: Palette = { top: "#333333", front: "#202020", side: "#292929", edge: "#5a5a5a" };
const FRAME_PAL: Palette = { top: "#3d3d3d", front: "#232323", side: "#2f2f2f", edge: "#707070" };
const LEAF_PAL: Palette = { top: "#1b1b1b", front: "#0a0a0a", side: "#131313", edge: "#4f4f4f" };
const PANEL_PAL: Palette = { top: "#2c2c2c", front: "#141414", side: "#1e1e1e", edge: "#565656" };
const RECESS_PAL: Palette = { top: "#050505", front: "#050505", side: "#050505", edge: "#050505" };
const GLASS_PAL: Palette = { top: "#f5f5f0", front: "#f5f5f0", side: "#f5f5f0", edge: "#f5f5f0", opacity: 0.22 };
const CREAM_PAL: Palette = { top: "#f5f5f0", front: "#f5f5f0", side: "#d8d8d2", edge: "#f5f5f0", opacity: 0.85 };
const SILL_PAL: Palette = { top: "#f5f5f0", front: "#e8e8e2", side: "#d8d8d2", edge: "#f5f5f0" };

// Planner wall ids → 3D walls (north = -z, south = +z, west = -x, east = +x).
const wallFrame = (room: RoomDims, wall: MetreOpening["wall"], H: number): { len: number; fixed: { axis: "x" | "z"; at: number } } => {
  if (wall === "top") return { len: room.w, fixed: { axis: "z", at: -room.h / 2 } };
  if (wall === "bottom") return { len: room.w, fixed: { axis: "z", at: room.h / 2 } };
  if (wall === "left") return { len: room.h, fixed: { axis: "x", at: -room.w / 2 } };
  return { len: room.h, fixed: { axis: "x", at: room.w / 2 } };
};

export default function IsoRoom({
  room,
  fixtures,
  openings,
}: {
  room: RoomDims;
  fixtures: MetreFixture[];
  openings: MetreOpening[];
}) {
  const [th, setTh] = useState(Math.PI / 4);
  const [k, setK] = useState(90);
  const [cutaway, setCutaway] = useState(true);
  const [labels, setLabels] = useState(true);
  const [spin, setSpin] = useState(false);
  const drag = useRef<{ x: number; th: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!spin) return;
    const t = setInterval(() => setTh((p) => p + 0.02), 50);
    return () => clearInterval(t);
  }, [spin]);

  // Non-passive wheel zoom (React onWheel can't preventDefault).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setK((prev) => Math.min(240, Math.max(36, prev * Math.exp(-e.deltaY * 0.0012))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const v: [number, number, number] = [Math.sin(th), 0, Math.cos(th)];
  const H = room.height;
  const hx = room.w / 2;
  const hz = room.h / 2;

  const walls: { box: Box3; cut: boolean }[] = [
    { box: { x0: -hx - WALL_T, x1: hx + WALL_T, y0: 0, y1: H, z0: -hz - WALL_T, z1: -hz }, cut: false }, // north
    { box: { x0: -hx - WALL_T, x1: hx + WALL_T, y0: 0, y1: H, z0: hz, z1: hz + WALL_T }, cut: false }, // south
    { box: { x0: -hx - WALL_T, x1: -hx, y0: 0, y1: H, z0: -hz, z1: hz }, cut: false }, // west
    { box: { x0: hx, x1: hx + WALL_T, y0: 0, y1: H, z0: -hz, z1: hz }, cut: false }, // east
  ];
  const normals: [number, number, number][] = [[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
  walls.forEach((w, i) => {
    const facing = normals[i][0] * v[0] + normals[i][2] * v[2];
    w.cut = cutaway && facing > 0.15;
    if (w.cut) w.box = { ...w.box, y1: Math.min(w.box.y1, CUT_H) };
  });

  // Opening markers sit just inside their wall face.
  // Box spanning `w` along the wall, `y0..y1` up, centred at `nC` on the
  // wall-normal axis with thickness `t`. `along` is the wall run direction.
  const runBox = (along: "x" | "z", c: number, w: number, y0: number, y1: number, nC: number, t: number): Box3 =>
    along === "x"
      ? { x0: c - w / 2, x1: c + w / 2, y0, y1, z0: nC - t / 2, z1: nC + t / 2 }
      : { x0: nC - t / 2, x1: nC + t / 2, y0, y1, z0: c - w / 2, z1: c + w / 2 };

  type Part = { box: Box3; pal: Palette };
  // Panelled leaf + architrave, proportioned from the real 0.91 x 2.07 m
  // door scan in public/models/door.glb (frame, 4 recessed panels, handle).
  const doorParts = (along: "x" | "z", c: number, nW: number, inward: 1 | -1, wd: number, dh: number, wallH: number): Part[] => {
    const parts: Part[] = [];
    const leafW = wd - 0.1;
    const nLeaf = nW + inward * 0.018;
    const nFace = nW + inward * 0.0405; // leaf interior face
    parts.push({ box: runBox(along, c, wd, 0, dh, nW, 0.1), pal: RECESS_PAL });
    parts.push({ box: runBox(along, c, leafW, 0.03, dh - 0.03, nLeaf, 0.045), pal: LEAF_PAL });
    // Recessed panel moldings — two rows on a full door, one on a cut one.
    const m = 0.09;
    const pw = (leafW - 2 * m - 0.07) / 2;
    const rows: [number, number][] = dh >= 1.6 ? [[0.24, dh * 0.48], [dh * 0.56, dh - 0.18]] : [[0.22, dh - 0.16]];
    for (const [r0, r1] of rows)
      for (const px of [c - leafW / 2 + m + pw / 2, c + leafW / 2 - m - pw / 2])
        parts.push({ box: runBox(along, px, pw, r0, r1, nFace + inward * 0.007, 0.014), pal: PANEL_PAL });
    // Architrave: jambs + head proud of both wall faces.
    for (const jx of [c - wd / 2 - 0.035, c + wd / 2 + 0.035])
      parts.push({ box: runBox(along, jx, 0.07, 0, Math.min(dh + 0.04, wallH), nW, WALL_T + 0.03), pal: FRAME_PAL });
    if (dh + 0.06 <= wallH)
      parts.push({ box: runBox(along, c, wd + 0.14, dh, dh + 0.1, nW, WALL_T + 0.03), pal: FRAME_PAL });
    parts.push({ box: runBox(along, c, wd + 0.04, 0, 0.028, nW, 0.17), pal: SKIRT_PAL });
    // Lever handle on the leaf, lamp-cream knob as the accent.
    if (dh >= 1.2) {
      const hx = c + leafW / 2 - 0.11;
      parts.push({ box: runBox(along, hx, 0.032, 0.94, 1.1, nFace + inward * 0.008, 0.016), pal: FRAME_PAL });
      parts.push({ box: runBox(along, hx - 0.045, 0.075, 1.0, 1.045, nFace + inward * 0.035, 0.05), pal: SILL_PAL });
    }
    return parts;
  };

  // Framed 2x2 window with sill + apron, from public/models/window.glb.
  const windowParts = (along: "x" | "z", c: number, nW: number, inward: 1 | -1, wd: number, y0: number, y1: number): Part[] => {
    const parts: Part[] = [];
    const oh = y1 - y0;
    const rail = 0.07;
    const ix0 = c - wd / 2 + rail;
    const ix1 = c + wd / 2 - rail;
    const iy0 = y0 + rail;
    const iy1 = y1 - rail;
    const mulled = oh >= 0.5 && wd >= 0.5;
    if (mulled) {
      const mx = c;
      const my = (iy0 + iy1) / 2;
      for (const [gx0, gx1] of [[ix0, mx - 0.025], [mx + 0.025, ix1]])
        for (const [gy0, gy1] of [[iy0, my - 0.025], [my + 0.025, iy1]])
          parts.push({ box: runBox(along, (gx0 + gx1) / 2, gx1 - gx0, gy0, gy1, nW, 0.02), pal: GLASS_PAL });
      parts.push({ box: runBox(along, c, 0.05, iy0, iy1, nW, WALL_T + 0.02), pal: FRAME_PAL });
      parts.push({ box: runBox(along, c, ix1 - ix0, my - 0.025, my + 0.025, nW, WALL_T + 0.02), pal: FRAME_PAL });
    } else {
      parts.push({ box: runBox(along, c, ix1 - ix0, iy0, iy1, nW, 0.02), pal: GLASS_PAL });
    }
    for (const rx of [c - wd / 2 + rail / 2, c + wd / 2 - rail / 2])
      parts.push({ box: runBox(along, rx, rail, y0, y1, nW, WALL_T + 0.02), pal: FRAME_PAL });
    parts.push({ box: runBox(along, c, wd, y1 - rail, y1, nW, WALL_T + 0.02), pal: FRAME_PAL });
    parts.push({ box: runBox(along, c, wd, y0, y0 + rail, nW, WALL_T + 0.02), pal: FRAME_PAL });
    // Sill ledge (cream) + apron under it on the room side.
    parts.push({ box: runBox(along, c, wd + 0.16, y0 - 0.055, y0 - 0.005, nW + inward * 0.04, WALL_T + 0.12), pal: SILL_PAL });
    if (y0 - 0.125 >= 0.02)
      parts.push({ box: runBox(along, c, wd + 0.06, y0 - 0.125, y0 - 0.055, nW + inward * (WALL_T / 2 + 0.0125), 0.025), pal: FRAME_PAL });
    return parts;
  };

  const openingBoxes = openings.map((o) => {
    const { len, fixed } = wallFrame(room, o.wall, H);
    const wallH = walls[o.wall === "top" ? 0 : o.wall === "bottom" ? 1 : o.wall === "left" ? 2 : 3].box.y1;
    const centre = -len / 2 + o.offsetM + o.widthM / 2;
    const wd = o.widthM;
    const along: "x" | "z" = fixed.axis === "z" ? "x" : "z";
    // Wall centre on the normal axis + which way is "into the room".
    const nW = fixed.at + (fixed.at > 0 ? -WALL_T / 2 : WALL_T / 2);
    const inward: 1 | -1 = fixed.at > 0 ? -1 : 1;
    if (o.kind === "door") {
      const dh = Math.min(2.1, wallH);
      if (dh < 0.6) return null;
      return { o, parts: doorParts(along, centre, nW, inward, wd, dh, wallH) };
    }
    // window — band y 1.1–2.1, skipped on cut walls
    if (wallH < 1.7) return null;
    const y1 = Math.min(2.1, wallH);
    return { o, parts: windowParts(along, centre, nW, inward, wd, 1.1, y1) };
  });

  // Wall caps (finished top edge, follows cutaway) + interior skirting.
  const trim: Part[] = walls.map((w) => {
    const { x0, x1, z0, z1 } = w.box;
    const top = w.box.y1;
    const cap: Box3 = { x0: x0 - 0.025, x1: x1 + 0.025, y0: top, y1: top + 0.03, z0: z0 - 0.025, z1: z1 + 0.025 };
    return { box: cap, pal: CAP_PAL };
  });
  const skirt: Part[] = [
    { box: { x0: -hx, x1: hx, y0: 0, y1: 0.09, z0: -hz, z1: -hz + 0.018 }, pal: SKIRT_PAL },
    { box: { x0: -hx, x1: hx, y0: 0, y1: 0.09, z0: hz - 0.018, z1: hz }, pal: SKIRT_PAL },
    { box: { x0: -hx, x1: -hx + 0.018, y0: 0, y1: 0.09, z0: -hz, z1: hz }, pal: SKIRT_PAL },
    { box: { x0: hx - 0.018, x1: hx, y0: 0, y1: 0.09, z0: -hz, z1: hz }, pal: SKIRT_PAL },
  ];

  const sortedFixtures = [...fixtures].sort((a, b) => {
    const [, za] = rotY(a.cx, a.cz, th);
    const [, zb] = rotY(b.cx, b.cz, th);
    return za - zb;
  });

  // Fit: project the room bbox corners, frame them.
  const { proj } = useProjector(th, k);
  const corners: [number, number, number][] = [];
  for (const x of [-hx - WALL_T, hx + WALL_T])
    for (const y of [0, H])
      for (const z of [-hz - WALL_T, hz + WALL_T]) corners.push([x, y, z]);
  const px = corners.map(([x, y, z]) => proj(x, y, z));
  const minX = Math.min(...px.map((p) => p[0])) - 70;
  const maxX = Math.max(...px.map((p) => p[0])) + 70;
  const minY = Math.min(...px.map((p) => p[1])) - 50;
  const maxY = Math.max(...px.map((p) => p[1])) + 50;

  const gridLines: { a: [number, number, number]; b: [number, number, number] }[] = [];
  for (let gx = -hx; gx <= hx + 0.001; gx += 0.5)
    gridLines.push({ a: [Math.min(gx, hx), 0.005, -hz], b: [Math.min(gx, hx), 0.005, hz] });
  for (let gz = -hz; gz <= hz + 0.001; gz += 0.5)
    gridLines.push({ a: [-hx, 0.005, Math.min(gz, hz)], b: [hx, 0.005, Math.min(gz, hz)] });

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
        className="h-[360px] w-full select-none md:h-[560px]"
        style={{ cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, th };
          setSpin(false);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setTh(d.th + (e.clientX - d.x) * 0.008);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        role="img"
        aria-label="3D dollhouse view of the bathroom — drag to orbit, scroll to zoom"
      >
        {/* floor slab */}
        <polygon
          points={[proj(-hx, 0, -hz).join(","), proj(hx, 0, -hz).join(","), proj(hx, 0, hz).join(","), proj(-hx, 0, hz).join(",")].join(" ")}
          fill="#141414"
          stroke="#2c2c2c"
          strokeWidth={1}
        />
        {gridLines.map((g, i) => {
          const [ax, ay] = proj(...g.a);
          const [bx, by] = proj(...g.b);
          return <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke="#232323" strokeWidth={1} />;
        })}
        {/* tile inlay border, 0.15 m off the walls */}
        {(() => {
          const b = 0.15;
          const pts: [number, number, number][] = [
            [-hx + b, 0.006, -hz + b],
            [hx - b, 0.006, -hz + b],
            [hx - b, 0.006, hz - b],
            [-hx + b, 0.006, hz - b],
          ];
          return (
            <polygon
              points={pts.map(([x, y, z]) => proj(x, y, z).join(",")).join(" ")}
              fill="none"
              stroke="#333333"
              strokeWidth={1.5}
            />
          );
        })()}
        {/* walls (cut ones already shortened) + caps + skirting */}
        {walls.map((w, i) => (
          <Box key={`w${i}`} box={w.box} pal={WALL_PAL} th={th} k={k} />
        ))}
        {trim.map((t, i) => (
          <Box key={`cap${i}`} box={t.box} pal={t.pal} th={th} k={k} />
        ))}
        {skirt.map((t, i) => (
          <Box key={`sk${i}`} box={t.box} pal={t.pal} th={th} k={k} />
        ))}
        {/* doors + windows as detailed part assemblies */}
        {openingBoxes.map(
          (ob, i) =>
            ob && (
              <g key={i}>
                <title>{`${ob.o.kind} ${ob.o.widthM.toFixed(2)} m`}</title>
                {ob.parts.map((p, j) => (
                  <Box key={j} box={p.box} pal={p.pal} th={th} k={k} />
                ))}
              </g>
            )
        )}
        {/* fixtures, far → near */}
        {sortedFixtures.map((f) => {
          const y0 = f.y0 ?? 0;
          return (
          <g key={f.id}>
            {f.glass ? (
              <>
                <Box box={{ x0: f.cx - f.w / 2, x1: f.cx + f.w / 2, y0, y1: y0 + 0.1, z0: f.cz - f.d / 2, z1: f.cz + f.d / 2 }} pal={FIXTURE_PAL} th={th} k={k} />
                <Box box={{ x0: f.cx - f.w / 2, x1: f.cx + f.w / 2, y0: y0 + 0.1, y1: y0 + f.h, z0: f.cz - f.d / 2, z1: f.cz + f.d / 2 }} pal={GLASS_PAL} th={th} k={k} />
              </>
            ) : (
              <Box box={{ x0: f.cx - f.w / 2, x1: f.cx + f.w / 2, y0, y1: y0 + f.h, z0: f.cz - f.d / 2, z1: f.cz + f.d / 2 }} pal={FIXTURE_PAL} th={th} k={k} />
            )}
            {labels &&
              (() => {
                const [lx, ly] = proj(f.cx, y0 + f.h + 0.18, f.cz);
                return (
                  <text x={lx} y={ly} textAnchor="middle" fontSize={12} fill="#fff" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 4 }}>
                    {decorById(f.decorId)?.glyph ?? f.kind}
                  </text>
                );
              })()}
          </g>
          );
        })}
      </svg>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => setTh((p) => p - Math.PI / 4)} className="btn-ghost !px-3 !py-2 !text-[13px]">⟲ 45°</button>
        <button onClick={() => setTh((p) => p + Math.PI / 4)} className="btn-ghost !px-3 !py-2 !text-[13px]">45° ⟳</button>
        <button onClick={() => { setTh(Math.PI / 4); setK(90); }} className="btn-ghost !px-3 !py-2 !text-[13px]">Reset view</button>
        <button onClick={() => setCutaway((c) => !c)} className={cutaway ? "btn-cream !px-3 !py-2 !text-[13px]" : "btn-ghost !px-3 !py-2 !text-[13px]"}>
          Cutaway {cutaway ? "on" : "off"}
        </button>
        <button onClick={() => setLabels((l) => !l)} className={labels ? "btn-cream !px-3 !py-2 !text-[13px]" : "btn-ghost !px-3 !py-2 !text-[13px]"}>
          Labels {labels ? "on" : "off"}
        </button>
        <button onClick={() => setSpin((s) => !s)} className={spin ? "btn-cream !px-3 !py-2 !text-[13px]" : "btn-ghost !px-3 !py-2 !text-[13px]"}>
          Turntable {spin ? "on" : "off"}
        </button>
      </div>
      <p className="mt-3 text-[13px] text-[#999]">Drag to orbit · scroll to zoom · front walls drop to {CUT_H} m so you can see inside.</p>
    </div>
  );
}
