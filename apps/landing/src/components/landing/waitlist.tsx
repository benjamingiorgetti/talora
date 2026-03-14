"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { waitlist } from "@/lib/content";

export function Waitlist() {
  return (
    <SectionWrapper id="waitlist" className="bg-surface-cool">
      <FadeIn>
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-section-mobile md:text-section font-semibold text-text-strong">
            {waitlist.title}
          </h2>
          <p className="mt-4 text-sm sm:text-base md:text-body-lg text-gray-medium">
            {waitlist.subtitle}
          </p>

          <div className="mt-6 sm:mt-8">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              asChild
            >
              <a href={waitlist.ctaHref}>{waitlist.cta}</a>
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {waitlist.trust.map((item) => (
              <span
                key={item}
                className="flex items-center gap-2 text-xs sm:text-sm text-gray-medium"
              >
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-ink/40" />
                {item}
              </span>
            ))}
          </div>

          <p className="mt-6 text-xs sm:text-sm font-medium text-ink/50">
            {waitlist.counter}
          </p>
        </div>
      </FadeIn>
    </SectionWrapper>
  );
}
