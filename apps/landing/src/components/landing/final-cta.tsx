"use client";

import { Button } from "@/components/ui/button";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { finalCta } from "@/lib/content";

export function FinalCTA() {
  return (
    <SectionWrapper className="bg-[#F6F4EE] py-12 sm:py-16 md:py-20">
      <FadeIn>
        <div className="mx-auto max-w-4xl rounded-[32px] border border-[#E4E7EE] bg-white px-6 py-10 text-center shadow-[0_24px_70px_rgba(17,19,24,0.06)] sm:px-10 sm:py-14">
          <h2 className="font-display text-section-mobile font-semibold text-text-strong md:text-section">
            {finalCta.headline}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-gray-medium sm:text-base md:text-body-lg">
            {finalCta.subheadline}
          </p>
          <div className="mt-8">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <a href={finalCta.ctaHref} target="_blank" rel="noopener noreferrer">
                {finalCta.cta}
              </a>
            </Button>
          </div>
          <p className="mt-5 text-sm text-gray-medium">{finalCta.supportLine}</p>
        </div>
      </FadeIn>
    </SectionWrapper>
  );
}
