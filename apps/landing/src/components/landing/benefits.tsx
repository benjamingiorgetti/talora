"use client";

import { motion } from "framer-motion";
import { MessageCircle, Bot, CalendarDays, Users } from "lucide-react";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { benefits } from "@/lib/content";
import { fadeUp, slideFromLeft, slideFromRight, staggerContainer } from "@/lib/animations";

const iconMap = {
  MessageCircle,
  Bot,
  CalendarDays,
  Users,
} as const;

const colorConfig = {
  mint: { bg: "bg-mint", accent: "bg-mint", mockupBg: "bg-mint/30" },
  sky: { bg: "bg-sky", accent: "bg-sky", mockupBg: "bg-sky/30" },
  sand: { bg: "bg-sand", accent: "bg-sand", mockupBg: "bg-sand/30" },
  lilac: { bg: "bg-lilac", accent: "bg-lilac", mockupBg: "bg-lilac/30" },
} as const;

// Small coded mockup: WhatsApp chat snippet
function WhatsAppMiniMockup() {
  return (
    <div className="rounded-xl bg-[#F8F9FC] border border-[#E2E4EC]/60 p-3 space-y-2">
      <div className="flex items-center gap-2 pb-2 border-b border-[#E2E4EC]/40">
        <div className="h-5 w-5 rounded-full bg-mint flex items-center justify-center">
          <MessageCircle className="h-3 w-3 text-ink" />
        </div>
        <span className="text-[10px] font-medium text-ink">WhatsApp</span>
        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </div>
      <div className="self-end ml-auto max-w-[80%] rounded-lg bg-mint px-2.5 py-1.5 text-[10px] text-ink">
        Quiero un turno para manana
      </div>
      <div className="max-w-[85%] rounded-lg bg-white px-2.5 py-1.5 text-[10px] text-ink border border-[#E2E4EC]/40 shadow-sm">
        Tengo 10:00 o 14:30. Cual te va?
      </div>
      <div className="self-end ml-auto max-w-[50%] rounded-lg bg-mint px-2.5 py-1.5 text-[10px] text-ink">
        14:30!
      </div>
    </div>
  );
}

