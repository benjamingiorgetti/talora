"use client";

import { motion } from "framer-motion";
import { XCircle } from "lucide-react";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { problem } from "@/lib/content";
import { fadeUp, staggerContainer } from "@/lib/animations";

const colorMap = {
  lilac: "bg-lilac",
  sand: "bg-sand",
  sky: "bg-sky",
} as const;

type ColorKey = keyof typeof colorMap;

export function Problem() {
  return (
    <SectionWrapper id="problema" className="bg-surface-cool">
      <div className="flex flex-col lg:flex-row lg:items-start lg:gap-12">
        <FadeIn className="lg:w-2/5 lg:sticky lg:top-24">
          <div className="text-center lg:text-left">
            <span className={`text-sm font-semibold ${problem.badgeColor} uppercase tracking-wider`}>
              {problem.badge}
            </span>
            <h2 className="mt-2 max-w-sm font-display text-section-mobile md:text-section font-semibold text-text-strong">
              {problem.title}
            </h2>
          </div>
        </FadeIn>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-64px" }}
          className="mt-10 sm:mt-12 lg:mt-0 lg:w-3/5 space-y-5"
        >
          {problem.painPoints.map((point) => {
            const bgColor = colorMap[point.color as ColorKey];
            return (
              <motion.div
                key={point.title}
                variants={fadeUp}
                className="bg-white border border-[#E2E4EC] rounded-[22px] shadow-card p-6 card-interactive flex items-start gap-4"
              >
                <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${bgColor}`}>
                  <XCircle className="h-5 w-5 text-ink" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-semibold text-ink text-base">{point.title}</p>
                  <p className="text-sm text-gray-600 leading-relaxed mt-1">{point.description}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
