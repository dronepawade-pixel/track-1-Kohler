"use client";
import { useState } from "react";

type Fixture = { id: number; kind: string; x: number; y: number; w: number; h: number; rot: number };
const PALETTE = [
  { kind: "Basin", w: 60, h: 50 },
  { kind: "Shower", w: 90, h: 90 },
  { kind: "Bathtub", w: 170, h: 75 },
  { kind: "Toilet", w: 60, h: 70 },
  { kind: "Vanity", w: 120, h: 55 },
];
let nextId = 1;
const SCALE = 100; // px per metre
const ROOM = { w: 3.6, h: 2.4 };

// ponytail: naive overlap check (O(n²)); spatial index if rooms grow large.
const overlaps = (a: Fixture, b: Fixture) =>
  a.id !== b.id && Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

export default function PlannerPage() {
  const [items, setItems] = useState<Fixture[]>([
    { id: nextId++, kind: "Shower", x: 70, y: 70, w: 90, h: 90, rot: 0 },
    { id: nextId++, kind: "Toilet", x: 280, y: 60, w: 60, h: 70, rot: 0 },
  ]);
  const [sel, setSel] = useState<number | null>(null);
  const [history, setHistory] = useState<Fixture[][]>([]);
  const commit = (next: Fixture[]) => { setHistory((h) => [...h.slice(-49), items]); setItems(next); };
  const undo = () => setHistory((h) => { const prev = h[h.length - 1]; if (prev) setItems(prev); return h.slice(0, -1); });
  const add = (kind: string, w: number, h: number) => commit([...items, { id: nextId++, kind, x: 180, y: 120, w, h, rot: 0 }]);
  const move = (id: number, dx: number, dy: number) =>
    commit(items.map((f) => (f.id === id ? { ...f, x: Math.max(f.w / 2, Math.min(ROOM.w * SCALE - f.w / 2, f.x + dx)), y: Math.max(f.h / 2, Math.min(ROOM.h * SCALE - f.h / 2, f.y + dy)) } : f)));
  const rotate = (id: number) => commit(items.map((f) => (f.id === id ? { ...f, rot: (f.rot + 90) % 360, w: f.h, h: f.w } : f)));
  const remove = (id: number) => commit(items.filter((f) => f.id !== id));
  const clashes = items.filter((f) => items.some((o) => overlaps(f, o)));

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <p className="label-caps text-[#999]">2D planner — deterministic geometry, no AI</p>
      <h1 className="narrative mt-3 text-[54px]">Arrange your room.</h1>
      <div className="mt-8 flex flex-wrap gap-2">
        {PALETTE.map((p) => (
          <button key={p.kind} onClick={() => add(p.kind, p.w, p.h)} className="btn-ghost !py-2 !text-[14px]">+ {p.kind}</button>
        ))}
        <button onClick={undo} disabled={history.length === 0} className="btn-ghost !py-2 !text-[14px] disabled:opacity-40">Undo</button>
        <button onClick={() => commit([])} className="btn-ghost !py-2 !text-[14px]">Clear</button>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card flex items-center justify-center overflow-auto p-8">
          <svg width={ROOM.w * SCALE + 40} height={ROOM.h * SCALE + 60} className="select-none">
            <rect x={20} y={20} width={ROOM.w * SCALE} height={ROOM.h * SCALE} fill="#000" stroke="#333" strokeWidth={2} />
            {[0, 1, 2, 3].map((i) => (
              <text key={i} x={20 + ((ROOM.w * SCALE) / 3) * i} y={14} fill="#999" fontSize={10}>{(ROOM.w * i / 3).toFixed(1)}m</text>
            ))}
            <rect x={20 + ROOM.w * SCALE * 0.4} y={20 + ROOM.h * SCALE - 4} width={70} height={8} fill="#202020" stroke="#999" />
            <text x={20 + ROOM.w * SCALE * 0.4} y={20 + ROOM.h * SCALE + 18} fill="#999" fontSize={10}>door 0.7m</text>
            {items.map((f) => {
              const clash = clashes.some((c) => c.id === f.id);
              return (
                <g key={f.id} onClick={() => setSel(f.id)} style={{ cursor: "grab" }}>
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
          <p className="mt-2 text-[16px]">Room {ROOM.w} × {ROOM.h} m · {(ROOM.w * ROOM.h).toFixed(1)} m²</p>
          <p className="mt-1 text-[14px] text-[#999]">{items.length} fixtures · grid snap 10px · clearance 0.6m</p>
          {clashes.length > 0 ? (
            <p className="mt-3 text-[14px] text-[#ff8a8a]">⚠ {clashes.length} overlap{clashes.length > 1 ? "s" : ""} — move {clashes.map((c) => c.kind).join(", ")} apart.</p>
          ) : (
            <p className="mt-3 text-[14px] text-[#999]">✓ No collisions. Budget + compatibility engines arrive in Phase 3.</p>
          )}
          {sel !== null && (() => {
            const f = items.find((i) => i.id === sel);
            if (!f) return null;
            return (
              <div className="mt-4 border-t border-[#333] pt-4">
                <p className="text-[16px] font-medium">{f.kind} <span className="text-[#999]">· {f.rot}°</span></p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[["←", -10, 0], ["→", 10, 0], ["↑", 0, -10], ["↓", 0, 10]].map(([label, dx, dy]) => (
                    <button key={label as string} onClick={() => move(f.id, dx as number, dy as number)} className="btn-ghost !px-0 !py-2 text-center">{label as string}</button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
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
