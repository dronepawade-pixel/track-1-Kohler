"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { getDesign, uid, upsertDesign, sanitizeDesign, type SavedDesign, type SavedBrief } from "@/lib/designs";
import { DECOR_OPTIONS, decorById } from "@/lib/decor";
import { budgetById } from "@/lib/budget";

type Fixture = { id: number; kind: string; x: number; y: number; w: number; h: number; rot: number; model?: string; decorId?: string };
type RoomSpec = { w: number; h: number; height: number; doors: number; windows: number };
type Wall = "top" | "bottom" | "left" | "right";
type Opening = { id: number; kind: "door" | "window"; wall: Wall; offsetM: number; widthM: number };
type Snapshot = { items: Fixture[]; openings: Opening[] };
const BASE_SCALE = 150; // px per metre at 1:1
const MAX_W = 680; // stage fit bounds — larger rooms shrink ratio-wise, never overflow
const MAX_H = 600;
const SNAP = 10;
const DEFAULT_ROOM: RoomSpec = { w: 3.6, h: 2.4, height: 2.7, doors: 1, windows: 1 };
const DEFAULT_DOOR_M = 0.9;
const DEFAULT_WINDOW_M = 1.2;
const MIN_OPENING_M = 0.3;
const OPENING_STEP_M = 0.05;
// Fixture footprints in real metres — always proportional to the room.
const PALETTE_M = [
  { kind: "Basin", w: 0.6, h: 0.5 },
  { kind: "Shower", w: 0.9, h: 0.9 },
  { kind: "Bathtub", w: 1.7, h: 0.75 },
  { kind: "Toilet", w: 0.6, h: 0.7 },
];
const WALLS: { id: Wall; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "right", label: "Right" },
  { id: "bottom", label: "Bottom" },
  { id: "left", label: "Left" },
];
let nextId = 1;
let nextOpeningId = 1;

// ponytail: naive overlap check (O(n²)); spatial index if rooms grow large.
const overlaps = (a: Fixture, b: Fixture) =>
  a.id !== b.id && Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

const clampPos = (room: RoomSpec, s: number, f: Fixture, x: number, y: number) => ({
  x: Math.max(f.w / 2, Math.min(room.w * s - f.w / 2, x)),
  y: Math.max(f.h / 2, Math.min(room.h * s - f.h / 2, y)),
});

const num = (v: string | null | undefined, fb: number, lo: number, hi: number) => {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb;
};

const wallLen = (room: RoomSpec, wall: Wall) => (wall === "top" || wall === "bottom" ? room.w : room.h);

const clampOpening = (room: RoomSpec, o: Opening): Opening => {
  const len = wallLen(room, o.wall);
  const widthM = Math.min(Math.max(o.widthM, MIN_OPENING_M), len);
  const offsetM = Math.min(Math.max(o.offsetM, 0), Math.max(0, len - widthM));
  return { ...o, widthM: Math.round(widthM * 100) / 100, offsetM: Math.round(offsetM * 100) / 100 };
};

const spreadOpenings = (room: RoomSpec, kind: "door" | "window", count: number, wall: Wall, widthM: number): Opening[] =>
  Array.from({ length: count }).map((_, i) => {
    const len = wallLen(room, wall);
    const w = Math.min(widthM, len);
    const centre = ((i + 1) / (count + 1)) * len;
    const offsetM = Math.min(Math.max(centre - w / 2, 0), Math.max(0, len - w));
    return { id: nextOpeningId++, kind, wall, offsetM: Math.round(offsetM * 100) / 100, widthM: Math.round(w * 100) / 100 };
  });