// Small coded mockup: Notification alert
function AgentMiniMockup() {
  return (
    <div className="rounded-xl bg-[#F8F9FC] border border-[#E2E4EC]/60 p-3 space-y-2">
      <div className="flex items-center gap-2 pb-2 border-b border-[#E2E4EC]/40">
        <div className="h-5 w-5 rounded-full bg-sky flex items-center justify-center">
          <Bot className="h-3 w-3 text-ink" />
        </div>
        <span className="text-[10px] font-medium text-ink">Agente IA</span>
        <span className="ml-auto text-[9px] text-emerald-600 font-medium">Activo</span>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 border border-[#E2E4EC]/40 shadow-sm">
        <div className="h-6 w-6 rounded-full bg-mint/60 flex items-center justify-center shrink-0">
          <span className="text-[9px]">✓</span>
        </div>
        <div>
          <p className="text-[10px] font-medium text-ink">Nuevo turno agendado</p>
          <p className="text-[9px] text-gray-medium">Maria - Corte - 14:30</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 border border-[#E2E4EC]/40">
        <div className="h-6 w-6 rounded-full bg-sky/60 flex items-center justify-center shrink-0">
          <span className="text-[9px]">↻</span>
        </div>
        <div>
          <p className="text-[10px] font-medium text-ink">Reprogramacion</p>
          <p className="text-[9px] text-gray-medium">Juan - 15:00 → 17:00</p>
        </div>
      </div>
    </div>
  );
}

// Small coded mockup: Calendar day view
function CalendarMiniMockup() {
  return (
    <div className="rounded-xl bg-[#F8F9FC] border border-[#E2E4EC]/60 p-3 space-y-2">
      <div className="flex items-center justify-between pb-2 border-b border-[#E2E4EC]/40">
        <span className="text-[10px] font-medium text-ink">Jueves 12</span>
        <span className="text-[9px] text-gray-medium">3 turnos</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 rounded-lg bg-lilac/50 px-2.5 py-1.5">
          <div className="w-1 h-6 rounded-full bg-lilac" />
          <div>
            <p className="text-[10px] font-medium text-ink">10:00 - Ana</p>
            <p className="text-[9px] text-gray-medium">Consulta</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-mint/50 px-2.5 py-1.5">
          <div className="w-1 h-6 rounded-full bg-mint" />
          <div>
            <p className="text-[10px] font-medium text-ink">14:30 - Maria</p>
            <p className="text-[9px] text-gray-medium">Corte</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-sky/50 px-2.5 py-1.5">
          <div className="w-1 h-6 rounded-full bg-sky" />
          <div>
            <p className="text-[10px] font-medium text-ink">17:00 - Juan</p>
            <p className="text-[9px] text-gray-medium">Corte y barba</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small coded mockup: Professional list
function ProfessionalsMiniMockup() {
  return (
    <div className="rounded-xl bg-[#F8F9FC] border border-[#E2E4EC]/60 p-3 space-y-2">
      <div className="flex items-center justify-between pb-2 border-b border-[#E2E4EC]/40">
        <span className="text-[10px] font-medium text-ink">Equipo</span>
        <span className="text-[9px] text-gray-medium">2 activos</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2.5 rounded-lg bg-white px-2.5 py-2 border border-[#E2E4EC]/40 shadow-sm">
          <div className="h-7 w-7 rounded-full bg-lilac flex items-center justify-center text-[10px] font-semibold text-ink shrink-0">
            ML
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-ink">Maria Lopez</p>
            <p className="text-[9px] text-gray-medium">Corte · Color · Peinado</p>
          </div>
          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
        </div>
        <div className="flex items-center gap-2.5 rounded-lg bg-white px-2.5 py-2 border border-[#E2E4EC]/40">
          <div className="h-7 w-7 rounded-full bg-sand flex items-center justify-center text-[10px] font-semibold text-ink shrink-0">
            DR
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-ink">Diego Ramirez</p>
            <p className="text-[9px] text-gray-medium">Masaje · Spa</p>
          </div>
          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
        </div>
      </div>
    </div>
  );
}

const mockupComponents = [WhatsAppMiniMockup, AgentMiniMockup, CalendarMiniMockup, ProfessionalsMiniMockup];

export function Benefits() {
  return (
    <SectionWrapper id="beneficios" className="bg-surface-cool">
      <FadeIn>
        <div className="mx-auto max-w-2xl text-center">
          <span className={`text-sm font-semibold ${benefits.badgeColor} uppercase tracking-wider`}>
            {benefits.badge}
          </span>
          <h2 className="mt-2 font-display text-section-mobile md:text-section font-semibold text-text-strong">
            {benefits.title}
          </h2>
          <p className="mt-4 text-base sm:text-body-lg text-gray-medium">
            {benefits.subtitle}
          </p>
        </div>
      </FadeIn>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-64px" }}
        className="mt-6 sm:mt-12 md:mt-16 grid gap-3 sm:gap-4 md:gap-6 sm:grid-cols-2 overflow-hidden"
      >
        {benefits.items.map((item, i) => {
          const Icon = iconMap[item.icon];
          const colors = colorConfig[item.color];
          const MockupComponent = mockupComponents[i];
          const variant = i % 2 === 0 ? slideFromLeft : slideFromRight;
          return (
            <motion.div
              key={item.title}
              variants={variant}
              className="group relative overflow-hidden rounded-2xl bg-white border border-[#E2E4EC]/60 shadow-sm p-5 sm:p-6 md:p-8 transition-all duration-200 card-interactive"
            >
              {/* Top accent line */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${colors.accent}`} />

              {/* Coded mockup */}
              <div className={`mb-4 rounded-xl ${colors.mockupBg} p-3 transition-transform duration-200 group-hover:scale-[1.02]`}>
                <MockupComponent />
              </div>

              <div
                className={`inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl ${colors.bg}`}
              >
                <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px] text-ink" />
              </div>
              <h3 className="mt-3 sm:mt-5 font-display text-base sm:text-lg font-semibold text-text-strong">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-medium">
                {item.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </SectionWrapper>
  );
}
