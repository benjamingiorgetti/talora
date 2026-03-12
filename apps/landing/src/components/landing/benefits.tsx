"use client";

import { motion } from "framer-motion";
import { MessageCircle, Bot, CalendarDays, Users } from "lucide-react";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { benefits } from "@/lib/content";
import { fadeUp, staggerContainer } from "@/lib/animations";

const iconMap = {
  MessageCircle,
  Bot,
  CalendarDays,
  Users,
} as const;

const colorConfig = {
  mint: { bg: "bg-mint", hover: "hover:bg-mint/30", accent: "bg-mint" },
  sky: { bg: "bg-sky", hover: "hover:bg-sky/30", accent: "bg-sky" },
  sand: { bg: "bg-sand", hover: "hover:bg-sand/30", accent: "bg-sand" },
  lilac: { bg: "bg-lilac", hover: "hover:bg-lilac/30", accent: "bg-lilac" },
} as const;

export function Benefits() {
  return (
    <SectionWrapper id="beneficios" style={{ background: "linear-gradient(135deg, rgba(231,245,251,0.4) 0%, rgba(239,233,255,0.4) 50%, rgba(255,243,230,0.4) 100%)" }}>
      <FadeIn>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-section-mobile md:text-section font-semibold text-text-strong">
            {benefits.title}
          </h2>
          <p className="mt-4 text-body-lg text-gray-medium">
            {benefits.subtitle}
          </p>
        </div>
      </FadeIn>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-64px" }}
        className="mt-16 grid gap-6 sm:grid-cols-2"
      >
        {benefits.items.map((item) => {
          const Icon = iconMap[item.icon];
          const colors = colorConfig[item.color];
          return (
            <motion.div
              key={item.title}
              variants={fadeUp}
              className={`group relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-white/70 shadow-lg shadow-black/[0.04] p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-ink/5 ${colors.hover}`}
            >
              {/* Top accent line */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${colors.accent}`} />
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${colors.bg}`}
              >
                <Icon size={22} className="text-ink" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-text-strong">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-medium">
                {item.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </SectionWrapper>
  );
}
