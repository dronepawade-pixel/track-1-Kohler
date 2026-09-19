"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteDesign, designMeta, loadDesigns, type SavedDesign } from "@/lib/designs";

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
};

export default function SavedPage() {
  const [designs, setDesigns] = useState<SavedDesign[] | null>(null);

  useEffect(() => {
    setDesigns(loadDesigns());
  }, []);

  const remove = (id: string) => {
    if (!window.confirm("Delete this design? This can't be undone.")) return;
    setDesigns(deleteDesign(id));
  };

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <p className="label-caps text-[#999]">Saved designs — kept in this browser</p>
      <h1 className="narrative mt-3 text-[clamp(36px,9vw,54px)]">Your bathrooms, kept.</h1>
      {designs === null ? (
        <p className="mt-10 text-[16px] text-[#999]">Loading your designs…</p>
      ) : designs.length === 0 ? (
        <div className="card mt-10 p-8 text-center">
          <p className="text-[20px] font-medium">No saved designs yet.</p>
          <p className="mt-2 text-[16px] text-[#999]">
            Arrange a room in the 2D planner, hit “Save design”, and it will live here — ready to reopen, edit and re-save.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link href="/design/new" className="btn-cream">Start a design</Link>
            <Link href="/design/new" className="btn-ghost">Open planner</Link>
          </div>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {designs.map((d) => (
            <article key={d.id} className="card flex flex-col p-6">
              <h3 className="text-[20px] font-medium">{d.title}</h3>
              <p className="mt-2 text-[14px] text-[#999]">{designMeta(d)}</p>
              <p className="mt-1 text-[13px] text-[#999]">
                Saved {fmtDate(d.updatedAt)}
                {d.openings.length > 0 &&
                  ` · ${d.openings.filter((o) => o.kind === "door").length} door(s), ${d.openings.filter((o) => o.kind === "window").length} window(s)`}
              </p>
              <div className="mt-4 flex gap-3 text-[14px]">
                <Link href={`/planner?design=${encodeURIComponent(d.id)}`} className="label-caps hover:text-white">
                  Open →
                </Link>
                <Link href={`/design/3d?design=${encodeURIComponent(d.id)}`} className="label-caps text-[#999] hover:text-white">
                  3D
                </Link>
                <button onClick={() => remove(d.id)} className="label-caps text-[#999] hover:text-white">
                  Delete
                </button>
              </div>
            </article>
          ))}
          <Link href="/design/new" className="flex min-h-[200px] items-center justify-center rounded-[10px] border border-dashed border-[#333] text-[16px] text-[#999] hover:border-white hover:text-white transition-colors">
            + New design
          </Link>
        </div>
      )}
      <p className="mt-8 text-[14px] text-[#999]">
        Designs save to this browser automatically — no account needed. Cloud sync (Supabase design_projects + versions) arrives in a later phase.
      </p>
    </section>
  );
}
