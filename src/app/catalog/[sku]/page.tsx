import Link from "next/link";
import { notFound } from "next/navigation";
import { PLACEHOLDER_PRODUCTS, fmtPrice } from "@/lib/products";

export default async function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const p = PLACEHOLDER_PRODUCTS.find((x) => x.sku === sku);
  if (!p) notFound();
  const rows: [string, string][] = [
    ["SKU", p.sku],
    ["Collection", p.collection],
    ["Category", p.category],
    ["Finish", p.finish],
    ["Price", fmtPrice(p.price)],
    ["Dimensions", p.dimensions ?? "Unknown"],
    ["Official URL", p.url ?? "Unknown"],
  ];
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <Link href="/catalog" className="label-caps text-[#999] hover:text-white">← All products</Link>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="media-card scrim min-h-[380px] bg-gradient-to-br from-[#262626] to-[#0c0c0c] p-8 flex items-end">
          <span className="badge-glass absolute right-6 top-6">{p.category}</span>
          <h1 className="relative z-10 text-[30px] font-light tracking-[-0.75px]">{p.name}</h1>
        </div>
        <div className="card p-8">
          <p className="label-caps text-[#999]">Specifications — verified only</p>
          <dl className="mt-4 divide-y divide-[#333]">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 py-3 text-[16px]">
                <dt className="text-[#999]">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex gap-4">
            <Link href="/planner" className="btn-cream">Add to plan</Link>
            <Link href="/budget" className="btn-ghost">Check budget</Link>
          </div>
          <p className="mt-6 text-[14px] text-[#999]">2D / 3D / Revit assets appear here per product once your Kohler asset pack is linked. The 2D planner works with or without them.</p>
        </div>
      </div>
    </section>
  );
}
