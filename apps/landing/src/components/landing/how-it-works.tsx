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
          <p className="mt-4 text-body-lg text-gray-medium">
            {howItWorks.subtitle}
          </p>
        </div>
      </FadeIn>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-64px" }}
        className="mt-16 grid gap-12 md:grid-cols-3 md:gap-6 relative"
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
                <div className="md:hidden absolute -top-6 left-1/2 h-6 border-l-2 border-dashed border-[#E2E4EC]" />
              )}
              {/* Number circle with ring */}
              <div className="relative z-10 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-ink text-white ring-4 ring-surface-cool">
                <Icon size={28} strokeWidth={1.5} />
              </div>
              <span className="mt-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-cool font-display text-xs font-semibold text-ink">
                {step.number}
              </span>
              <h3 className="mt-3 font-display text-lg font-semibold text-text-strong">
                {step.title}
              </h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-medium">
                {step.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </SectionWrapper>
  );
}
