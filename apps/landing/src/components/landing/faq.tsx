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
    <SectionWrapper id="faq" className="bg-surface-cool">
      <FadeIn>
        <h2 className="mx-auto max-w-2xl text-center font-display text-section-mobile md:text-section font-semibold text-text-strong">
          {faq.title}
        </h2>
      </FadeIn>

      <FadeIn>
        <div className="mx-auto mt-8 sm:mt-12 max-w-2xl">
          <Accordion type="single" collapsible className="w-full">
            {faq.items.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-sm sm:text-base text-text-strong hover:text-ink transition-colors">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-medium">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </FadeIn>
    </SectionWrapper>
  );
}
