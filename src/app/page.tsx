import Link from "next/link";

const AREAS = [
  { badge: "Showers", title: "Performance Showering", copy: "Rainshower and handshower rituals in marble showering areas.", grad: "from-[#2a2a28] to-[#101010]" },
  { badge: "Smart Toilets", title: "The Toilet Area", copy: "Wall-hung forms with bidet seats in minimal spaces.", grad: "from-[#232323] to-[#0c0c0c]" },
  { badge: "Basins", title: "The Grooming Area", copy: "Vessel basins with single-control faucets on stone vanities.", grad: "from-[#262626] to-[#111]" },
  { badge: "Best Sellers", title: "Freestanding Bathtubs", copy: "Soaking zones by the window — steam, soak, shower.", grad: "from-[#1f1f1f] to-[#0a0a0a]" },
];

const STRIP = ["Best Sellers", "Showers", "Smart Toilets", "New Launches", "Bathtubs", "Basins", "Faucets", "Mirrors"];

export default function Home() {
  return (
    <>
      {/* HERO — full-viewport cinematic still */}
      <section className="scrim relative flex min-h-[calc(100vh-4rem)] items-end overflow-hidden bg-gradient-to-b from-[#161614] via-[#0a0a0a] to-black">
        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 pb-16">
          <p className="label-caps text-[#999]">Kohler Spa at Home — Steam. Soak. Shower.</p>
          <h1 className="display mt-4 max-w-4xl text-[clamp(57px,9vw,128px)]">
            The <span className="serif-accent">bold</span> look, made.
          </h1>
          <p className="narrative mt-6 max-w-xl text-[20px] text-white/80">
            A spa at home after dark. Tell us your space, budget and rituals — we compose it from real Kohler products.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/design/new" className="btn-cream">Start your design</Link>
            <Link href="/catalog" className="btn-ghost">Explore collections</Link>
          </div>
        </div>
        <div className="absolute bottom-8 right-8 z-10 hidden items-center gap-3 md:flex">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/80 text-white">▶</span>
          <span className="label-caps !text-[13px] text-white/80">Watch the craft</span>
        </div>
      </section>

      {/* Marquee strip */}
      <div className="overflow-hidden border-y border-[#333] py-4">
        <div className="animate-marquee flex w-max gap-10 whitespace-nowrap">
          {[...STRIP, ...STRIP].map((s, i) => (
            <span key={i} className="label-caps text-[#999]">{s}</span>
          ))}
        </div>
      </div>

      {/* Best sellers */}
      <section className="mx-auto max-w-[1200px] px-6 py-24">
        <p className="label-caps text-[#999]">Best Sellers</p>
        <h2 className="narrative mt-3 max-w-2xl text-[54px]">The spa at home, crafted for daily rituals.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {AREAS.map((a) => (
            <article key={a.title} className={`media-card scrim min-h-[320px] bg-gradient-to-br ${a.grad} p-8 flex flex-col justify-end`}>
              <span className="badge-glass absolute right-6 top-6">{a.badge}</span>
              <div className="relative z-10">
                <h3 className="text-[21px] font-medium">{a.title}</h3>
                <p className="mt-2 text-[16px] text-white/70">{a.copy}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-8 flex gap-4">
          <Link href="/catalog" className="btn-cream">Shop best sellers</Link>
          <Link href="/planner" className="btn-ghost">Open 2D planner</Link>
        </div>
      </section>

      {/* Bath areas */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <div className="card grid gap-px overflow-hidden p-8 md:grid-cols-3 md:p-12">
          {[
            { t: "Basin Area", d: "Basins, faucets, mirrors and vanities composed as one." },
            { t: "Showering Area", d: "Showers, diverters, digital showering and bathtubs." },
            { t: "Toilet Area", d: "Toilets, smart toilets, bidet seats and cisterns." },
          ].map((c) => (
            <div key={c.t} className="p-6">
              <p className="label-caps text-[#999]">Area</p>
              <h3 className="mt-2 text-[30px] font-light tracking-[-0.75px]">{c.t}</h3>
              <p className="mt-2 text-[16px] text-white/70">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Design flow */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <p className="label-caps text-[#999]">How it works</p>
        <h2 className="display mt-3 text-[57px]">Steam. Soak. Shower. in <span className="serif-accent">bold</span>.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            { n: "01", t: "Describe", d: "Dimensions, photos, budget, style and rituals." },
            { n: "02", t: "Compose", d: "Real Kohler products matched to your constraints." },
            { n: "03", t: "Arrange", d: "Drag, rotate and snap on the 2D planner with clearances." },
            { n: "04", t: "Keep", d: "Budget recalculated, versions saved and shared." },
          ].map((s) => (
            <div key={s.n} className="card p-6">
              <p className="label-caps text-[#999]">{s.n}</p>
              <h3 className="mt-2 text-[20px] font-medium">{s.t}</h3>
              <p className="mt-2 text-[16px] text-white/70">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex gap-4">
          <Link href="/design/new" className="btn-cream">Find a store</Link>
          <Link href="/budget" className="btn-ghost">Estimate budget</Link>
        </div>
      </section>
    </>
  );
}
