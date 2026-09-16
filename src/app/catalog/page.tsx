"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORIES, PLACEHOLDER_PRODUCTS, fmtPrice } from "@/lib/products";

export default function CatalogPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const items = useMemo(
    () =>
      PLACEHOLDER_PRODUCTS.filter(
        (p) =>
          (cat === "All" || p.category === cat) &&
          (q === "" || (p.name + p.sku + p.collection).toLowerCase().includes(q.toLowerCase()))
      ),
    [q, cat]
  );
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <p className="label-caps text-[#999]">Collections</p>
      <h1 className="narrative mt-3 text-[54px]">Every product, verified real.</h1>
      <p className="mt-3 max-w-xl text-[16px] text-white/70">
        Live data lands here from Supabase + studiokohler.com verification. Until then, specs read as Unknown — never invented.
      </p>
      <div className="mt-8 flex flex-col gap-4 md:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, collections, SKUs…" className="field md:max-w-md" />
        <div className="flex flex-wrap gap-2">
          {["All", ...CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cat === c ? "btn-cream !py-2 !text-[14px]" : "btn-ghost !py-2 !text-[14px]"}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {items.map((p) => (
          <Link key={p.sku} href={`/catalog/${p.sku}`} className="card group p-6 transition-transform duration-300 hover:-translate-y-1">
            <span className="badge-glass">{p.category}</span>
            <h3 className="mt-4 text-[20px] font-medium">{p.name}</h3>
            <p className="label-caps mt-2 text-[#999]">{p.sku} · {p.finish}</p>
            <p className="mt-4 text-[16px] text-white/80">{fmtPrice(p.price)}</p>
            <p className="mt-1 text-[14px] text-[#999]">{p.dimensions ?? "Dimensions: Unknown"}</p>
          </Link>
        ))}
      </div>
      {items.length === 0 && <p className="mt-10 text-[16px] text-[#999]">No products match — try clearing the search.</p>}
    </section>
  );
}
