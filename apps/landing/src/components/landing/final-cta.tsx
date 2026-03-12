"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { finalCta } from "@/lib/content";

export function FinalCTA() {
  return (
    <SectionWrapper className="relative bg-gradient-to-b from-ink to-[#111318] overflow-hidden">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid-light" />

      <FadeIn>
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="font-display text-section-mobile md:text-section font-semibold text-white">
            {finalCta.headline}
          </h2>
          <p className="mt-4 text-sm sm:text-base md:text-body-lg text-white/50">
            {finalCta.subheadline}
          </p>
          <div className="mt-6 sm:mt-8">
            <Button size="lg" variant="invert" className="w-full sm:w-auto hover:shadow-lg hover:shadow-white/10 transition-shadow" asChild>
              <a href={finalCta.ctaHref}>{finalCta.cta}</a>
            </Button>
          </div>
          <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6">
            {finalCta.trust.map((item) => (
              <span
                key={item}
                className="flex items-center gap-2 text-xs sm:text-sm text-white/50"
              >
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/60" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </FadeIn>
    </SectionWrapper>
  );
}
