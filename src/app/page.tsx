"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const AREAS = [
  { badge: "Showers", title: "Performance Showering", copy: "Rainshower and handshower rituals in marble showering areas.", src: "/images/showers.jpg", filter: "Showers" },
  { badge: "Smart Toilets", title: "The Toilet Area", copy: "Wall-hung forms with bidet seats in minimal spaces.", src: "/images/toilets.jpg", filter: "Smart Toilets" },
  { badge: "Basins", title: "The Grooming Area", copy: "Vessel basins with single-control faucets on stone vanities.", src: "/images/basins.jpg", filter: "Basins" },
  { badge: "Bathtubs", title: "Freestanding Bathtubs", copy: "Soaking zones by the window — steam, soak, shower.", src: "/images/bathtub.jpg", filter: "Bathtubs" },
];

const STRIP = ["Showers", "Smart Toilets", "New Launches", "Bathtubs", "Basins", "Faucets", "Mirrors"];

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  const toggleCraft = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <>
      {/* HERO — full-viewport cinematic video (text-free segment, no audio) */}
      <section className="film-warm scrim scrim-top relative flex min-h-[calc(100vh-4rem)] items-end overflow-hidden bg-black">
        <video
          ref={videoRef}
          src="/videos/hero-spa.mp4"
          poster="/images/hero-spa-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="metadata"
          aria-label="Kohler spa bathroom film"
          className="film-grade absolute inset-0 h-full w-full object-cover"
        />
        {/* Readability vignette — bottom scrim + left-weighted radial shade so text stands out */}
        <div
          aria-hidden
          className="absolute inset-0 z-[5] bg-gradient-to-t from-black/85 via-black/45 to-transparent"
        />
        <div
          aria-hidden
          className="absolute inset-0 z-[5]"
          style={{
            background:
              "radial-gradient(120% 90% at 18% 88%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0) 65%)",
          }}
        />
        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 pb-16">
          <p className="label-caps text-white/70 [text-shadow:0_1px_12px_rgba(0,0,0,0.9)]">Kohler Spa at Home — Steam. Soak. Shower.</p>
          <h1 className="display mt-4 max-w-4xl text-[clamp(54px,7vw,110px)] text-white [text-shadow:0_2px_30px_rgba(0,0,0,0.9),0_1px_8px_rgba(0,0,0,0.8)]">
            The <span className="serif-accent">bold</span> look, made.
          </h1>
          <p className="narrative mt-6 max-w-xl text-[20px] text-white [text-shadow:0_1px_16px_rgba(0,0,0,0.9)]">
            A spa at home after dark. Tell us your space, budget and rituals — we compose it from real Kohler products.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/design/new" className="btn-cream">Start your design</Link>
            <Link href="/catalog" className="btn-ghost">Explore collections</Link>
          </div>
        </div>
        <button onClick={toggleCraft} className="absolute bottom-8 right-8 z-10 hidden items-center gap-3 md:flex" aria-pressed={paused}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/80 text-white">{paused ? "▶" : "❚❚"}</span>
          <span className="label-caps !text-[13px] text-white/80">{paused ? "Watch the craft" : "Pause the film"}</span>
        </button>
      </section>

      {/* Marquee strip — continuous feed: each half is 4x STRIP so the line always spans the viewport */}
      <div className="overflow-hidden border-y border-[#333] py-4">
        <div className="animate-marquee flex w-max whitespace-nowrap will-change-transform">
          {[0, 1].map((half) => (
            <div key={half} aria-hidden={half === 1} className="flex shrink-0 items-center">
              {[...STRIP, ...STRIP, ...STRIP, ...STRIP].map((s, i) => (
                <span key={`${half}-${i}`} className="label-caps shrink-0 px-5 text-[#999]">{s}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Spa at home — 4-card grid */}
      <section className="mx-auto max-w-[1200px] px-6 py-24">
        <p className="label-caps text-[#999]">Bathroom Collections</p>
        <h2 className="narrative mt-3 max-w-2xl text-[54px]">The spa at home, crafted for daily rituals.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {AREAS.map((a) => (
            <Link key={a.title} href={`/catalog?category=${encodeURIComponent(a.filter)}`} className="media-card film-warm scrim group relative min-h-[320px] w-full flex flex-col justify-end overflow-hidden p-8 transition-transform duration-300 hover:-translate-y-1">
              <Image
                src={a.src}
                alt={a.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="film-grade object-cover object-center"
              />
              <span className="badge-glass absolute right-6 top-6">{a.badge}</span>
              <div className="relative z-10">
                <h3 className="text-[21px] font-medium group-hover:underline">{a.title}</h3>
                <p className="mt-2 text-[16px] text-white/70">{a.copy}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-8 flex gap-4">
          <Link href="/catalog" className="btn-cream">Explore collections</Link>
          <Link href="/planner" className="btn-ghost">Open 2D planner</Link>
        </div>
      </section>

      {/* Bath areas */}
      <section className="mx-auto max-w-[1200px] px-6 py-24">
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
          <Link href="/design/new" className="btn-cream">Start your design — set your budget</Link>
        </div>
      </section>
    </>
  );
}
