"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";

export function PageEntrance({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}
