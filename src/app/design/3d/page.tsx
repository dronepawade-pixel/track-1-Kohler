"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import IsoRoom, { type MetreFixture, type MetreOpening } from "./scene";
import RoomCanvas, { webglAvailable } from "./room3d";
import { getDesign, sanitizeDesign } from "@/lib/designs";

const BASE_SCALE = 150;
const MAX_W = 680;
const MAX_H = 600;
const FIXTURE_H: Record<string, number> = {
  Basin: 0.85,
  Shower: 2.1,
  Bathtub: 0.6,
  Toilet: 0.7,
};

const num = (v: string | null, fb: number, lo: number, hi: number) => {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb;
};

function ViewInner() {
  const params = useSearchParams();
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => {
    setGl(webglAvailable());
  }, []);
  const designId = params.get("design");
  const stored = useMemo(() => {
    const raw = designId ? getDesign(designId) : null;
    return raw ? sanitizeDesign(raw) : null;
  }, [designId]);
  const room = useMemo(
    () =>
      stored?.room ?? {
        w: num(params.get("length"), 3.6, 1.2, 12),
        h: num(params.get("width"), 2.4, 1.2, 12),
        height: num(params.get("height"), 2.7, 2, 5),
        doors: Math.round(num(params.get("doors"), 1, 0, 6)),
        windows: Math.round(num(params.get("windows"), 1, 0, 6)),
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
    return px.map((f) => ({
      id: f.id,
      kind: f.kind,
      cx: f.x / s - room.w / 2,
      cz: f.y / s - room.h / 2,
      w: f.w / s,
      d: f.h / s,
      h: FIXTURE_H[f.kind] ?? 0.8,
      glass: f.kind === "Shower",
    }));
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

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <p className="label-caps text-[#999]">Design track — step 2 of 3 · 3D concept, drag to walk around it</p>
      <h1 className="narrative mt-3 text-[clamp(36px,9vw,54px)]">
        Your bathroom, in <span className="serif-accent">bold</span>.
      </h1>
      <p className="mt-3 text-[16px] text-[#999]">
        Room {room.w} × {room.h} m · {(room.w * room.h).toFixed(1)} m² · height {room.height} m ·{" "}
        {fixtures.length} fixture{fixtures.length === 1 ? "" : "s"}
        {stored ? ` · “${stored.title}”` : ""}
      </p>
      <div className="card mt-8 p-8">
        {gl === null ? (
          <p className="text-[16px] text-[#999]">Loading 3D view…</p>
        ) : gl ? (
          <RoomCanvas room={room} fixtures={fixtures} openings={openings} />
        ) : (
          <IsoRoom room={room} fixtures={fixtures} openings={openings} />
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href="/design/new?mode=3d" className="btn-ghost">← Details</Link>
        <Link href={plannerHref} className="btn-ghost">Edit in 2D canvas →</Link>
        <Link href="/saved" className="btn-ghost">Saved designs</Link>
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
