"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { QrCode, Settings, CalendarCheck } from "lucide-react";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { howItWorks } from "@/lib/content";
import { fadeUp } from "@/lib/animations";

const stepIcons = [QrCode, Settings, CalendarCheck];

export function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <SectionWrapper id="como-funciona" className="bg-surface-cool">
      <FadeIn>
        <div className="mx-auto max-w-2xl text-center">
          <span className={`text-sm font-semibold ${howItWorks.badgeColor} uppercase tracking-wider`}>
            {howItWorks.badge}
          </span>
          <h2 className="mt-2 font-display text-section-mobile md:text-section font-semibold text-text-strong">
            {howItWorks.title}
          </h2>
          <p className="mt-4 text-base sm:text-body-lg text-gray-medium">
            {howItWorks.subtitle}
          </p>
        </div>
      </FadeIn>

      <div
        ref={sectionRef}
        className="mt-4 sm:mt-8 md:mt-10 grid gap-6 sm:gap-8 md:grid-cols-3 md:gap-4 relative"
      >
        {/* Animated connector line (desktop only) */}
        <div className="hidden md:block absolute top-[2.25rem] left-[20%] right-[20%]">
          <svg width="100%" height="4" viewBox="0 0 100 4" preserveAspectRatio="none">
            <motion.line
              x1="0"
              y1="2"
              x2="100"
              y2="2"
              stroke="#C8CCD4"
              strokeWidth="2.5"
              strokeDasharray="4 3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={isInView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
        </div>

        {howItWorks.steps.map((step, i) => {
          const Icon = stepIcons[i];
          // Stagger: line draws first, then each step appears sequentially
          const stepDelay = isInView ? 0.3 + i * 0.2 : 0;
          const contentDelay = stepDelay + 0.15;

          return (
            <div
              key={step.number}
              className="relative flex flex-col items-center text-center"
            >
              {/* Mobile connector line (between steps) */}
              {i > 0 && (
                <div className="md:hidden absolute -top-4 sm:-top-6 left-1/2 h-4 sm:h-6 border-l-2 border-dashed border-[#E2E4EC]" />
              )}
              {/* Number circle with ring — scales in */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                transition={{ delay: stepDelay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 flex h-12 w-12 sm:h-14 sm:w-14 md:h-14 md:w-14 items-center justify-center rounded-full bg-ink text-white ring-3 sm:ring-4 ring-white"
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 md:h-6 md:w-6" strokeWidth={1.5} />
              </motion.div>

              {/* Step number badge */}
              <motion.span
                initial={{ opacity: 0, y: 8 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                transition={{ delay: contentDelay, duration: 0.3 }}
                className="mt-3 inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-surface-cool font-display text-[10px] sm:text-xs font-semibold text-ink"
              >
                {step.number}
              </motion.span>

              {/* Content fades up after circle */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                transition={{ delay: contentDelay + 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <h3 className="mt-3 font-display text-base sm:text-lg font-bold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-[260px] sm:max-w-xs text-sm leading-relaxed text-gray-600">
                  {step.description}
                </p>
              </motion.div>
            </div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
