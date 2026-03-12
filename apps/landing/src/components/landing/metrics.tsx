"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
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

// Typewriter effect: reveals characters one at a time
function TypewriterValue({ value, inView }: { value: string; inView: boolean }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (!inView) return;
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(value.slice(0, i));
      if (i >= value.length) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [inView, value]);

  return <>{inView ? displayed : value}</>;
}

export function Metrics() {
  const statsRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(statsRef, { once: true, margin: "-64px" });

  return (
    <SectionWrapper className="relative py-16 sm:py-24 md:py-32" style={{ background: "linear-gradient(135deg, rgba(239,233,255,0.5) 0%, rgba(231,245,251,0.5) 50%, rgba(232,246,235,0.5) 100%)" }}>
      <FadeIn>
        <div className="mx-auto max-w-2xl text-center">
          <span className={`text-sm font-semibold ${metrics.badgeColor} uppercase tracking-wider`}>
            {metrics.badge}
          </span>
          <h2 className="mt-2 font-display text-section-mobile md:text-section font-semibold text-text-strong">
            {metrics.title}
          </h2>
        </div>
      </FadeIn>

      {/* Stats */}
      <motion.div
        ref={statsRef}
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
              <TypewriterValue value={stat.value} inView={isInView} />
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
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 rounded-full bg-white/50 backdrop-blur-lg border border-white/60 shadow-sm px-3 py-1.5 sm:px-4 sm:py-2 transition-shadow duration-200 hover:shadow-md cursor-default"
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
