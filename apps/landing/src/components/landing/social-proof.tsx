"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { idealPara } from "@/lib/content";
import { fadeUp } from "@/lib/animations";

export function SocialProof() {
  return (
    <SectionWrapper id="social-proof" className="bg-[#F9F8F4]">
      <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
        <FadeIn className="max-w-xl">
          <span className={`text-sm font-semibold uppercase tracking-[0.18em] ${idealPara.badgeColor}`}>
            {idealPara.badge}
          </span>
          <h2 className="mt-3 font-display text-section-mobile font-semibold text-text-strong md:text-section">
            {idealPara.title}
          </h2>
          <p className="mt-6 max-w-lg text-sm leading-7 text-gray-medium sm:text-base">
            {idealPara.closing}
          </p>
        </FadeIn>

        <div className="space-y-4">
          {idealPara.items.map((item, index) => (
            <motion.div
              key={item}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-64px" }}
              transition={{ delay: index * 0.08 }}
              className="grid grid-cols-[22px_1fr] gap-4 rounded-[24px] border border-[#EBEDF3] bg-white/92 px-5 py-4 shadow-[0_14px_36px_rgba(17,19,24,0.04)]"
            >
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-ink/80" />
              <p className="text-base leading-7 text-text-strong">{item}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
