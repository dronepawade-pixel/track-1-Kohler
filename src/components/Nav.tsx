import Link from "next/link";

const LINKS = [
  { href: "/catalog", label: "Bathroom" },
  { href: "/catalog", label: "Kitchen" },
  { href: "/saved", label: "Inspiration" },
  { href: "/design/new", label: "Design" },
  { href: "/planner", label: "Planner" },
];

export default function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        <Link href="/" className="text-[15px] font-medium tracking-[0.08em]">
          KOHLER <span className="text-[#999] font-normal">/ The Bold Look</span>
        </Link>
        <nav className="hidden md:flex items-center gap-4">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="text-[15px] font-medium text-white/90 hover:text-white transition-opacity">
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/design/new" className="btn-cream !py-2.5 text-[15px]">
          Shop Best Sellers
        </Link>
      </div>
    </header>
  );
}
