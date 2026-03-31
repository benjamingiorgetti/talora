"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { queCambia } from "@/lib/content";
import { fadeUp } from "@/lib/animations";

const surfaceMap = {
  mint: "bg-mint/70 border-[#DCEFE1]",
  lilac: "bg-lilac/70 border-[#E6DCF8]",
  sand: "bg-sand/75 border-[#EEDFC4]",
} as const;

export function QueCambia() {
  return (
    <SectionWrapper id="que-cambia" className="bg-white">
      <FadeIn>
        <div className="mx-auto max-w-3xl text-center">
          <span className={`text-sm font-semibold uppercase tracking-[0.18em] ${queCambia.badgeColor}`}>
            {queCambia.badge}
          </span>
          <h2 className="mt-3 font-display text-section-mobile font-semibold text-text-strong md:text-section">
            {queCambia.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-medium sm:text-body-lg">
            {queCambia.subtitle}
          </p>
        </div>
      </FadeIn>

      <div className="mt-12 grid gap-5 md:grid-cols-12">
        {queCambia.items.map((item, index) => (
          <motion.article
            key={item.eyebrow}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: index * 0.08 }}
            className={`rounded-[28px] border border-[#E8EAF1] bg-[#FCFCFD] p-6 shadow-[0_18px_48px_rgba(17,19,24,0.05)] ${
              index === 0 ? "md:col-span-7" : "md:col-span-5"
            }`}
          >
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-soft">
                  {item.eyebrow}
                </p>
                <p className="mt-3 max-w-[30ch] text-lg font-medium leading-8 text-text-strong">
                  {item.title}
                </p>
              </div>

              <div className={`rounded-[24px] border p-4 ${surfaceMap[item.color as keyof typeof surfaceMap]}`}>
                <div className="rounded-[20px] border border-white/80 bg-white/80 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-strong">{item.previewTitle}</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-gray-medium">
                      Talora
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-gray-medium">{item.previewMeta}</p>
                  <div className="mt-4 inline-flex rounded-full bg-[#F5F6FA] px-3 py-1.5 text-[11px] font-medium text-text-strong">
                    {item.previewStatus}
                  </div>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </SectionWrapper>
  );
}
