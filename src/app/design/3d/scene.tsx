"use client";
import { useEffect, useRef, useState } from "react";

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
  glass?: boolean;
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
const FIXTURE_PAL: Palette = { top: "#333333", front: "#202020", side: "#292929", edge: "#5a5a5a" };
const DOOR_PAL: Palette = { top: "#2a2a2a", front: "#050505", side: "#111111", edge: "#8a8a8a" };
const GLASS_PAL: Palette = { top: "#f5f5f0", front: "#f5f5f0", side: "#f5f5f0", edge: "#f5f5f0", opacity: 0.22 };
const CREAM_PAL: Palette = { top: "#f5f5f0", front: "#f5f5f0", side: "#d8d8d2", edge: "#f5f5f0", opacity: 0.85 };

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
  const openingBoxes = openings.map((o) => {
    const { len, fixed } = wallFrame(room, o.wall, H);
    const wallH = walls[o.wall === "top" ? 0 : o.wall === "bottom" ? 1 : o.wall === "left" ? 2 : 3].box.y1;
    const centre = -len / 2 + o.offsetM + o.widthM / 2;
    const wd = o.widthM;
    const inset = 0.04;
    if (o.kind === "door") {
      const dh = Math.min(2.1, wallH);
      if (dh < 0.6) return null;
      const box: Box3 =
        fixed.axis === "z"
          ? { x0: centre - wd / 2, x1: centre + wd / 2, y0: 0, y1: dh, z0: fixed.at - (fixed.at > 0 ? inset + 0.06 : 0), z1: fixed.at + (fixed.at > 0 ? 0 : inset + 0.06) }
          : { x0: fixed.at - (fixed.at > 0 ? inset + 0.06 : 0), x1: fixed.at + (fixed.at > 0 ? 0 : inset + 0.06), y0: 0, y1: dh, z0: centre - wd / 2, z1: centre + wd / 2 };
      return { o, box, pal: DOOR_PAL, sill: true };
    }
    // window — band y 1.1–2.1, skipped on cut walls
    if (wallH < 1.7) return null;
    const box: Box3 =
      fixed.axis === "z"
        ? { x0: centre - wd / 2, x1: centre + wd / 2, y0: 1.1, y1: Math.min(2.1, wallH), z0: fixed.at - (fixed.at > 0 ? inset + 0.05 : 0), z1: fixed.at + (fixed.at > 0 ? 0 : inset + 0.05) }
        : { x0: fixed.at - (fixed.at > 0 ? inset + 0.05 : 0), x1: fixed.at + (fixed.at > 0 ? 0 : inset + 0.05), y0: 1.1, y1: Math.min(2.1, wallH), z0: centre - wd / 2, z1: centre + wd / 2 };
    return { o, box, pal: CREAM_PAL, sill: false };
  });

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
        className="w-full select-none"
        style={{ height: 560, cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}
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
        {/* walls (cut ones already shortened) */}
        {walls.map((w, i) => (
          <Box key={i} box={w.box} pal={WALL_PAL} th={th} k={k} />
        ))}
        {/* doors + windows */}
        {openingBoxes.map(
          (ob, i) =>
            ob && (
              <g key={i}>
                <Box box={ob.box} pal={ob.pal} th={th} k={k} />
                {ob.sill &&
                  (() => {
                    const [sx, sy] = proj((ob.box.x0 + ob.box.x1) / 2, 0.05, (ob.box.z0 + ob.box.z1) / 2);
                    return (
                      <circle cx={sx} cy={sy} r={3} fill="#f5f5f0" opacity={0.9}>
                        <title>{`${ob.o.kind} ${ob.o.widthM.toFixed(2)} m`}</title>
                      </circle>
                    );
                  })()}
              </g>
            )
        )}
        {/* fixtures, far → near */}
        {sortedFixtures.map((f) => (
          <g key={f.id}>
            {f.glass ? (
              <>
                <Box box={{ x0: f.cx - f.w / 2, x1: f.cx + f.w / 2, y0: 0, y1: 0.1, z0: f.cz - f.d / 2, z1: f.cz + f.d / 2 }} pal={FIXTURE_PAL} th={th} k={k} />
                <Box box={{ x0: f.cx - f.w / 2, x1: f.cx + f.w / 2, y0: 0.1, y1: f.h, z0: f.cz - f.d / 2, z1: f.cz + f.d / 2 }} pal={GLASS_PAL} th={th} k={k} />
              </>
            ) : (
              <Box box={{ x0: f.cx - f.w / 2, x1: f.cx + f.w / 2, y0: 0, y1: f.h, z0: f.cz - f.d / 2, z1: f.cz + f.d / 2 }} pal={FIXTURE_PAL} th={th} k={k} />
            )}
            {labels &&
              (() => {
                const [lx, ly] = proj(f.cx, f.h + 0.18, f.cz);
                return (
                  <text x={lx} y={ly} textAnchor="middle" fontSize={12} fill="#fff" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 4 }}>
                    {f.kind}
                  </text>
                );
              })()}
          </g>
        ))}
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
