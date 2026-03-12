"use client";

import { motion } from "framer-motion";
import { QrCode, Settings, CalendarCheck } from "lucide-react";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { howItWorks } from "@/lib/content";
import { fadeUp, staggerContainer } from "@/lib/animations";

const stepIcons = [QrCode, Settings, CalendarCheck];

export function HowItWorks() {
  return (
    <SectionWrapper id="como-funciona" className="bg-surface-cool">
      <FadeIn>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-section-mobile md:text-section font-semibold text-text-strong">
            {howItWorks.title}
          </h2>
          <p className="mt-4 text-base sm:text-body-lg text-gray-medium">
            {howItWorks.subtitle}
          </p>
        </div>
      </FadeIn>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-64px" }}
        className="mt-6 sm:mt-12 md:mt-16 grid gap-8 sm:gap-10 md:grid-cols-3 md:gap-6 relative"
      >
        {/* Connector line (desktop only) */}
        <div className="hidden md:block absolute top-[2.25rem] left-[20%] right-[20%] border-t-2 border-dashed border-[#E2E4EC]" />

        {howItWorks.steps.map((step, i) => {
          const Icon = stepIcons[i];
          return (
            <motion.div
              key={step.number}
              variants={fadeUp}
              className="relative flex flex-col items-center text-center"
            >
              {/* Mobile connector line (between steps) */}
              {i > 0 && (
                <div className="md:hidden absolute -top-4 sm:-top-6 left-1/2 h-4 sm:h-6 border-l-2 border-dashed border-[#E2E4EC]" />
              )}
              {/* Number circle with ring */}
              <div className="relative z-10 flex h-12 w-12 sm:h-14 sm:w-14 md:h-[4.5rem] md:w-[4.5rem] items-center justify-center rounded-full bg-ink text-white ring-3 sm:ring-4 ring-surface-cool">
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" strokeWidth={1.5} />
              </div>
              <span className="mt-3 inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-surface-cool font-display text-[10px] sm:text-xs font-semibold text-ink">
                {step.number}
              </span>
              <h3 className="mt-3 font-display text-base sm:text-lg font-semibold text-text-strong">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[260px] sm:max-w-xs text-sm leading-relaxed text-gray-medium">
                {step.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </SectionWrapper>
  );
}
