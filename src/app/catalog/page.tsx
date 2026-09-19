"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CATEGORIES, SUBCATEGORIES, PLACEHOLDER_PRODUCTS, fmtPrice } from "@/lib/products";

function TypeList({
  cat,
  sub,
  onCat,
  onSub,
}: {
  cat: string;
  sub: string | null;
  onCat: (c: string) => void;
  onSub: (c: string, s: string | null) => void;
}) {
  return (
    <div>
      <p className="label-caps text-[#999]">Shop by type</p>
      <div className="mt-3 space-y-5">
        {(["All", ...CATEGORIES] as string[]).map((c) => (
          <div key={c}>
            <button
              onClick={() => onCat(c)}
              className={`text-[15px] font-medium transition-colors ${cat === c && !sub ? "text-white" : "text-white/60 hover:text-white"}`}
            >
              {c === "All" ? "All products" : c}
            </button>
            {c !== "All" && (cat === c || cat === "All") && (
              <ul className="mt-2 space-y-1.5 border-l border-[#333] pl-3">
                {(SUBCATEGORIES[c] ?? []).map((s) => (
                  <li key={s}>
                    <button
                      onClick={() => onSub(c, s)}
                      className={`flex w-full items-center gap-2 text-left text-[14px] transition-colors ${sub === s ? "text-white" : "text-[#999] hover:text-white"}`}
                    >
                      <span className={`h-1 w-1 shrink-0 rounded-full ${sub === s ? "bg-[#f5f5f0]" : "bg-[#444]"}`} />
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {sub && (
        <button onClick={() => onSub(cat === "All" ? "All" : cat, null)} className="label-caps mt-5 text-[#999] hover:text-white">
          Clear type ×
        </button>
      )}
    </div>
  );
}

function CatalogInner() {
  const params = useSearchParams();
  const qp = (k: string): string | null => params?.get(k) ?? null;
  const validCat = (c: string | null): string =>
    c && (CATEGORIES as readonly string[]).includes(c) ? c : "All";
  const validSub = (c: string, s: string | null): string | null =>
    s && (SUBCATEGORIES[c] ?? []).includes(s) ? s : null;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>(() => validCat(qp("category")));
  const [sub, setSub] = useState<string | null>(() => validSub(validCat(qp("category")), qp("sub")));
  useEffect(() => {
    const c = validCat(qp("category"));
    setCat(c);
    setSub(validSub(c, qp("sub")));
  }, [params]);
  const pickCat = (c: string) => { setCat(c); setSub(null); };
  const pickSub = (c: string, s: string | null) => { setCat(c); setSub(s); };
  const items = useMemo(
    () =>
      PLACEHOLDER_PRODUCTS.filter(
        (p) =>
          (cat === "All" || p.category === cat) &&
          (sub === null || p.subtype === sub) &&
          (q === "" || (p.name + p.sku + p.collection).toLowerCase().includes(q.toLowerCase()))
      ),
    [q, cat, sub]
  );
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <p className="label-caps text-[#999]">Collections</p>
      <h1 className="narrative mt-3 text-[clamp(36px,9vw,54px)]">Every product, verified real.</h1>
      <p className="mt-3 max-w-xl text-[16px] text-white/70">
        Live data lands here from Supabase + studiokohler.com verification. Until then, specs read as Unknown — never invented.
      </p>
      <div className="mt-8 flex flex-col gap-4 md:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, collections, SKUs…" className="field md:max-w-md" />
        <div className="flex flex-wrap gap-2">
          {["All", ...CATEGORIES].map((c) => (
            <button key={c} onClick={() => pickCat(c)} className={cat === c && !sub ? "btn-cream !py-2 !text-[14px]" : "btn-ghost !py-2 !text-[14px]"}>
              {c}
            </button>
          ))}
        </div>
      </div>
      {sub && (
        <p className="mt-4 text-[14px] text-[#999]">
          Type: <span className="text-white">{sub}</span>
        </p>
      )}
      <div className="mt-8 flex flex-col gap-6 md:flex-row">
        <details className="card p-5 md:hidden">
          <summary className="label-caps cursor-pointer text-[#999]">Browse types</summary>
          <div className="mt-4">
            <TypeList cat={cat} sub={sub} onCat={pickCat} onSub={pickSub} />
          </div>
        </details>
        <aside className="card hidden h-fit w-60 shrink-0 p-6 md:block lg:sticky lg:top-20">
          <TypeList cat={cat} sub={sub} onCat={pickCat} onSub={pickSub} />
        </aside>
        <div className="min-w-0 flex-1">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((p) => (
              <Link key={p.sku} href={`/catalog/${p.sku}`} className="card group p-6 transition-transform duration-300 hover:-translate-y-1">
                <span className="badge-glass">{p.subtype ?? p.category}</span>
                <h3 className="mt-4 text-[20px] font-medium">{p.name}</h3>
                <p className="label-caps mt-2 text-[#999]">{p.sku} · {p.finish}</p>
                <p className="mt-4 text-[16px] text-white/80">{fmtPrice(p.price)}</p>
                <p className="mt-1 text-[14px] text-[#999]">{p.dimensions ?? "Dimensions: Unknown"}</p>
              </Link>
            ))}
          </div>
          {items.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-[18px] font-medium">No verified {sub ?? (cat === "All" ? "products" : cat)} yet.</p>
              <p className="mt-2 text-[14px] text-[#999]">
                {sub
                  ? `Nothing verified as “${sub}” so far — try “All ${cat}” or clear the search. Types link up as verification lands.`
                  : "Try clearing the search — types link up as verification lands."}
              </p>
              <button onClick={() => { setCat("All"); setSub(null); setQ(""); }} className="btn-ghost mt-5 !py-2 !text-[14px]">
                Show everything
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-[1200px] px-6 py-16"><p className="text-[16px] text-[#999]">Loading collections…</p></section>}>
      <CatalogInner />
    </Suspense>
  );
}
