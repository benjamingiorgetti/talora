"use client";

import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faq } from "@/lib/content";

export function FAQ() {
  return (
    <SectionWrapper id="faq" className="bg-white">
      <FadeIn>
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-soft">
            {faq.eyebrow}
          </span>
          <h2 className="mt-3 font-display text-section-mobile font-semibold text-text-strong md:text-section">
            {faq.title}
          </h2>
        </div>
      </FadeIn>

      <FadeIn>
        <div className="mx-auto mt-10 max-w-3xl sm:mt-12">
          <Accordion type="single" collapsible className="w-full">
            {faq.items.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="mb-4 rounded-[24px] border border-[#E9ECF3] bg-[#FBFBFC] px-6 py-1 shadow-[0_14px_34px_rgba(17,19,24,0.04)] border-b-0"
              >
                <AccordionTrigger className="text-left font-body text-sm font-medium text-text-strong transition-colors hover:text-text-strong/80 sm:text-base">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </FadeIn>
    </SectionWrapper>
  );
}
