"use client";

import { motion, type Variants } from "framer-motion";
import { fadeUp } from "@/lib/animations";

interface FadeInProps {
  children: React.ReactNode;
  variants?: Variants;
  className?: string;
  delay?: number;
}

export function FadeIn({
  children,
  variants = fadeUp,
  className,
  delay = 0,
}: FadeInProps) {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-64px" }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
