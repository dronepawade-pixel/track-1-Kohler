import Link from "next/link";
import KohlerLogo from "./KohlerLogo";
import { Pressable } from "./motion";

const LINKS = [
  { href: "/catalog", label: "Bathroom" },
  { href: "/saved", label: "Saved Designs" },
  { href: "/design/new?mode=3d", label: "Design" },
  { href: "/design/new?mode=2d", label: "Planner" },
];

export default function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        <Link href="/" aria-label="Kohler home" className="text-white transition-opacity hover:opacity-85">
          <KohlerLogo className="h-9 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-4">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="text-[15px] font-medium text-white/90 hover:text-white transition-opacity">
              {l.label}
            </Link>
          ))}
        </nav>
        <Pressable>
          <Link href="/design/new?mode=3d" className="btn-cream btn-arrow !py-2.5 text-[15px]">
            Start your design <span aria-hidden className="btn-arrow-glyph">→</span>
          </Link>
        </Pressable>
      </div>
    </header>
  );
}
