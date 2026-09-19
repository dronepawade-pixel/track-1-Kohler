"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import IsoRoom, { type MetreFixture, type MetreOpening } from "./scene";
import RoomCanvas, { webglAvailable } from "./room3d";
import { getDesign, sanitizeDesign, upsertDesign, type SavedDesign } from "@/lib/designs";
import { PROCEDURAL } from "@/lib/models";
import { decorById, SURFACE_TOP } from "@/lib/decor";

const BASE_SCALE = 150;
const MAX_W = 680;
const MAX_H = 600;
const FIXTURE_H: Record<string, number> = {
  Basin: 0.85,
  Shower: 2.1,
  Bathtub: 0.6,
  Toilet: 0.7,
};

const num = (v: string | null | undefined, fb: number, lo: number, hi: number) => {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb;
};

function ViewInner() {
  const params = useSearchParams();
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => {
    setGl(webglAvailable());
  }, []);
  const designId = params?.get("design");
  // Same hydration rule as the planner: localStorage reads happen in an
  // effect, never during render, so server and client HTML match.
  const [stored, setStored] = useState<SavedDesign | null>(null);
  useEffect(() => {
    if (!designId) return;
    const raw = getDesign(designId);
    setStored(raw ? sanitizeDesign(raw) : null);
  }, [designId]);
  const room = useMemo(
    () =>
      stored?.room ?? {
        w: num(params?.get("length"), 3.6, 1.2, 12),
        h: num(params?.get("width"), 2.4, 1.2, 12),
        height: num(params?.get("height"), 2.7, 2, 5),
        doors: Math.round(num(params?.get("doors"), 1, 0, 6)),
        windows: Math.round(num(params?.get("windows"), 1, 0, 6)),
      },
    [params, stored]
  );
  // Same display scale as the 2D canvas, so px snapshots convert back to exact metres.
  const s = Math.min(BASE_SCALE, MAX_W / room.w, MAX_H / room.h);

  const fixtures: MetreFixture[] = useMemo(() => {
    const px =
      stored?.items ??
      [
        { id: 1, kind: "Shower", x: room.w * s * 0.25, y: room.h * s * 0.3, w: 0.9 * s, h: 0.9 * s, rot: 0 },
        { id: 2, kind: "Toilet", x: room.w * s * 0.75, y: room.h * s * 0.28, w: 0.6 * s, h: 0.7 * s, rot: 0 },
      ];
    return px.map((f) => {
      // Decor dropped over a fixture in 2D rests on that fixture's surface
      // in 3D (tray on basin rim, caddy on tub edge); otherwise it sits on
      // the floor. Same rule drives the WebGL view and the SVG fallback.
      // Stacking needs substantial coverage (≥40% of the decor footprint):
      // a mere corner graze must not launch a plant to toilet-top height.
      // With several fixtures under it, the largest overlap wins.
      let y0 = 0;
      if (f.decorId) {
        let best: { top: number; area: number } | null = null;
        for (const o of px) {
          if (o.decorId || o.id === f.id) continue;
          const ox =
            Math.min(f.x + f.w / 2, o.x + o.w / 2) - Math.max(f.x - f.w / 2, o.x - o.w / 2);
          const oy =
            Math.min(f.y + f.h / 2, o.y + o.h / 2) - Math.max(f.y - f.h / 2, o.y - o.h / 2);
          const area = Math.max(0, ox) * Math.max(0, oy);
          if (area > 0 && area / (f.w * f.h) >= 0.4 && (!best || area > best.area)) {
            best = { top: SURFACE_TOP[o.kind] ?? 0, area };
          }
        }
        if (best) y0 = best.top;
      }
      return {
        id: f.id,
        kind: f.kind,
        cx: f.x / s - room.w / 2,
        cz: f.y / s - room.h / 2,
        w: f.w / s,
        d: f.h / s,
        h: f.decorId ? decorById(f.decorId)?.tall ?? 0.5 : FIXTURE_H[f.kind] ?? 0.8,
        y0,
        glass: f.kind === "Shower",
        decorId: f.decorId,
        rot: f.rot ?? 0,
      };
    });
  }, [stored, room, s]);

  const openings: MetreOpening[] = useMemo(() => {
    if (stored) return stored.openings.map((o) => ({ ...o }));
    const spread = (kind: "door" | "window", count: number, wall: MetreOpening["wall"], widthM: number): MetreOpening[] => {
      const len = wall === "top" || wall === "bottom" ? room.w : room.h;
      const w = Math.min(widthM, len);
      return Array.from({ length: count }).map((_, i) => ({
        kind,
        wall,
        widthM: w,
        offsetM: Math.min(Math.max(((i + 1) / (count + 1)) * len - w / 2, 0), Math.max(0, len - w)),
      }));
    };
    return [...spread("door", room.doors, "bottom", 0.9), ...spread("window", room.windows, "top", 1.2)];
  }, [stored, room]);

  const query =
    `length=${room.w}&width=${room.h}&height=${room.height}&doors=${room.doors}&windows=${room.windows}`;
  const plannerHref = designId ? `/planner?design=${encodeURIComponent(designId)}` : `/planner?${query}`;

  // 3D opens only from the 2D planner (saved design): a bare visit with room
  // dims but no design is sent to the canvas instead.
  const router = useRouter();
  useEffect(() => {
    if (!designId) router.replace(`/planner?${query}`);
  }, [designId, query, router]);
  if (!designId) {
    return (
      <section className="mx-auto max-w-[1200px] px-6 py-16">
        <p className="text-[16px] text-[#999]">Arrange your room on the 2D canvas first — taking you there…</p>
      </section>
    );
  }

  // Per-fixture model swaps (fixture id -> MODEL_OPTIONS id). Seeded from the
  // saved design once it loads; user picks always win over the seed.
  const [models, setModels] = useState<Record<number, string>>({});
  useEffect(() => {
    if (!stored) return;
    setModels((prev) => {
      const next = { ...prev };
      for (const f of stored.items)
        if (f.model && f.model !== PROCEDURAL && !(f.id in next)) next[f.id] = f.model;
      return next;
    });
  }, [stored]);
  const [savedTick, setSavedTick] = useState(false);
  const saveSwaps = () => {
    if (!stored) return;
    upsertDesign({
      ...stored,
      updatedAt: new Date().toISOString(),
      items: stored.items.map((f) => ({ ...f, model: models[f.id] ?? f.model ?? PROCEDURAL })),
    });
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 2000);
  };

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <p className="label-caps text-[#999]">Design track — step 3 of 3 · 3D concept, drag to walk around it</p>      <h1 className="narrative mt-3 text-[clamp(36px,9vw,54px)]">
        Your bathroom, in <span className="serif-accent">bold</span>.
      </h1>
      <p className="mt-3 text-[16px] text-[#999]">
        Room {room.w} × {room.h} m · {(room.w * room.h).toFixed(1)} m² · height {room.height} m ·{" "}
        {fixtures.filter((f) => !f.decorId).length} fixture{fixtures.filter((f) => !f.decorId).length === 1 ? "" : "s"}
        {fixtures.some((f) => f.decorId) ? ` + ${fixtures.filter((f) => f.decorId).length} decor` : ""}
        {stored ? ` · “${stored.title}”` : ""}
      </p>
      <div className="card mt-8 p-8">
        {gl === null ? (
          <p className="text-[16px] text-[#999]">Loading 3D view…</p>
        ) : gl ? (
          <RoomCanvas
            room={room}
            fixtures={fixtures}
            openings={openings}
            models={models}
            onModelChange={(id, model) => setModels((m) => ({ ...m, [id]: model }))}
          />
        ) : (
          <IsoRoom room={room} fixtures={fixtures} openings={openings} />
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href="/design/new" className="btn-ghost">← Details</Link>
        <Link href={plannerHref} className="btn-ghost">Edit in 2D canvas →</Link>
        <Link href="/saved" className="btn-ghost">Saved designs</Link>
        <Link href="/budget" className="btn-cream !py-2 !text-[14px]">Continue to budget →</Link>
        {stored && (
          <button onClick={saveSwaps} className="btn-ghost !py-2 !text-[14px]">
            {savedTick ? "Saved ✓" : "Save model swaps"}
          </button>
        )}
      </div>
      {fixtures.length === 0 && (
        <p className="mt-4 text-[14px] text-[#999]">
          Empty room — arrange fixtures on the 2D canvas, save, then reopen here to see them in 3D.
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-6 text-[13px] text-[#999]">
        <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-[3px] bg-[#333]" /> Fixtures</span>
        <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-[3px] bg-[#050505] ring-1 ring-[#8a8a8a]" /> Doors</span>
        <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-[3px] bg-[#f5f5f0]/30 ring-1 ring-[#f5f5f0]" /> Windows</span>
      </div>
    </section>
  );
}

export default function Design3DPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-[1200px] px-6 py-16"><p className="text-[16px] text-[#999]">Loading 3D view…</p></section>}>
      <ViewInner />
    </Suspense>
  );
}
