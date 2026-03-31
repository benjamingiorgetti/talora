"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { howItWorks } from "@/lib/content";
import { fadeUp } from "@/lib/animations";

export function HowItWorks() {
  return (
    <SectionWrapper id="como-funciona" className="bg-white">
      <FadeIn>
        <div className="mx-auto max-w-3xl text-center">
          <span className={`text-sm font-semibold uppercase tracking-[0.18em] ${howItWorks.badgeColor}`}>
            {howItWorks.badge}
          </span>
          <h2 className="mt-3 font-display text-section-mobile font-semibold text-text-strong md:text-section">
            {howItWorks.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-medium sm:text-body-lg">
            {howItWorks.subtitle}
          </p>
        </div>
      </FadeIn>

      <div className="relative mt-12">
        <div className="absolute left-[17%] right-[17%] top-5 hidden border-t border-[#DDE2EB] md:block" />

        <div className="grid gap-6 md:grid-cols-3 md:gap-10">
          {howItWorks.steps.map((step, index) => (
            <motion.article
              key={step.number}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-64px" }}
              transition={{ delay: index * 0.08 }}
              className="relative rounded-[26px] border border-[#E4E8F0] bg-[#FCFCFD] px-6 py-6 text-center shadow-[0_14px_40px_rgba(17,19,24,0.04)] md:bg-white/85 md:shadow-[0_12px_30px_rgba(17,19,24,0.035)]"
            >
              <div className="relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#DADFE8] bg-white text-sm font-semibold text-text-strong shadow-sm">
                {step.number}
              </div>
              <h3 className="mt-5 text-lg font-medium text-text-strong">{step.title}</h3>
              <p className="mx-auto mt-3 max-w-[24ch] text-sm leading-7 text-gray-medium">
                {step.description}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
