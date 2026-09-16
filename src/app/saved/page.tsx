import Link from "next/link";

const DESIGNS = [
  { id: "spa-retreat-v3", title: "Spa Retreat — v3", meta: "3.6 × 2.4 m · 5 fixtures · ₹4.1L known", tag: "Current" },
  { id: "heritage-guest", title: "Heritage Guest Bath — v1", meta: "2.7 × 2.1 m · 3 fixtures · pricing pending", tag: "Draft" },
];

export default function SavedPage() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <p className="label-caps text-[#999]">Saved designs — Supabase-backed next</p>
      <h1 className="narrative mt-3 text-[54px]">Your bathrooms, kept.</h1>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {DESIGNS.map((d) => (
          <article key={d.id} className="card p-6">
            <span className="badge-glass">{d.tag}</span>
            <h3 className="mt-4 text-[20px] font-medium">{d.title}</h3>
            <p className="mt-2 text-[14px] text-[#999]">{d.meta}</p>
            <div className="mt-4 flex gap-3 text-[14px]">
              <Link href="/planner" className="label-caps hover:text-white">Open</Link>
              <span className="label-caps text-[#999]">Version</span>
              <span className="label-caps text-[#999]">Share</span>
            </div>
          </article>
        ))}
        <Link href="/design/new" className="flex min-h-[200px] items-center justify-center rounded-[10px] border border-dashed border-[#333] text-[16px] text-[#999] hover:border-white hover:text-white transition-colors">
          + New design
        </Link>
      </div>
      <p className="mt-8 text-[14px] text-[#999]">Persistence moves to Supabase tables (design_projects + design_versions + RLS) once you run the migration below — UI stays identical.</p>
    </section>
  );
}
