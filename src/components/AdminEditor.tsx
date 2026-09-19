"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EASE } from "./motion";
import {
  CATEGORY_OF_KIND,
  FITS,
  SEED_VARIANTS,
  isOverridden,
  loadVariants,
  resetVariants,
  saveVariants,
  type CategoryId,
  type Variant,
} from "@/lib/variants";
import { ALL_TAGS } from "@/lib/tags";

// Tiny footer admin: edit the AI-matching catalogue (price, dimensions,
// tags, GLB path) directly on the site. Everything is zod-validated on
// save and kept in localStorage; "Reset" drops back to the seed JSON in
// assets/models/<category>/catalog.json. No backend, no auth (demo phase).

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "bathtubs", label: "Bathtubs" },
  { id: "showers", label: "Showers" },
  { id: "toilets", label: "Toilets" },
  { id: "sinks", label: "Sinks" },
  { id: "faucets", label: "Faucets" },
];

type Draft = {
  id: string;
  name: string;
  kind: Variant["kind"];
  fit: Variant["fit"];
  tags: string;
  price: string;
  dw: string;
  dh: string;
  dd: string;
  glb: string;
  thumb: string;
};

const toDraft = (v: Variant): Draft => ({
  id: v.id,
  name: v.name,
  kind: v.kind,
  fit: v.fit,
  tags: v.tags.join(", "),
  price: String(v.price_inr),
  dw: String(v.dims_m[0]),
  dh: String(v.dims_m[1]),
  dd: String(v.dims_m[2]),
  glb: v.glb,
  thumb: v.thumb,
});

const emptyDraft = (cat: CategoryId): Draft => ({
  id: "",
  name: "",
  kind: cat === "sinks" ? "Basin" : (cat.charAt(0).toUpperCase() + cat.slice(1, -1)) as Variant["kind"],
  fit: cat === "sinks" ? "basinTop" : cat === "faucets" ? "faucet" : "footprint",
  tags: "",
  price: "0",
  dw: "0.6",
  dh: "0.5",
  dd: "0.4",
  glb: "",
  thumb: "",
});

const fromDraft = (d: Draft): Variant => ({
  id: d.id.trim(),
  name: d.name.trim(),
  kind: d.kind,
  fit: d.fit,
  tags: d.tags.split(",").map((t) => t.trim()).filter(Boolean) as Variant["tags"],
  price_inr: Number(d.price) || 0,
  dims_m: [Number(d.dw) || 0.1, Number(d.dh) || 0.1, Number(d.dd) || 0.1],
  glb: d.glb.trim(),
  thumb: d.thumb.trim(),
});