function PlannerInner() {
  const params = useSearchParams();
  const designId = params?.get("design");
  // Opening a saved design (?design=id) restores its room, fixtures and openings.
  // Loaded in an effect (never during render): localStorage doesn't exist on the
  // server, so reading it during render hydrates different HTML (client vs server).
  const [stored, setStored] = useState<SavedDesign | null>(null);
  useEffect(() => {
    if (!designId) return;
    const raw = getDesign(designId);
    setStored(raw ? sanitizeDesign(raw) : null);
  }, [designId]);
  // Room geometry comes from /design/new — editing dimensions there reshapes this canvas.
  const room: RoomSpec = useMemo(
    () =>
      stored?.room ?? {
        w: num(params?.get("length"), DEFAULT_ROOM.w, 1.2, 12),
        h: num(params?.get("width"), DEFAULT_ROOM.h, 1.2, 12),
        height: num(params?.get("height"), DEFAULT_ROOM.height, 2, 5),
        doors: Math.round(num(params?.get("doors"), DEFAULT_ROOM.doors, 0, 6)),
        windows: Math.round(num(params?.get("windows"), DEFAULT_ROOM.windows, 0, 6)),
      },
    [params, stored]
  );
  // Display scale: full 150px/m while the room fits; shrink ratio-wise only when it wouldn't.
  // Fixtures derive from the same scale, so proportions never distort.
  const s = useMemo(
    () => Math.min(BASE_SCALE, MAX_W / room.w, MAX_H / room.h),
    [room.w, room.h]
  );
  const px = (m: number) => Math.round(m * s);
  const [items, setItems] = useState<Fixture[]>(() => [
    { id: nextId++, kind: "Shower", x: room.w * s * 0.25, y: room.h * s * 0.3, w: px(0.9), h: px(0.9), rot: 0 },
    { id: nextId++, kind: "Toilet", x: room.w * s * 0.75, y: room.h * s * 0.28, w: px(0.6), h: px(0.7), rot: 0 },
  ]);
  // Openings (doors/windows) are first-class canvas objects: drag along their wall,
  // switch wall, and resize — all in real metres, clamped to the wall length.
  const [openings, setOpenings] = useState<Opening[]>(() => [
    ...spreadOpenings(room, "door", room.doors, "bottom", DEFAULT_DOOR_M),
    ...spreadOpenings(room, "window", room.windows, "top", DEFAULT_WINDOW_M),
  ]);
  // Apply a loaded design once (see stored above): replaces the defaults above.
  const appliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!stored || appliedRef.current === (designId ?? "")) return;
    appliedRef.current = designId ?? "";
    if (stored.items.length > 0) nextId = Math.max(nextId, Math.max(...stored.items.map((f) => f.id)) + 1);
    setItems(stored.items.map((f) => ({ ...f })));
    if (stored.openings.length > 0)
      nextOpeningId = Math.max(nextOpeningId, Math.max(...stored.openings.map((o) => o.id)) + 1);
    setOpenings(stored.openings.map((o) => ({ ...o })));
    setDesignName(stored.title);
  }, [stored, designId]);
  const [sel, setSel] = useState<number | null>(null);
  const [selOpening, setSelOpening] = useState<number | null>(null);
  const [showDecor, setShowDecor] = useState(true);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOpeningId, setDragOpeningId] = useState<number | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const dragRef = useRef<{ id: number; startX: number; startY: number; orig: Fixture[]; moved: boolean } | null>(null);
  const dragOpeningRef = useRef<{ id: number; startX: number; startY: number; orig: Opening[]; moved: boolean } | null>(null);
  const sliderBase = useRef<Snapshot | null>(null);

  const commitItems = (next: Fixture[]) => { setHistory((h) => [...h.slice(-49), { items, openings }]); setItems(next); };
  const commitOpenings = (next: Opening[]) => { setHistory((h) => [...h.slice(-49), { items, openings }]); setOpenings(next); };
  const undo = () => setHistory((h) => { const prev = h[h.length - 1]; if (prev) { setItems(prev.items); setOpenings(prev.openings); } return h.slice(0, -1); });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);
  const add = (kind: string, wm: number, hm: number) =>
    commitItems([...items, { id: nextId++, kind, x: (room.w * s) / 2, y: (room.h * s) / 2, w: px(wm), h: px(hm), rot: 0 }]);
  // Decor: free placement, sits on the top layer, never clashes, never costed.
  const addDecor = (decorId: string) => {
    const d = decorById(decorId);
    if (!d) return;
    commitItems([...items, { id: nextId++, kind: "Decor", decorId: d.id, x: (room.w * s) / 2, y: (room.h * s) / 2, w: px(d.w), h: px(d.h), rot: 0 }]);
  };
  const rotate = (id: number) => commitItems(items.map((f) => (f.id === id ? { ...f, rot: (f.rot + 90) % 360, w: f.h, h: f.w } : f)));
  const remove = (id: number) => commitItems(items.filter((f) => f.id !== id));
  const clearAll = () => {
    if (items.length === 0 && openings.length === 0) return;
    if (!window.confirm("Clear the canvas? All fixtures, decor and openings are removed. Saved designs are untouched.")) return;
    setHistory((h) => [...h.slice(-49), { items, openings }]);
    setItems([]);
    setOpenings([]);
    setSel(null);
    setSelOpening(null);
  };

  const addOpening = (kind: "door" | "window") => {
    const wall: Wall = kind === "door" ? "bottom" : "top";
    const len = wallLen(room, wall);
    const widthM = Math.min(kind === "door" ? DEFAULT_DOOR_M : DEFAULT_WINDOW_M, len);
    const o: Opening = { id: nextOpeningId++, kind, wall, offsetM: Math.max(0, len / 2 - widthM / 2), widthM };
    commitOpenings([...openings, clampOpening(room, o)]);
    setSelOpening(o.id);
    setSel(null);
  };
  const updateOpening = (id: number, patch: Partial<Opening>) =>
    commitOpenings(openings.map((o) => (o.id === id ? clampOpening(room, { ...o, ...patch }) : o)));
  const removeOpening = (id: number) => {
    commitOpenings(openings.filter((o) => o.id !== id));
    setSelOpening(null);
  };
  // Design library — snapshot room + fixtures + openings into localStorage.
  const [activeId, setActiveId] = useState<string | null>(designId);
  const [designName, setDesignName] = useState(stored?.title ?? "");
  const [savedTick, setSavedTick] = useState<string | null>(null);
  const router = useRouter();
  // Step-1 brief (budget + style + notes) rides in from /design/new query
  // params. Carried onto every save so the 3D view's AI matcher can pick
  // tag-matched variants; saved designs keep their brief when re-opened.
  const brief: SavedBrief | null = useMemo(() => {
    if (stored?.brief) return stored.brief;
    const budgetId = params?.get("budgetId");
    const style = params?.get("style");
    const notes = params?.get("notes");
    if (!budgetId && !style && !notes) return null;
    return { budgetId: budgetId || "comfort", style: style ?? "", notes: notes ?? "" };
  }, [params, stored]);
  const persist = (): string => {
    const id = activeId ?? uid();
    const now = new Date().toISOString();
    const prev = activeId ? getDesign(activeId) : null;
    const title = designName.trim() || prev?.title || `Bathroom ${room.w} × ${room.h} m`;
    upsertDesign({
      id,
      title,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      room: { ...room },
      items: items.map((f) => ({ ...f })),
      openings: openings.map((o) => ({ ...o })),
      ...(brief ? { brief } : prev?.brief ? { brief: prev.brief } : {}),
    });
    setActiveId(id);
    if (!designName.trim()) setDesignName(title);
    return id;
  };
  const saveDesign = () => {
    persist();
    setSavedTick(new Date().toLocaleTimeString());
  };
  const viewIn3D = () => {
    router.push(`/design/3d?design=${encodeURIComponent(persist())}`);
  };
  // Range sliders update live (no history spam); one undo step is recorded per interaction.
  const beginSlider = () => { sliderBase.current = { items, openings }; };
  const endSlider = () => {
    const b = sliderBase.current;
    sliderBase.current = null;
    if (b && JSON.stringify(b.openings) !== JSON.stringify(openings))
      setHistory((h) => [...h.slice(-49), b]);
  };

  // Decor never clashes: clash checks run fixture-vs-fixture only, so decor
  // can sit on top of basins, tubs and floors without warnings.
  const clashes = items.filter((f) => !f.decorId && items.some((o) => !o.decorId && overlaps(f, o)));
  const fixtureCount = items.filter((f) => !f.decorId).length;
  const decorCount = items.filter((f) => f.decorId).length;
  const doorCount = openings.filter((o) => o.kind === "door").length;
  const windowCount = openings.filter((o) => o.kind === "window").length;
  const activeOpening = selOpening !== null ? openings.find((o) => o.id === selOpening) ?? null : null;

  const onFixturePointerDown = (e: React.PointerEvent<SVGGElement>, id: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setSel(id);
    setSelOpening(null);
    setDragId(id);
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, orig: items, moved: false };
  };
  const onOpeningPointerDown = (e: React.PointerEvent<SVGGElement>, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setSelOpening(id);
    setSel(null);
    setDragOpeningId(id);
    dragOpeningRef.current = { id, startX: e.clientX, startY: e.clientY, orig: openings, moved: false };
  };
  const onCanvasPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (d) {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      d.moved = true;
      const base = d.orig.find((f) => f.id === d.id);
      if (!base) return;
      const p = clampPos(room, s, base, base.x + dx, base.y + dy);
      setItems(d.orig.map((f) => (f.id === d.id ? { ...f, ...p } : f)));
      return;
    }
    const od = dragOpeningRef.current;
    if (od) {
      const dx = e.clientX - od.startX;
      const dy = e.clientY - od.startY;
      if (!od.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      od.moved = true;
      const base = od.orig.find((o) => o.id === od.id);
      if (!base) return;
      const horizontal = base.wall === "top" || base.wall === "bottom";
      const deltaM = horizontal ? dx / s : dy / s;
      setOpenings(od.orig.map((o) => (o.id === od.id ? clampOpening(room, { ...o, offsetM: base.offsetM + deltaM }) : o)));
    }
  };
  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragId(null);
    if (d?.moved) {
      const snap = (v: number) => Math.round(v / SNAP) * SNAP;
      setHistory((h) => [...h.slice(-49), { items: d.orig, openings }]);
      setItems((prev) =>
        prev.map((f) => {
          if (f.id !== d.id) return f;
          const p = clampPos(room, s, f, snap(f.x), snap(f.y));
          return { ...f, ...p };
        })
      );
    }
    const od = dragOpeningRef.current;
    dragOpeningRef.current = null;
    setDragOpeningId(null);
    if (od?.moved) {
      const snapM = (m: number) => Math.round((m * s) / SNAP) * SNAP / s;
      setHistory((h) => [...h.slice(-49), { items, openings: od.orig }]);
      setOpenings((prev) =>
        prev.map((o) => (o.id === od.id ? clampOpening(room, { ...o, offsetM: snapM(o.offsetM) }) : o))
      );
    }
  };

  // Opening rect geometry per wall (room rect lives at 20,20).
  const openingRect = (o: Opening) => {
    const W = room.w * s;
    const H = room.h * s;
    const lenPx = o.widthM * s;
    const offPx = o.offsetM * s;
    if (o.wall === "top") return { x: 20 + offPx, y: 16, w: lenPx, h: 8 };
    if (o.wall === "bottom") return { x: 20 + offPx, y: 20 + H - 4, w: lenPx, h: 8 };
    if (o.wall === "left") return { x: 16, y: 20 + offPx, w: 8, h: lenPx };
    return { x: 20 + W - 4, y: 20 + offPx, w: 8, h: lenPx };
  };
  const openingLabelPos = (o: Opening) => {
    const r = openingRect(o);
    if (o.wall === "top") return { x: r.x, y: r.y + 28, anchor: "start" as const };
    if (o.wall === "bottom") return { x: r.x, y: r.y + 22, anchor: "start" as const };
    return { x: r.x + 14, y: r.y + 10, anchor: "start" as const };
  };

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-10">
      <p className="label-caps text-[#999]">2D planner — deterministic geometry · AI matching runs in the 3D view</p>
      <h1 className="narrative mt-2 text-[clamp(36px,9vw,54px)]">Arrange your room.</h1>
      <div className="mt-5 flex flex-wrap gap-2">
        {PALETTE_M.map((p) => (
          <button key={p.kind} onClick={() => add(p.kind, p.w, p.h)} className="btn-ghost !py-2 !text-[14px]">+ {p.kind}</button>
        ))}
        <button onClick={() => addOpening("door")} className="btn-ghost !py-2 !text-[14px]">+ Door</button>
        <button onClick={() => addOpening("window")} className="btn-ghost !py-2 !text-[14px]">+ Window</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="label-caps text-[#999]">Decor — free placement, sits on top, not costed</span>
        {DECOR_OPTIONS.map((d) => (
          <button key={d.id} onClick={() => addDecor(d.id)} className="btn-ghost !py-2 !text-[14px]">+ {d.label}</button>
        ))}
        <button onClick={() => setShowDecor((v) => !v)} className="btn-ghost !py-2 !text-[14px]">
          Decor {showDecor ? "shown" : "hidden"}
        </button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card flex min-h-[440px] items-center justify-center overflow-auto p-4">
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
            {openings.map((o) => {
              const r = openingRect(o);
              const lp = openingLabelPos(o);
              const active = selOpening === o.id;
              return (
                <g
                  key={`opening-${o.id}`}
                  onClick={() => { setSelOpening(o.id); setSel(null); }}
                  onPointerDown={(e) => onOpeningPointerDown(e, o.id)}
                  style={{ cursor: dragOpeningId === o.id ? "grabbing" : "grab", touchAction: "none" }}
                >
                  <rect
                    x={r.x} y={r.y} width={Math.max(r.w, 4)} height={Math.max(r.h, 4)}
                    fill={active ? "#f5f5f0" : o.kind === "door" ? "#202020" : "#333"}
                    stroke={active ? "#f5f5f0" : "#999"}
                    strokeWidth={active ? 2 : 1}
                  />
                  <text x={lp.x} y={lp.y} fill={active ? "#f5f5f0" : "#999"} fontSize={10}>
                    {o.kind} {o.widthM.toFixed(2)}m
                  </text>
                </g>
              );
            })}
            {items.filter((f) => !f.decorId).map((f) => {
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
            {showDecor && items.filter((f) => f.decorId).map((f) => {
              const d = decorById(f.decorId);
              const active = sel === f.id;
              return (
                <g
                  key={f.id}
                  onClick={() => setSel(f.id)}
                  onPointerDown={(e) => onFixturePointerDown(e, f.id)}
                  style={{ cursor: dragId === f.id ? "grabbing" : "grab", touchAction: "none" }}
                >
                  <rect x={20 + f.x - f.w / 2} y={20 + f.y - f.h / 2} width={f.w} height={f.h} rx={6}
                    fill={active ? "#f5f5f0" : "#141414"} stroke="#999" strokeWidth={1} strokeDasharray="5 3" />
                  <text x={20 + f.x} y={20 + f.y + 4} textAnchor="middle" fontSize={11} fill={active ? "#000" : "#fff"}>{d?.glyph ?? "Decor"}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <aside className="card no-scrollbar h-fit p-6 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <p className="label-caps text-[#999]">Measurements & constraints</p>
          <p className="mt-2 text-[16px]">Room {room.w} × {room.h} m · {(room.w * room.h).toFixed(1)} m²</p>
          <p className="mt-1 text-[14px] text-[#999]">
            Height {room.height} m · {doorCount} door{doorCount === 1 ? "" : "s"} · {windowCount} window{windowCount === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-[14px] text-[#999]">
            {fixtureCount} fixture{fixtureCount === 1 ? "" : "s"}{decorCount > 0 ? ` + ${decorCount} decor` : ""} · snap {SNAP}px · clearance 0.6m{s < BASE_SCALE ? ` · fit ${Math.round(s)}px/m` : ""}
          </p>
          <div className="mt-4 border-t border-[#333] pt-4">
            <p className="label-caps text-[#999]">Canvas history</p>
            <div className="mt-2 flex gap-2">
              <button onClick={undo} disabled={history.length === 0} title="Undo (Ctrl/⌘ + Z)" className="btn-ghost flex-1 whitespace-nowrap !px-3 !py-2 !text-[14px] disabled:opacity-40">
                ↩ Undo{history.length > 0 ? ` (${history.length})` : ""}
              </button>
              <button onClick={clearAll} disabled={items.length === 0 && openings.length === 0} className="btn-ghost flex-1 whitespace-nowrap !px-3 !py-2 !text-[14px] disabled:opacity-40">
                Clear canvas
              </button>
            </div>
          </div>
          <div className="mt-4 border-t border-[#333] pt-4">
            <p className="label-caps text-[#999]">{activeId ? "Saved design" : "Save this design"}</p>
            <input
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="Name this bathroom…"
              className="field mt-2"
              aria-label="Design name"
            />
            <button onClick={saveDesign} className="btn-cream mt-2 w-full whitespace-nowrap !px-3 !py-2 !text-[14px]">
              {activeId ? "Save changes" : "Save design"}
            </button>
            <p className="label-caps mt-5 text-[#999]">Next step — 3D matches your brief{brief ? ` (“${brief.style}${brief.notes ? ` + ${brief.notes.slice(0, 40)}…` : ""}”)` : ""} to catalogue models within the {brief ? `₹${budgetById(brief.budgetId).cap.toLocaleString("en-IN")}` : "saved"} budget</p>
            <button onClick={viewIn3D} className="btn-cream btn-arrow btn-spotlight mt-2 w-full whitespace-nowrap !py-3 !text-[15px]">
              View in 3D <span aria-hidden className="btn-arrow-glyph">→</span>
            </button>
            <div className="mt-2">
              <Link href="/saved" className="label-caps text-[#999] hover:text-white">View saved →</Link>
            </div>
            {savedTick && (
              <p className="mt-2 text-[13px] text-[#999]">✓ Saved at {savedTick} — find it under Saved Designs.</p>
            )}
          </div>
          {clashes.length > 0 ? (
            <p className="mt-3 text-[14px] text-[#ff8a8a]">⚠ {clashes.length} overlap{clashes.length > 1 ? "s" : ""} — drag {clashes.map((c) => c.kind).join(", ")} apart.</p>
          ) : (
            <p className="mt-3 text-[14px] text-[#999]">✓ No collisions.</p>
          )}
          {activeOpening && (() => {
            const o = activeOpening;
            const len = wallLen(room, o.wall);
            const maxOffset = Math.max(0, len - o.widthM);
            const stepDown = (v: number) => Math.round((v - OPENING_STEP_M) * 100) / 100;
            const stepUp = (v: number) => Math.round((v + OPENING_STEP_M) * 100) / 100;
            return (
              <div className="mt-4 border-t border-[#333] pt-4">
                <p className="text-[16px] font-medium capitalize">{o.kind} <span className="text-[#999]">· {o.widthM.toFixed(2)} m wide</span></p>
                <p className="label-caps mt-4 text-[#999]">Wall</p>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {WALLS.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => updateOpening(o.id, { wall: w.id })}
                      className={o.wall === w.id ? "btn-cream !px-2 !py-2 !text-[13px]" : "btn-ghost !px-2 !py-2 !text-[13px]"}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="label-caps text-[#999]">Position along wall</p>
                  <p className="text-[13px] text-[#999]">{o.offsetM.toFixed(2)} m</p>
                </div>
                <input
                  type="range" min={0} max={maxOffset} step={OPENING_STEP_M} value={o.offsetM}
                  onPointerDown={beginSlider} onPointerUp={endSlider} onFocus={beginSlider} onBlur={endSlider}
                  onChange={(e) => setOpenings((prev) => prev.map((p) => (p.id === o.id ? clampOpening(room, { ...p, offsetM: parseFloat(e.target.value) }) : p)))}
                  className="mt-2 w-full" aria-label={`${o.kind} position along wall in metres`}
                />
                <div className="mt-2 flex gap-2">
                  <button onClick={() => updateOpening(o.id, { offsetM: stepDown(o.offsetM) })} className="btn-ghost flex-1 whitespace-nowrap !px-3 !py-2 !text-[14px]">◀ 5 cm</button>
                  <button onClick={() => updateOpening(o.id, { offsetM: stepUp(o.offsetM) })} className="btn-ghost flex-1 whitespace-nowrap !px-3 !py-2 !text-[14px]">5 cm ▶</button>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="label-caps text-[#999]">Width</p>
                  <p className="text-[13px] text-[#999]">{o.widthM.toFixed(2)} m</p>
                </div>
                <input
                  type="range" min={MIN_OPENING_M} max={len} step={OPENING_STEP_M} value={o.widthM}
                  onPointerDown={beginSlider} onPointerUp={endSlider} onFocus={beginSlider} onBlur={endSlider}
                  onChange={(e) => setOpenings((prev) => prev.map((p) => (p.id === o.id ? clampOpening(room, { ...p, widthM: parseFloat(e.target.value) }) : p)))}
                  className="mt-2 w-full" aria-label={`${o.kind} width in metres`}
                />
                <div className="mt-2 flex gap-2">
                  <button onClick={() => updateOpening(o.id, { widthM: stepDown(o.widthM) })} className="btn-ghost flex-1 whitespace-nowrap !px-3 !py-2 !text-[14px]">− Narrower</button>
                  <button onClick={() => updateOpening(o.id, { widthM: stepUp(o.widthM) })} className="btn-ghost flex-1 whitespace-nowrap !px-3 !py-2 !text-[14px]">+ Wider</button>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => updateOpening(o.id, { kind: o.kind === "door" ? "window" : "door" })}
                    className="btn-ghost flex-1 whitespace-nowrap !px-3 !py-2 !text-[14px]"
                  >
                    Make {o.kind === "door" ? "window" : "door"}
                  </button>
                  <button onClick={() => removeOpening(o.id)} className="btn-ghost flex-1 whitespace-nowrap !px-3 !py-2 !text-[14px]">Remove</button>
                </div>
              </div>
            );
          })()}
          {sel !== null && !activeOpening && (() => {
            const f = items.find((i) => i.id === sel);
            if (!f) return null;
            const d = decorById(f.decorId);
            return (
              <div className="mt-4 border-t border-[#333] pt-4">
                <p className="text-[16px] font-medium">{d ? d.label : f.kind} <span className="text-[#999]">· {d ? "decor" : `${f.rot}°`}</span></p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => rotate(f.id)} className="btn-ghost flex-1 whitespace-nowrap !px-3 !py-2 !text-[14px]">Rotate 90°</button>
                  <button onClick={() => { remove(f.id); setSel(null); }} className="btn-ghost flex-1 whitespace-nowrap !px-3 !py-2 !text-[14px]">Remove</button>
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
