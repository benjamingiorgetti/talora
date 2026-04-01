"use client";

import { cn } from "@/lib/utils";
import { type Tone, toneAccentColor, toneEmphasisBg } from "@/components/workspace/chrome";

export function DashboardKpiCard({
  label,
  value,
  delta,
  tone = "neutral",
  emphasis,
  className,
}: {
  label: string;
  value: string | number;
  delta?: string;
  tone?: Tone;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#dde1ea] px-2.5 py-1.5 pl-3",
        className
      )}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: toneAccentColor[tone],
        backgroundColor: emphasis ? toneEmphasisBg[tone] : "#ffffff",
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-700">
        {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums leading-tight tracking-[-0.02em] text-slate-950">
        {value}
      </p>
      {delta && (
        <p className="mt-0.5 text-[11px] text-slate-400">{delta}</p>
      )}
    </div>
  );
}
