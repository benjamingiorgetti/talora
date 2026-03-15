"use client";

import { motion } from "framer-motion";
import { XCircle } from "lucide-react";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { problem } from "@/lib/content";
import { fadeUp, staggerContainer } from "@/lib/animations";

export function Problem() {
  return (
    <SectionWrapper id="problema" className="bg-surface-cool py-10 sm:py-14 md:py-20">
      <FadeIn>
        <div className="mx-auto max-w-2xl text-center">
          <span className={`text-sm font-semibold ${problem.badgeColor} uppercase tracking-wider`}>
            {problem.badge}
          </span>
          <h2 className="mt-2 font-display text-section-mobile md:text-section font-semibold text-text-strong">
            {problem.title}
          </h2>
        </div>
      </FadeIn>

      <motion.ul
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-64px" }}
        className="mt-8 sm:mt-12 mx-auto max-w-xl space-y-2"
      >
        {problem.painPoints.map((point) => (
          <motion.li
            key={point}
            variants={fadeUp}
            className="flex items-start gap-3 rounded-xl bg-rose/40 border border-[#E2E4EC]/60 px-4 py-3 sm:px-5 sm:py-4"
          >
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <span className="text-base text-gray-medium">{point}</span>
          </motion.li>
        ))}
      </motion.ul>

    </SectionWrapper>
  );
}
