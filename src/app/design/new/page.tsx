"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { BUDGET_RANGES, DEFAULT_BUDGET_ID, budgetById } from "@/lib/budget";

const STYLES = ["Modern Minimal", "Spa Retreat", "Heritage Classic", "Bold Statement"];

function NewDesignInner() {
  // Step 1 of the single flow: dimensions + brief here, then the 2D planner
  // canvas. 3D opens only from the planner (saved design), never directly.
  const [form, setForm] = useState({ length: "3.6", width: "2.4", height: "2.7", budgetId: DEFAULT_BUDGET_ID, style: STYLES[1], doors: "1", windows: "1", notes: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const area = (parseFloat(form.length) || 0) * (parseFloat(form.width) || 0);
  const query =
    `length=${encodeURIComponent(form.length)}&width=${encodeURIComponent(form.width)}` +
    `&height=${encodeURIComponent(form.height)}&doors=${encodeURIComponent(form.doors)}&windows=${encodeURIComponent(form.windows)}`;
  const nextHref = `/planner?${query}`;

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <p className="label-caps text-[#999]">New design — step 1 of 3</p>
      <h1 className="narrative mt-3 text-[clamp(36px,9vw,54px)]">Tell us about your bathroom.</h1>
      <p className="mt-3 text-[14px] text-[#999]">
        Next: the measured 2D canvas — drag, rotate, snap. 3D opens from the planner once your layout is saved.
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
          <div className="mt-6">
            <span className="label-caps text-[#999]">Budget range</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {BUDGET_RANGES.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setForm((f) => ({ ...f, budgetId: b.id }))}
                  className={form.budgetId === b.id ? "btn-cream !px-3 !py-2 !text-[13px]" : "btn-ghost !px-3 !py-2 !text-[13px]"}
                  aria-pressed={form.budgetId === b.id}
                >
                  {b.label} · {b.blurb}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[14px] text-[#999]">
              Capped at ₹{budgetById(form.budgetId).cap.toLocaleString("en-IN")} — the AI and budget check plan within it.
            </p>
          </div>
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
        <Link href={nextHref} className="btn-cream">
          Continue to 2D planner
        </Link>
      </div>
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
