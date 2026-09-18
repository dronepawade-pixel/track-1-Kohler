"use client";
import { useState } from "react";
import Link from "next/link";
import KohlerLogo from "./KohlerLogo";
import { Pressable } from "./motion";

const LINKS = [
  { href: "/catalog", label: "Bathroom" },
  { href: "/saved", label: "Saved Designs" },
  { href: "/design/new?mode=3d", label: "Design" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label="Kohler home" className="text-white transition-opacity hover:opacity-85" onClick={() => setOpen(false)}>
          <KohlerLogo className="h-8 w-auto md:h-9" />
        </Link>
        <nav className="hidden md:flex items-center gap-4">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="text-[15px] font-medium text-white/90 hover:text-white transition-opacity">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Pressable>
            <Link href="/design/new?mode=3d" className="btn-cream btn-arrow !px-4 !py-2 text-[13px] md:!px-6 md:!py-2.5 md:text-[15px]">
              Start your design <span aria-hidden className="btn-arrow-glyph">→</span>
            </Link>
          </Pressable>
          <button
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            <span className={`block h-px w-5 bg-white transition-transform duration-200 ${open ? "translate-y-[3.5px] rotate-45" : ""}`} />
            <span className={`block h-px w-5 bg-white transition-transform duration-200 ${open ? "-translate-y-[3.5px] -rotate-45" : ""}`} />
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-[#222] bg-black/95 px-4 pb-3 pt-1 backdrop-blur-md md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block border-b border-[#1a1a1a] py-3 text-[16px] font-medium text-white/90 last:border-0 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