export default function AdminEditor() {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<CategoryId>("bathtubs");
  const [all, setAll] = useState<Variant[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [overridden, setOverridden] = useState(false);

  useEffect(() => {
    if (open) {
      setAll(loadVariants());
      setOverridden(isOverridden());
      setDraft(null);
      setMsg(null);
    }
  }, [open]);

  const rows = all.filter((v) => CATEGORY_OF_KIND[v.kind] === cat);

  const commit = (next: Variant[]) => {
    const res = saveVariants(next);
    if (!res.ok) {
      setMsg(`✗ ${res.error}`);
      return;
    }
    setAll(next);
    setOverridden(true);
    setDraft(null);
    setMsg(null);
  };

  const saveDraft = () => {
    if (!draft) return;
    const v = fromDraft(draft);
    const exists = all.some((x) => x.id === v.id && CATEGORY_OF_KIND[x.kind] === cat);
    const rest = all.filter((x) => !(x.id === v.id && CATEGORY_OF_KIND[x.kind] === cat));
    commit([...rest, v]);
    setMsg(exists ? `✓ Updated ${v.id}` : `✓ Added ${v.id}`);
  };

  const remove = (id: string) => {
    if (!window.confirm(`Remove variant "${id}" from the catalogue?`)) return;
    commit(all.filter((x) => !(x.id === id && CATEGORY_OF_KIND[x.kind] === cat)));
    setMsg(`✓ Removed ${id}`);
  };

  const reset = () => {
    if (!window.confirm("Discard all site edits and restore the bundled catalogue?")) return;
    resetVariants();
    setAll(loadVariants());
    setOverridden(false);
    setDraft(null);
    setMsg("✓ Restored bundled catalogue");
  };

  const field = "field mt-1 text-[13px]";
  const label = "label-caps mt-3 block text-[#999]";

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-[16px] text-[#999] transition-colors hover:text-white">
        Catalogue data
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <div aria-hidden onClick={() => setOpen(false)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Catalogue data editor"
              className="card relative flex max-h-[88vh] w-full max-w-3xl flex-col p-6"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="label-caps text-[#999]">Admin — model catalogue</p>
                  <h3 className="mt-1 text-[22px] font-light">Variants the AI matcher picks from</h3>
                  <p className="mt-1 text-[13px] text-[#999]">
                    Stored in this browser (localStorage), zod-validated on save. {overridden ? "Editing a local override." : "Currently the bundled seed."}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={reset} className="btn-ghost !px-3 !py-2 !text-[13px]">Reset to seed</button>
                  <button onClick={() => setOpen(false)} className="btn-ghost !px-3 !py-2 !text-[13px]">Close ×</button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setCat(c.id); setDraft(null); }}
                    className={cat === c.id ? "btn-cream !px-3 !py-1.5 !text-[13px]" : "btn-ghost !px-3 !py-1.5 !text-[13px]"}
                  >
                    {c.label} ({all.filter((v) => CATEGORY_OF_KIND[v.kind] === c.id).length})
                  </button>
                ))}
                <button onClick={() => setDraft(emptyDraft(cat))} className="btn-ghost !px-3 !py-1.5 !text-[13px]">＋ Add variant</button>
              </div>
              <div className="no-scrollbar mt-4 flex-1 overflow-y-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="label-caps text-[#999]">
                    <tr>
                      <th className="pb-2 pr-2 font-normal">Id</th>
                      <th className="pb-2 pr-2 font-normal">Name</th>
                      <th className="pb-2 pr-2 font-normal">Tags</th>
                      <th className="pb-2 pr-2 font-normal">₹</th>
                      <th className="pb-2 pr-2 font-normal">W×H×D m</th>
                      <th className="pb-2 pr-2 font-normal">Fit</th>
                      <th className="pb-2 font-normal"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((v) => (
                      <tr key={v.id} className="border-t border-[#2a2a2a] align-top">
                        <td className="py-2 pr-2 font-mono text-[12px] text-[#999]">{v.id}</td>
                        <td className="py-2 pr-2 text-white/90">{v.name}</td>
                        <td className="py-2 pr-2 text-[#999]">{v.tags.join(", ")}</td>
                        <td className="py-2 pr-2 text-[#999]">{v.price_inr.toLocaleString("en-IN")}</td>
                        <td className="py-2 pr-2 text-[#999]">{v.dims_m.join(" × ")}</td>
                        <td className="py-2 pr-2 text-[#999]">{v.fit}</td>
                        <td className="py-2 whitespace-nowrap text-right">
                          <button onClick={() => setDraft(toDraft(v))} className="text-[#999] underline-offset-2 hover:text-white hover:underline">edit</button>
                          <span className="mx-2 text-[#444]">·</span>
                          <button onClick={() => remove(v.id)} className="text-[#999] underline-offset-2 hover:text-[#ff8a8a] hover:underline">del</button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={7} className="py-4 text-[#999]">No {cat} variants — add one.</td></tr>
                    )}
                  </tbody>
                </table>
                {draft && (
                  <div className="card mt-4 border-[#3a3a3a] p-4">
                    <p className="label-caps text-[#999]">{all.some((x) => x.id === draft.id && draft.id) ? "Edit variant" : "New variant"}</p>
                    <div className="grid grid-cols-2 gap-x-4 md:grid-cols-4">
                      <label className="block"><span className="label-caps text-[#999]">Id (e.g. tub-new-1)</span>
                        <input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} className={field} /></label>
                      <label className="block md:col-span-2"><span className="label-caps text-[#999]">Name</span>
                        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={field} /></label>
                      <label className="block"><span className="label-caps text-[#999]">Kind</span>
                        <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft["kind"] })} className={field}>
                          {["Bathtub", "Shower", "Toilet", "Basin", "Faucet"].map((k) => <option key={k}>{k}</option>)}
                        </select></label>
                      <label className="block"><span className="label-caps text-[#999]">Fit</span>
                        <select value={draft.fit} onChange={(e) => setDraft({ ...draft, fit: e.target.value as Draft["fit"] })} className={field}>
                          {FITS.map((x) => <option key={x}>{x}</option>)}
                        </select></label>
                      <label className="block"><span className="label-caps text-[#999]">Price ₹</span>
                        <input type="number" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className={field} /></label>
                      <label className="block"><span className="label-caps text-[#999]">Dim W / H / D (m)</span>
                        <div className="flex gap-1">
                          <input type="number" step="0.01" value={draft.dw} onChange={(e) => setDraft({ ...draft, dw: e.target.value })} className={field} />
                          <input type="number" step="0.01" value={draft.dh} onChange={(e) => setDraft({ ...draft, dh: e.target.value })} className={field} />
                          <input type="number" step="0.01" value={draft.dd} onChange={(e) => setDraft({ ...draft, dd: e.target.value })} className={field} />
                        </div></label>
                      <label className="block"><span className="label-caps text-[#999]">GLB path (optional)</span>
                        <input value={draft.glb} onChange={(e) => setDraft({ ...draft, glb: e.target.value })} placeholder="/models/….glb" className={field} /></label>
                      <label className="block md:col-span-2"><span className="label-caps text-[#999]">Thumb path (optional)</span>
                        <input value={draft.thumb} onChange={(e) => setDraft({ ...draft, thumb: e.target.value })} placeholder="/images/products/….jpg" className={field} /></label>
                    </div>
                    <label className="block"><span className={label}>Tags — pick from: {ALL_TAGS.join(", ")}</span>
                      <input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="minimal, white, marble" className={field} /></label>
                    <div className="mt-4 flex gap-2">
                      <button onClick={saveDraft} className="btn-cream !px-3 !py-2 !text-[13px]">Save variant</button>
                      <button onClick={() => setDraft(null)} className="btn-ghost !px-3 !py-2 !text-[13px]">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
              {msg && <p className="mt-3 text-[13px] text-[#999]">{msg}</p>}
              <p className="label-caps mt-3 text-[#666]">{SEED_VARIANTS.length} seed variants · {all.length} active</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
