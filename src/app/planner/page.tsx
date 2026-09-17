"use client";
import { Suspense, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Fixture = { id: number; kind: string; x: number; y: number; w: number; h: number; rot: number };
type RoomSpec = { w: number; h: number; height: number; doors: number; windows: number };
const BASE_SCALE = 150; // px per metre at 1:1
const MAX_W = 680; // stage fit bounds — larger rooms shrink ratio-wise, never overflow
const MAX_H = 600;
const SNAP = 10;
const DEFAULT_ROOM: RoomSpec = { w: 3.6, h: 2.4, height: 2.7, doors: 1, windows: 1 };
// Fixture footprints in real metres — always proportional to the room.
const PALETTE_M = [
  { kind: "Basin", w: 0.6, h: 0.5 },
  { kind: "Shower", w: 0.9, h: 0.9 },
  { kind: "Bathtub", w: 1.7, h: 0.75 },
  { kind: "Toilet", w: 0.6, h: 0.7 },
  { kind: "Vanity", w: 1.2, h: 0.55 },
];
let nextId = 1;

// ponytail: naive overlap check (O(n²)); spatial index if rooms grow large.
const overlaps = (a: Fixture, b: Fixture) =>
  a.id !== b.id && Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

const clampPos = (room: RoomSpec, s: number, f: Fixture, x: number, y: number) => ({
  x: Math.max(f.w / 2, Math.min(room.w * s - f.w / 2, x)),
  y: Math.max(f.h / 2, Math.min(room.h * s - f.h / 2, y)),
});

const num = (v: string | null, fb: number, lo: number, hi: number) => {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb;
};

function PlannerInner() {
  const params = useSearchParams();
  // Room geometry comes from /design/new — editing dimensions there reshapes this canvas.
  const room: RoomSpec = useMemo(
    () => ({
      w: num(params.get("length"), DEFAULT_ROOM.w, 1.2, 12),
      h: num(params.get("width"), DEFAULT_ROOM.h, 1.2, 12),
      height: num(params.get("height"), DEFAULT_ROOM.height, 2, 5),
      doors: Math.round(num(params.get("doors"), DEFAULT_ROOM.doors, 0, 6)),
      windows: Math.round(num(params.get("windows"), DEFAULT_ROOM.windows, 0, 6)),
    }),
    [params]
  );
  // Display scale: full 150px/m while the room fits; shrink ratio-wise only when it wouldn't.
  // Fixtures derive from the same scale, so proportions never distort.
  const s = useMemo(
    () => Math.min(BASE_SCALE, MAX_W / room.w, MAX_H / room.h),
    [room.w, room.h]
  );
  const px = (m: number) => Math.round(m * s);
  const [items, setItems] = useState<Fixture[]>([
    { id: nextId++, kind: "Shower", x: room.w * s * 0.25, y: room.h * s * 0.3, w: px(0.9), h: px(0.9), rot: 0 },
    { id: nextId++, kind: "Toilet", x: room.w * s * 0.75, y: room.h * s * 0.28, w: px(0.6), h: px(0.7), rot: 0 },
  ]);
  const [sel, setSel] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [history, setHistory] = useState<Fixture[][]>([]);
  const dragRef = useRef<{ id: number; startX: number; startY: number; orig: Fixture[]; moved: boolean } | null>(null);

  const commit = (next: Fixture[]) => { setHistory((h) => [...h.slice(-49), items]); setItems(next); };
  const undo = () => setHistory((h) => { const prev = h[h.length - 1]; if (prev) setItems(prev); return h.slice(0, -1); });
  const add = (kind: string, wm: number, hm: number) =>
    commit([...items, { id: nextId++, kind, x: (room.w * s) / 2, y: (room.h * s) / 2, w: px(wm), h: px(hm), rot: 0 }]);
  const rotate = (id: number) => commit(items.map((f) => (f.id === id ? { ...f, rot: (f.rot + 90) % 360, w: f.h, h: f.w } : f)));
  const remove = (id: number) => commit(items.filter((f) => f.id !== id));
  const clashes = items.filter((f) => items.some((o) => overlaps(f, o)));

  const onFixturePointerDown = (e: React.PointerEvent<SVGGElement>, id: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setSel(id);
    setDragId(id);
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, orig: items, moved: false };
  };
  const onCanvasPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    d.moved = true;
    const base = d.orig.find((f) => f.id === d.id);
    if (!base) return;
    const p = clampPos(room, s, base, base.x + dx, base.y + dy);
    setItems(d.orig.map((f) => (f.id === d.id ? { ...f, ...p } : f)));
  };
  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragId(null);
    if (!d || !d.moved) return;
    const snap = (v: number) => Math.round(v / SNAP) * SNAP;
    setHistory((h) => [...h.slice(-49), d.orig]);
    setItems((prev) =>
      prev.map((f) => {
        if (f.id !== d.id) return f;
        const p = clampPos(room, s, f, snap(f.x), snap(f.y));
        return { ...f, ...p };
      })
    );
  };

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <p className="label-caps text-[#999]">2D planner — deterministic geometry, no AI</p>
      <h1 className="narrative mt-3 text-[54px]">Arrange your room.</h1>
      <div className="mt-8 flex flex-wrap gap-2">
        {PALETTE_M.map((p) => (
          <button key={p.kind} onClick={() => add(p.kind, p.w, p.h)} className="btn-ghost !py-2 !text-[14px]">+ {p.kind}</button>
        ))}
        <button onClick={undo} disabled={history.length === 0} className="btn-ghost !py-2 !text-[14px] disabled:opacity-40">Undo</button>
        <button onClick={() => commit([])} className="btn-ghost !py-2 !text-[14px]">Clear</button>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card flex min-h-[520px] items-center justify-center overflow-auto p-8">
          <svg
            width={room.w * s + 40}
            height={room.h * s + 60}
            className="select-none"
            onPointerMove={onCanvasPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <rect x={20} y={20} width={room.w * s} height={room.h * s} fill="#000" stroke="#333" strokeWidth={2} />
            {[0, 1, 2, 3].map((i) => (
              <text key={i} x={20 + ((room.w * s) / 3) * i} y={14} fill="#999" fontSize={10}>{(room.w * i / 3).toFixed(1)}m</text>
            ))}
            {Array.from({ length: room.doors }).map((_, i) => {
              const cx = 20 + ((i + 1) / (room.doors + 1)) * (room.w * s);
              return (
                <g key={`door-${i}`}>
                  <rect x={cx - 35} y={20 + room.h * s - 4} width={70} height={8} fill="#202020" stroke="#999" />
                  <text x={cx - 35} y={20 + room.h * s + 18} fill="#999" fontSize={10}>door 0.7m</text>
                </g>
              );
            })}
            {Array.from({ length: room.windows }).map((_, i) => {
              const cx = 20 + ((i + 1) / (room.windows + 1)) * (room.w * s);
              return (
                <g key={`win-${i}`}>
                  <rect x={cx - 25} y={16} width={50} height={8} fill="#333" stroke="#999" />
                  <text x={cx - 25} y={44} fill="#999" fontSize={10}>window</text>
                </g>
              );
            })}
            {items.map((f) => {
              const clash = clashes.some((c) => c.id === f.id);
              return (
                <g
                  key={f.id}
                  onClick={() => setSel(f.id)}
                  onPointerDown={(e) => onFixturePointerDown(e, f.id)}
                  style={{ cursor: dragId === f.id ? "grabbing" : "grab", touchAction: "none" }}
                >
                  <rect x={20 + f.x - f.w / 2} y={20 + f.y - f.h / 2} width={f.w} height={f.h} rx={6}
                    fill={sel === f.id ? "#f5f5f0" : "#202020"} stroke={clash ? "#ff5c5c" : "#999"} strokeWidth={clash ? 2 : 1} />
                  <text x={20 + f.x} y={20 + f.y + 4} textAnchor="middle" fontSize={11} fill={sel === f.id ? "#000" : "#fff"}>{f.kind}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <aside className="card h-fit p-6">
          <p className="label-caps text-[#999]">Measurements & constraints</p>
          <p className="mt-2 text-[16px]">Room {room.w} × {room.h} m · {(room.w * room.h).toFixed(1)} m²</p>
          <p className="mt-1 text-[14px] text-[#999]">
            Height {room.height} m · {room.doors} door{room.doors === 1 ? "" : "s"} · {room.windows} window{room.windows === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-[14px] text-[#999]">
            {items.length} fixtures · drag to move · grid snap {SNAP}px · clearance 0.6m{s < BASE_SCALE ? ` · view fit ${Math.round(s)}px/m` : ""}
          </p>
          {clashes.length > 0 ? (
            <p className="mt-3 text-[14px] text-[#ff8a8a]">⚠ {clashes.length} overlap{clashes.length > 1 ? "s" : ""} — drag {clashes.map((c) => c.kind).join(", ")} apart.</p>
          ) : (
            <p className="mt-3 text-[14px] text-[#999]">✓ No collisions. Budget + compatibility engines arrive in Phase 3.</p>
          )}
          {sel !== null && (() => {
            const f = items.find((i) => i.id === sel);
            if (!f) return null;
            return (
              <div className="mt-4 border-t border-[#333] pt-4">
                <p className="text-[16px] font-medium">{f.kind} <span className="text-[#999]">· {f.rot}°</span></p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => rotate(f.id)} className="btn-ghost flex-1 !py-2 !text-[14px]">Rotate 90°</button>
                  <button onClick={() => { remove(f.id); setSel(null); }} className="btn-ghost flex-1 !py-2 !text-[14px]">Remove</button>
                </div>
              </div>
            );
          })()}
        </aside>
      </div>
    </section>
  );
}

export default function PlannerPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-[1200px] px-6 py-16"><p className="text-[16px] text-[#999]">Loading planner…</p></section>}>
      <PlannerInner />
    </Suspense>
  );
}
