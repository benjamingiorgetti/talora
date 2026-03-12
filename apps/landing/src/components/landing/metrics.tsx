"use client";

import { motion } from "framer-motion";
import {
  Scissors,
  Pen,
  Stethoscope,
  Sparkles,
  Hand,
  Heart,
  Brain,
  Plus,
} from "lucide-react";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { metrics } from "@/lib/content";
import { fadeUp, staggerContainer } from "@/lib/animations";

const nicheIconMap = {
  Scissors,
  Pen,
  Stethoscope,
  Sparkles,
  Hand,
  Heart,
  Brain,
  Plus,
} as const;

// Liquid Glass — pills share a unified translucent style

export function Metrics() {
  return (
    <SectionWrapper className="relative py-12 sm:py-16 md:py-20" style={{ background: "linear-gradient(135deg, rgba(239,233,255,0.5) 0%, rgba(231,245,251,0.5) 50%, rgba(232,246,235,0.5) 100%)" }}>
      <FadeIn>
        <h2 className="mx-auto max-w-2xl text-center font-display text-section-mobile md:text-section font-semibold text-text-strong">
          {metrics.title}
        </h2>
      </FadeIn>

      {/* Stats */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-64px" }}
        className="mt-8 sm:mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-6"
      >
        {metrics.stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={fadeUp}
            className="flex flex-col items-center rounded-2xl bg-white/60 backdrop-blur-xl border border-white/70 shadow-lg shadow-black/[0.04] px-3 py-4 sm:px-4 sm:py-6 text-center"
          >
            <span className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-ink">
              {stat.value}
            </span>
            <span className="mt-1.5 text-xs sm:text-sm text-gray-medium">
              {stat.label}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* Niche pills */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-32px" }}
        className="mt-6 sm:mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5"
      >
        {metrics.niches.map((niche) => {
          const Icon = nicheIconMap[niche.icon];
          return (
            <motion.div
              key={niche.name}
              variants={fadeUp}
              className="flex items-center gap-2 rounded-full bg-white/50 backdrop-blur-lg border border-white/60 shadow-sm px-3 py-1.5 sm:px-4 sm:py-2"
            >
              <Icon size={16} className="text-ink/70 shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-ink">{niche.name}</span>
            </motion.div>
          );
        })}
      </motion.div>
    </SectionWrapper>
  );
}
