"use client";

import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import brandWhite from "../../../../../img/blanco.png";
import { Button } from "@/components/ui/button";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { finalCta } from "@/lib/content";

export function FinalCTA() {
  return (
    <SectionWrapper className="relative bg-ink overflow-hidden py-10 sm:py-14 md:py-20">

      <FadeIn>
        <div className="relative mx-auto max-w-2xl text-center">
          {/* Brand icon */}
          <Image
            src={brandWhite}
            alt="Talora"
            width={44}
            height={44}
            className="mx-auto mb-6 h-11 w-11 rounded-xl"
          />
          <h2 className="font-display text-section-mobile md:text-section font-semibold text-white">
            {finalCta.headline}
          </h2>
          <p className="mt-4 text-sm sm:text-base md:text-body-lg text-white/60">
            {finalCta.subheadline}
          </p>
          <div className="mt-6 sm:mt-8">
            <Button size="lg" variant="invert" className="w-full sm:w-auto shimmer-btn" asChild>
              <a href={finalCta.ctaHref} target="_blank" rel="noopener noreferrer">{finalCta.cta}</a>
            </Button>
          </div>
          <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6">
            {finalCta.trust.map((item) => (
              <span
                key={item}
                className="flex items-center gap-2 text-xs sm:text-sm text-white/60"
              >
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400/70" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </FadeIn>
    </SectionWrapper>
  );
}
