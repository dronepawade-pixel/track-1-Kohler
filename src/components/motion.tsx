"use client";
import { motion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

// Design-system easing: slow-out, weighted and premium (design.md motion philosophy).
// Standard durations 0.2–0.3s. No springs, no bounce.
export const EASE: [number, number, number, number] = [0.625, 0.05, 0, 1];

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export function FadeUp({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.3, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function Pressable({ children }: { children: ReactNode }) {
  return (
    <motion.span
      style={{ display: "inline-block" }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2, ease: EASE }}
    >
      {children}
    </motion.span>
  );
}

export function Lift({ children }: { children: ReactNode }) {
  return (
    <motion.span
      style={{ display: "block" }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: EASE }}
    >
      {children}
    </motion.span>
  );
}
