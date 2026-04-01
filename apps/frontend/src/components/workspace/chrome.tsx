"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "lilac" | "sky" | "sand" | "mint" | "rose";

export const toneAccentColor: Record<Tone, string> = {
  neutral: "#8b919e",
  lilac: "#7c5cbf",
  sky: "#4a8fad",
  sand: "#b08a4c",
  mint: "#4a8f5a",
  rose: "#b05a70",
};

export const toneEmphasisBg: Record<Tone, string> = {
  neutral: "#f5f6f8",
  lilac: "#f5f0ff",
  sky: "#edf7fc",
  sand: "#faf5ec",
  mint: "#eef8f0",
  rose: "#fdf2f5",
};

export const toneStyles: Record<
  Tone,
  {
    metric: string;
    icon: string;
  }
> = {
  neutral: {
    metric: "border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f6f7fb_100%)]",
    icon: "border-[#dddfe6] bg-white text-slate-800",
  },
  lilac: {
    metric: "border-[#dacbfd] bg-[linear-gradient(180deg,#f8f3ff_0%,#eadfff_100%)]",
    icon: "border-[#d3c2fa] bg-white/90 text-[#46306f]",
  },
  sky: {
    metric: "border-[#cae1f0] bg-[linear-gradient(180deg,#eef9ff_0%,#ddf1ff_100%)]",
    icon: "border-[#bdd7e8] bg-white/90 text-[#305363]",
  },
  sand: {
    metric: "border-[#e8d3b7] bg-[linear-gradient(180deg,#fcf6ed_0%,#f3dfc1_100%)]",
    icon: "border-[#dfc8a8] bg-white/90 text-[#6c5338]",
  },
  mint: {
    metric: "border-[#cee4cc] bg-[linear-gradient(180deg,#eff9ef_0%,#dbf0dd_100%)]",
    icon: "border-[#c6debf] bg-white/90 text-[#395e46]",
  },
  rose: {
    metric: "border-[#eccfd7] bg-[linear-gradient(180deg,#fff4f7_0%,#f5dbe4_100%)]",
    icon: "border-[#e7c7d2] bg-white/90 text-[#714a58]",
  },
};

export function WorkspaceMetricCard({
  label,
  value,
  caption,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "h-full rounded-[24px] border shadow-[0_14px_28px_rgba(15,23,42,0.04)] sm:rounded-[28px]",
        toneStyles[tone].metric,
        className
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <p className="mt-3 tabular-nums text-[2rem] font-semibold leading-none tracking-[-0.05em] text-slate-950 sm:text-[2.3rem]">
              {value}
            </p>
          </div>
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-[18px] border shadow-sm sm:h-14 sm:w-14 sm:rounded-[22px]", toneStyles[tone].icon)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {caption ? <p className="mt-4 text-sm leading-6 text-slate-500">{caption}</p> : null}
      </CardContent>
    </Card>
  );
}

export function WorkspaceSectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow ? <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p> : null}
        <h3 className="mt-2 font-display text-[1.8rem] leading-[0.98] text-slate-950 sm:text-3xl">{title}</h3>
        {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function WorkspaceEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-dashed border-[#d9dce6] bg-[linear-gradient(180deg,#fbfbfd_0%,#f5f6fa_100%)] px-5 py-10 text-center sm:rounded-[28px] sm:px-6 sm:py-12",
        className
      )}
    >
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
