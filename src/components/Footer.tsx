import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mx-auto max-w-[1200px] px-6 pb-16 pt-24">
      <h2 className="display text-[57px]">
        The <span className="serif-accent">bold</span> look, made.
      </h2>
      <div className="mt-10 flex flex-wrap gap-x-10 gap-y-3 text-[16px] text-[#999]">
        {["Stores", "Resources", "Help", "About Us", "Saved Designs", "Budget"].map((l) => (
          <Link key={l} href="/saved" className="hover:text-white transition-colors">{l}</Link>
        ))}
      </div>
      <p className="label-caps mt-10 text-[#999]">Gracious living since 1873</p>
    </footer>
  );
}
