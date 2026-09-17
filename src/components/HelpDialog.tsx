"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EASE } from "./motion";

const SUPPORT_EMAIL = "devraj.pawade@mitwpu.edu.in";

export default function HelpDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[16px] text-[#999] transition-colors hover:text-white"
      >
        Help
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <div
              aria-hidden
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Support"
              className="card relative w-full max-w-md p-8"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <p className="label-caps text-[#999]">Help & support</p>
              <h3 className="mt-2 text-[30px] font-light tracking-[-0.75px]">
                Talk to a human.
              </h3>
              <p className="mt-2 text-[16px] text-white/70">
                Questions about your bathroom design? Reach us at:
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-4 block break-all text-[16px] font-medium text-white hover:opacity-85"
              >
                {SUPPORT_EMAIL}
              </a>
              <div className="mt-6 flex gap-4">
                <a href={`mailto:${SUPPORT_EMAIL}`} className="btn-cream">
                  Email support
                </a>
                <button onClick={() => setOpen(false)} className="btn-ghost">
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
