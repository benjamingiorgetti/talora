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
        <h2 className="mx-auto max-w-2xl text-center font-display text-section-mobile md:text-section font-semibold text-text-strong">
          {faq.title}
        </h2>
      </FadeIn>

      <FadeIn>
        <div className="mx-auto mt-8 sm:mt-12 max-w-2xl">
          <Accordion type="single" collapsible className="w-full">
            {faq.items.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="rounded-2xl border border-[#E2E4EC] px-5 py-1 mb-4 bg-[#f8f9fc] border-b-0"
              >
                <AccordionTrigger className="text-left text-sm sm:text-base font-medium font-body text-ink hover:text-ink/80 transition-colors">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </FadeIn>
    </SectionWrapper>
  );
}
