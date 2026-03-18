"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { idealPara } from "@/lib/content";
import { fadeUp, staggerContainer } from "@/lib/animations";

export function SocialProof() {
  return (
    <SectionWrapper id="social-proof" className="bg-surface-cool">
      <FadeIn>
        <div className="mx-auto max-w-2xl text-center">
          <span className={`text-sm font-semibold ${idealPara.badgeColor} uppercase tracking-wider`}>
            {idealPara.badge}
          </span>
          <h2 className="mt-2 font-display text-section-mobile md:text-section font-semibold text-text-strong">
            {idealPara.title}
          </h2>
        </div>
      </FadeIn>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-64px" }}
        className="mt-8 sm:mt-10 flex flex-col items-center gap-3 sm:gap-4 max-w-md mx-auto"
      >
        {idealPara.items.map((item) => (
          <motion.div
            key={item}
            variants={fadeUp}
            className="flex items-center gap-3 text-base sm:text-body-lg text-ink"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <span>{item}</span>
          </motion.div>
        ))}
      </motion.div>
    </SectionWrapper>
  );
}
