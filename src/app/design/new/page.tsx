"use client";
import { useState } from "react";
import Link from "next/link";

const STYLES = ["Modern Minimal", "Spa Retreat", "Heritage Classic", "Bold Statement"];

export default function NewDesignPage() {
  const [form, setForm] = useState({ length: "3.6", width: "2.4", height: "2.7", budget: "450000", style: STYLES[1], doors: "1", windows: "1", notes: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const area = (parseFloat(form.length) || 0) * (parseFloat(form.width) || 0);

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <p className="label-caps text-[#999]">New design — step 1 of 3</p>
      <h1 className="narrative mt-3 text-[54px]">Tell us about your bathroom.</h1>
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
          <label className="mt-6 block"><span className="label-caps text-[#999]">Natural-language requirements</span>
            <textarea value={form.notes} onChange={set("notes")} rows={5} placeholder="e.g. Walk-in rainshower, wall-hung toilet, room for a freestanding tub, warm minimal finishes…" className="field mt-2" /></label>
          <p className="mt-3 text-[14px] text-[#999]">Photos & floor-plan upload unlock with Supabase storage (wired in this phase&apos;s migration).</p>
        </div>
      </div>
      <div className="mt-8 flex gap-4">
        <Link href="/planner" className="btn-cream">Continue to 2D planner</Link>
        <Link href="/budget" className="btn-ghost">Skip to budget</Link>
      </div>
    </section>
  );
}
