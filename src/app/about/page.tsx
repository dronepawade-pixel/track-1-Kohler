import Link from "next/link";

export default function About() {
  return (
    <>
      <section className="mx-auto max-w-[1200px] px-6 py-24">
        <p className="label-caps text-[#999]">About Us</p>
        <h1 className="display mt-4 max-w-3xl text-[clamp(54px,6vw,96px)]">
          The <span className="serif-accent">bold</span> look, made for bathrooms.
        </h1>
        <p className="narrative mt-6 max-w-xl text-[20px] text-white/80">
          A spa at home after dark. This studio composes real Kohler bathroom
          products around your space, budget, and rituals — never invented
          data, always verifiable.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/design/new" className="btn-cream">Start your design</Link>
          <Link href="/catalog" className="btn-ghost">Explore collections</Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <div className="card grid gap-px overflow-hidden p-8 md:grid-cols-3 md:p-12">
          {[
            { t: "Real products only", d: "Every recommendation comes from verified Kohler data. Unknown fields stay Unknown." },
            { t: "Deterministic first", d: "Dimensions, clearances, collisions, and budget are calculated in code — not guessed." },
            { t: "Bathroom only", d: "Basin, showering, and toilet areas. No kitchen catalog, no clutter." },
          ].map((c) => (
            <div key={c.t} className="p-6">
              <p className="label-caps text-[#999]">Principle</p>
              <h3 className="mt-2 text-[30px] font-light tracking-[-0.75px]">{c.t}</h3>
              <p className="mt-2 text-[16px] text-white/70">{c.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
