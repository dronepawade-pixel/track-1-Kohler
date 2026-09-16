"use client";
import { useState } from "react";

type Line = { name: string; amount: number | null };
const STARTER: Line[] = [
  { name: "Rainshower set", amount: null },
  { name: "Freestanding bathtub", amount: null },
  { name: "Wall-hung smart toilet", amount: null },
  { name: "Installation & plumbing", amount: 60000 },
];

export default function BudgetPage() {
  const [lines, setLines] = useState<Line[]>(STARTER);
  const [budget, setBudget] = useState("450000");
  const known = lines.filter((l) => l.amount !== null).reduce((s, l) => s + (l.amount ?? 0), 0);
  const unknown = lines.filter((l) => l.amount === null).length;
  const cap = parseFloat(budget) || 0;
  const over = known > cap;
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <p className="label-caps text-[#999]">Budget — deterministic calculation</p>
      <h1 className="narrative mt-3 text-[54px]">Every rupee, accounted.</h1>
      <div className="mt-10 grid gap-4 md:grid-cols-[1fr_360px]">
        <div className="card divide-y divide-[#333] p-8">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-4">
              <span className="text-[16px]">{l.name}</span>
              <span className="flex items-center gap-3">
                <span className="text-[16px] text-white/80">{l.amount === null ? "Unknown" : `₹${l.amount.toLocaleString("en-IN")}`}</span>
                <button onClick={() => setLines((p) => p.filter((_, j) => j !== i))} className="label-caps text-[#999] hover:text-white">Remove</button>
              </span>
            </div>
          ))}
          <p className="pt-4 text-[14px] text-[#999]">{unknown} line{unknown === 1 ? "" : "s"} awaiting verified pricing — shown as Unknown, never guessed.</p>
        </div>
        <div className="card h-fit p-8">
          <label className="label-caps text-[#999]">Total budget (₹)</label>
          <input value={budget} onChange={(e) => setBudget(e.target.value)} type="number" min="0" className="field mt-2" />
          <div className="mt-4 flex justify-between text-[16px]"><span className="text-[#999]">Known total</span><span>₹{known.toLocaleString("en-IN")}</span></div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#333]">
            <div className="h-full rounded-full" style={{ width: `${cap ? Math.min(100, (known / cap) * 100) : 0}%`, background: over ? "#ff5c5c" : "#f5f5f0" }} />
          </div>
          <p className={`mt-3 text-[16px] ${over ? "text-[#ff8a8a]" : ""}`}>{over ? "Over budget — swap or remove an item." : `${Math.round(cap ? (known / cap) * 100 : 0)}% of budget committed.`}</p>
        </div>
      </div>
    </section>
  );
}
