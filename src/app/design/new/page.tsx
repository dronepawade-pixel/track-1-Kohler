"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { uid, upsertDesign } from "@/lib/designs";
import { toSavedFixtures, type Placement } from "@/lib/autoLayout";

const STYLES = ["Modern Minimal", "Spa Retreat", "Heritage Classic", "Bold Statement"];

type Track = "3d" | "2d";

type RecommendLayout = Placement & { sku: string; kind: string; modelId: string };
type RecommendRes = {
  tags_used?: string[];
  tag_source?: string;
  catalog_source?: string;
  bundle?: { sku: string; name: string; price_inr: number | null }[];
  totalCost_known?: number;
  unknownCount?: number;
  warnings?: string[];
  layout?: RecommendLayout[];
  error?: string;
};

function NewDesignInner() {
  const params = useSearchParams();
  const router = useRouter();
  // Shared step 1 for both tracks: ?mode=2d heads to the 2D planner canvas,
  // anything else runs the Design track into the 3D view.
  const [track, setTrack] = useState<Track>(params.get("mode") === "2d" ? "2d" : "3d");
  const [form, setForm] = useState({ length: "3.6", width: "2.4", height: "2.7", budget: "450000", style: STYLES[1], doors: "1", windows: "1", notes: "" });
  const [aiState, setAiState] = useState<"idle" | "working" | "error">("idle");
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const area = (parseFloat(form.length) || 0) * (parseFloat(form.width) || 0);
  const query =
    `length=${encodeURIComponent(form.length)}&width=${encodeURIComponent(form.width)}` +
    `&height=${encodeURIComponent(form.height)}&doors=${encodeURIComponent(form.doors)}&windows=${encodeURIComponent(form.windows)}`;
  const nextHref = track === "2d" ? `/planner?${query}` : `/design/3d?${query}`;

  // AI concept (3D track only): plain-text style + budget → Gemini tags →
  // strict-budget catalogue bundle → deterministic auto-layout → saved design.
  const generateConcept = async () => {
    setAiState("working");
    setAiMsg(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: {
            l_m: parseFloat(form.length) || 3.6,
            w_m: parseFloat(form.width) || 2.4,
            h_m: parseFloat(form.height) || 2.7,
          },
          budget_inr: parseFloat(form.budget) || 0,
          style: form.style,
          notes: form.notes,
        }),
      });
      const data = (await res.json()) as RecommendRes;
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
      const room = {
        w: parseFloat(form.length) || 3.6,
        h: parseFloat(form.width) || 2.4,
        height: parseFloat(form.height) || 2.7,
        doors: Math.max(0, parseInt(form.doors) || 0),
        windows: Math.max(0, parseInt(form.windows) || 0),
      };
      const layout = data.layout ?? [];
      const items = toSavedFixtures(room, layout);
      let oid = 1;
      const spread = (kind: "door" | "window", count: number, wall: "top" | "bottom", widthM: number) => {
        const len = wall === "top" || wall === "bottom" ? room.w : room.h;
        const wM = Math.min(widthM, len);
        return Array.from({ length: count }).map((_, i) => ({
          id: oid++,
          kind,
          wall,
          widthM: wM,
          offsetM: Math.min(Math.max(((i + 1) / (count + 1)) * len - wM / 2, 0), Math.max(0, len - wM)),
        }));
      };
      const id = uid();
      const now = new Date().toISOString();
      upsertDesign({
        id,
        title: `AI concept — ${form.style}`,
        createdAt: now,
        updatedAt: now,
        room,
        items,
        openings: [
          ...spread("door", room.doors, "bottom", 0.9),
          ...spread("window", room.windows, "top", 1.2),
        ],
      });
      const bits = [
        `${data.bundle?.length ?? 0} items`,
        `₹${(data.totalCost_known ?? 0).toLocaleString("en-IN")} of ₹${(parseFloat(form.budget) || 0).toLocaleString("en-IN")}`,
        `tags: ${(data.tags_used ?? []).join(", ")}`,
      ];
      if ((data.unknownCount ?? 0) > 0) bits.push(`${data.unknownCount} price Unknown`);
      if (data.warnings?.length) bits.push(data.warnings.join(" · "));
      setAiMsg(`${bits.join(" · ")} (${data.tag_source}; ${data.catalog_source}). Opening 3D…`);
      setAiState("idle");
      router.push(`/design/3d?design=${encodeURIComponent(id)}`);
    } catch (err) {
      setAiState("error");
      setAiMsg(err instanceof Error ? err.message : "Generation failed. Continue manually below.");
    }
  };

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <p className="label-caps text-[#999]">New design — step 1 of 3 · shared by both tracks</p>
      <h1 className="narrative mt-3 text-[clamp(36px,9vw,54px)]">Tell us about your bathroom.</h1>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Choose your track">
        {(["3d", "2d"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={track === t}
            onClick={() => setTrack(t)}
            className={track === t ? "btn-cream !py-2 !text-[14px]" : "btn-ghost !py-2 !text-[14px]"}
          >
            {t === "3d" ? "Design — 3D view" : "Planner — 2D canvas"}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[14px] text-[#999]">
        {track === "3d"
          ? "Design track: same details, then a walk-around 3D concept of your bathroom."
          : "Planner track: same details, then the measured 2D canvas — drag, rotate, snap."}
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="card p-8">
          <p className="label-caps text-[#999]">Room dimensions (metres)</p>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {(["length", "width", "height"] as const).map((k) => (
              <label key={k} className="block">
                <span className="label-caps text-[#999]">{k}</span>
                <input type="number" step="0.1" min="0" value={form[k]} onChange={set(k)} className="field mt-2" />
              </label>
            ))}
          </div>
          <p className="mt-3 text-[14px] text-[#999]">Floor area ≈ {area.toFixed(1)} m² (deterministic — geometry engine validates this later).</p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <label className="block"><span className="label-caps text-[#999]">Doors</span>
              <input type="number" min="0" value={form.doors} onChange={set("doors")} className="field mt-2" /></label>
            <label className="block"><span className="label-caps text-[#999]">Windows</span>
              <input type="number" min="0" value={form.windows} onChange={set("windows")} className="field mt-2" /></label>
          </div>
          <label className="mt-6 block"><span className="label-caps text-[#999]">Budget (₹)</span>
            <input type="number" min="0" step="1000" value={form.budget} onChange={set("budget")} className="field mt-2" /></label>
        </div>
        <div className="card p-8">
          <p className="label-caps text-[#999]">Style & rituals</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button key={s} onClick={() => setForm((f) => ({ ...f, style: s }))}
                className={form.style === s ? "btn-cream !py-2 !text-[14px]" : "btn-ghost !py-2 !text-[14px]"}>{s}</button>
            ))}
          </div>
          <label className="mt-6 block"><span className="label-caps text-[#999]">Tell the AI what you want</span>
            <textarea value={form.notes} onChange={set("notes")} rows={5} placeholder="e.g. Walk-in rainshower, wall-hung toilet, room for a freestanding tub, warm minimal finishes…" className="field mt-2" /></label>
          <p className="mt-3 text-[14px] text-[#999]">Photos & floor-plan upload unlock with Supabase storage (wired in this phase&apos;s migration).</p>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap gap-4">
        {track === "3d" && (
          <button
            onClick={generateConcept}
            disabled={aiState === "working"}
            className="btn-cream disabled:cursor-wait disabled:opacity-60"
          >
            {aiState === "working" ? "Generating concept…" : "✨ Generate 3D concept"}
          </button>
        )}
        <Link href={nextHref} className="btn-ghost">
          {track === "2d" ? "Continue to 2D planner" : "Continue to 3D design"}
        </Link>
        <Link href="/budget" className="btn-ghost">Skip to budget</Link>
      </div>
      {track === "3d" && (
        <p className="mt-3 max-w-2xl text-[14px] text-[#999]">
          {aiMsg ?? "AI reads your style text + budget, picks catalogue 3D models that match, and auto-places them in the 3D view. Strict budget — the bundle never exceeds ₹. Works without a Gemini key (keyword fallback); add one for smarter tag matching."}
        </p>
      )}
      {aiState === "error" && aiMsg && (
        <p className="mt-2 max-w-2xl text-[14px] text-[#ff8a8a]">{aiMsg}</p>
      )}
    </section>
  );
}

export default function NewDesignPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-[1200px] px-6 py-16"><p className="text-[16px] text-[#999]">Loading…</p></section>}>
      <NewDesignInner />
    </Suspense>
  );
}
