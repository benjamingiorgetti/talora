"use client";

import { motion } from "framer-motion";
import { CalendarCheck, UserPlus, Sparkles } from "lucide-react";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { queCambia } from "@/lib/content";
import { fadeUp, staggerContainer } from "@/lib/animations";

const colorMap = {
  mint: { bg: "bg-mint", ring: "ring-mint/30" },
  lilac: { bg: "bg-lilac", ring: "ring-lilac/30" },
  sand: { bg: "bg-sand", ring: "ring-sand/30" },
} as const;

type ColorKey = keyof typeof colorMap;

const iconMap = { CalendarCheck, UserPlus, Sparkles };
type IconKey = keyof typeof iconMap;

export function QueCambia() {
  return (
    <SectionWrapper id="que-cambia" className="bg-white">
      <FadeIn>
        <div className="mx-auto max-w-2xl text-center">
          <span className={`text-sm font-semibold ${queCambia.badgeColor} uppercase tracking-wider`}>
            {queCambia.badge}
          </span>
          <h2 className="mt-2 font-display text-section-mobile md:text-section font-semibold text-text-strong">
            {queCambia.title}
          </h2>
        </div>
      </FadeIn>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-64px" }}
        className="mt-10 sm:mt-12 grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        {queCambia.items.map((item) => {
          const Icon = iconMap[item.icon as IconKey];
          const colors = colorMap[item.color as ColorKey];
          return (
            <motion.div
              key={item.title}
              variants={fadeUp}
              className="rounded-[22px] border border-[#E2E4EC] bg-white p-6 card-interactive shadow-card flex flex-col"
            >
              <div className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${colors.bg} ring-4 ${colors.ring}`}>
                <Icon className="h-5 w-5 text-ink" strokeWidth={1.5} />
              </div>
              <span className={`mt-4 text-xs font-semibold uppercase tracking-wider text-gray-medium`}>
                {item.eyebrow}
              </span>
              <h3 className="mt-1.5 font-display text-lg font-bold text-ink">
                {item.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">
                {item.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </SectionWrapper>
  );
}
