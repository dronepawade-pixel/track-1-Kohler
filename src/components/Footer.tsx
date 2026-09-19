import Link from "next/link";
import HelpDialog from "./HelpDialog";
import AdminEditor from "./AdminEditor";

const LINKS = [
  { label: "Resources", href: "/catalog" },
  { label: "About Us", href: "/about" },
  { label: "Saved Designs", href: "/saved" },
];

export default function Footer() {
  return (
    <footer className="mx-auto max-w-[1200px] px-6 pb-16 pt-24">
      <div className="flex flex-wrap gap-x-10 gap-y-3 text-[16px] text-[#999]">
        {LINKS.map((l) => (
          <Link key={l.label} href={l.href} className="hover:text-white transition-colors">{l.label}</Link>
        ))}
        <HelpDialog />
        <AdminEditor />
      </div>
      <p className="label-caps mt-10 text-[#999]">Gracious living since 1873</p>
    </footer>
  );
}
