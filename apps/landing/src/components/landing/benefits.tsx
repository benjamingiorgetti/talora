"use client";

import { motion } from "framer-motion";
import { MessageCircle, Bot, CalendarDays, Users } from "lucide-react";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FadeIn } from "@/components/shared/fade-in";
import { benefits } from "@/lib/content";
import { slideFromLeft, slideFromRightSpring, staggerContainer } from "@/lib/animations";

// ─── Mini Mockups ────────────────────────────────────────────────────────────

function WhatsAppMiniMockup() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-2 border-b border-[#E2E4EC]/60">
        <div className="h-5 w-5 rounded-full bg-[#25D366] flex items-center justify-center">
          <MessageCircle className="h-3 w-3 text-white" />
        </div>
        <span className="text-[10px] font-medium text-ink">WhatsApp</span>
        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </div>
      <div className="self-end ml-auto max-w-[80%] rounded-lg bg-[#DCF8C6] px-2.5 py-1.5 text-[10px] text-ink">
        Quiero un turno para mañana
      </div>
      <div className="max-w-[85%] rounded-lg bg-white px-2.5 py-1.5 text-[10px] text-ink border border-[#E2E4EC]/40 shadow-sm">
        Tengo 10:00 o 14:30. ¿Cuál te va?
      </div>
      <div className="self-end ml-auto max-w-[50%] rounded-lg bg-[#DCF8C6] px-2.5 py-1.5 text-[10px] text-ink">
        14:30!
      </div>
    </div>
  );
}

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
          <p className="text-[9px] text-gray-medium">María - Corte - 14:30</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 border border-[#E2E4EC]/40">
        <div className="h-6 w-6 rounded-full bg-sky/60 flex items-center justify-center shrink-0">
          <span className="text-[9px]">↻</span>
        </div>
        <div>
          <p className="text-[10px] font-medium text-ink">Reprogramación</p>
          <p className="text-[9px] text-gray-medium">Juan - 15:00 → 17:00</p>
        </div>
      </div>
    </div>
  );
}

function CalendarMiniMockup() {
  return (
    <div className="space-y-1.5">
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
            <p className="text-[10px] font-medium text-ink">14:30 - María</p>
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

function ProfessionalsMiniMockup() {
  return (
    <div className="rounded-xl bg-white/60 border border-[#E2E4EC]/40 p-3 space-y-2">
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
            <p className="text-[10px] font-medium text-ink">María López</p>
            <p className="text-[9px] text-gray-medium">Corte · Color · Peinado</p>
          </div>
          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
        </div>
        <div className="flex items-center gap-2.5 rounded-lg bg-white px-2.5 py-2 border border-[#E2E4EC]/40">
          <div className="h-7 w-7 rounded-full bg-sand flex items-center justify-center text-[10px] font-semibold text-ink shrink-0">
            DR
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-ink">Diego Ramírez</p>
            <p className="text-[9px] text-gray-medium">Masaje · Spa</p>
          </div>
          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
        </div>
      </div>
    </div>
  );
}

// ─── Card Components ─────────────────────────────────────────────────────────

function CardWhatsApp({ title, description }: { title: string; description: string }) {
  return (
    <motion.div
      variants={slideFromLeft}
      className="group relative overflow-hidden rounded-2xl border-l-4 border-[#25D366]/60 bg-gradient-to-br from-[#F0FFF4]/70 to-white border border-[#E2E4EC]/40 shadow-sm transition-all duration-200 card-interactive"
    >
      <div className="relative px-5 pt-5 pb-0 sm:px-6 sm:pt-6">
        <div className="rounded-xl bg-white/80 border border-[#E2E4EC]/40 p-3 shadow-sm transition-transform duration-200 group-hover:scale-[1.02]">
          <WhatsAppMiniMockup />
        </div>

        <div className="absolute bottom-0 right-5 sm:right-6 translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-mint shadow-md">
          <MessageCircle className="h-5 w-5 text-ink" />
        </div>
      </div>

      <div className="px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-7">
        <h3 className="font-display text-base sm:text-lg font-semibold text-text-strong">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-medium">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

function CardAgent({ title, description }: { title: string; description: string }) {
  return (
    <motion.div
      variants={slideFromRightSpring}
      className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-50/70 to-white border border-[#E2E4EC]/40 shadow-sm transition-all duration-200 card-interactive"
    >
      <div className="relative p-5 sm:p-6 md:p-8 flex flex-col h-full">
        {/* Icon + pulsing status */}
        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-sky">
            <Bot className="h-5 w-5 sm:h-[22px] sm:w-[22px] text-ink" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium text-emerald-600">Activo</span>
          </div>
        </div>

        <h3 className="font-display text-base sm:text-lg font-semibold text-text-strong mb-1">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-gray-medium mb-4">
          {description}
        </p>

        <div className="transition-transform duration-200 group-hover:scale-[1.02]">
          <AgentMiniMockup />
        </div>
      </div>
    </motion.div>
  );
}

function CardCalendar({ title, description }: { title: string; description: string }) {
  return (
    <motion.div
      variants={slideFromLeft}
      className="group relative overflow-hidden rounded-2xl bg-white border border-[#E2E4EC]/60 shadow-sm transition-all duration-200 card-interactive"
      style={{
        backgroundImage:
          "linear-gradient(rgba(214,179,134,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(214,179,134,0.08) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      <div className="bg-sand/40 border-b border-sand/30 px-5 py-2.5 sm:px-6 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-ink tracking-wide uppercase">
          Marzo 2026
        </span>
        <CalendarDays className="h-3.5 w-3.5 text-amber-600/70" />
      </div>

      <div className="px-5 pt-4 pb-0 sm:px-6 transition-transform duration-200 group-hover:scale-[1.02]">
        <CalendarMiniMockup />
      </div>

      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-sand mb-3">
          <CalendarDays className="h-5 w-5 sm:h-[22px] sm:w-[22px] text-ink" />
        </div>
        <h3 className="font-display text-base sm:text-lg font-semibold text-text-strong">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-medium">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

function CardProfessionals({ title, description }: { title: string; description: string }) {
  const avatars = [
    { initials: "ML", bg: "bg-lilac", textColor: "text-ink" },
    { initials: "DR", bg: "bg-sand", textColor: "text-ink" },
    { initials: "CA", bg: "bg-mint", textColor: "text-ink" },
    { initials: "PG", bg: "bg-sky", textColor: "text-ink" },
  ];

  return (
    <motion.div
      variants={slideFromRightSpring}
      className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-lilac/20 to-white border border-[#E2E4EC]/60 shadow-sm p-5 sm:p-6 md:p-8 transition-all duration-200 card-interactive"
    >
      <div className="flex items-center mb-5">
        {avatars.map((avatar, idx) => (
          <div
            key={avatar.initials}
            className={`
              relative h-10 w-10 rounded-full ${avatar.bg} ${avatar.textColor}
              flex items-center justify-center text-[11px] font-bold
              border-2 border-white shadow-sm
              transition-transform duration-200 group-hover:scale-110
            `}
            style={{
              marginLeft: idx === 0 ? 0 : "-10px",
              zIndex: avatars.length - idx,
              transitionDelay: `${idx * 30}ms`,
            }}
          >
            {avatar.initials}
          </div>
        ))}
        <span className="ml-3 text-[11px] text-gray-medium font-medium">
          {avatars.length} profesionales
        </span>
      </div>

      <div className="mb-4 transition-transform duration-200 group-hover:scale-[1.02]">
        <ProfessionalsMiniMockup />
      </div>

      <div className="inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-lilac">
        <Users className="h-5 w-5 sm:h-[22px] sm:w-[22px] text-ink" />
      </div>
      <h3 className="mt-3 sm:mt-4 font-display text-base sm:text-lg font-semibold text-text-strong">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-medium">
        {description}
      </p>
    </motion.div>
  );
}

// ─── Benefits Section ─────────────────────────────────────────────────────────

export function Benefits() {
  const cardComponents = [CardWhatsApp, CardAgent, CardCalendar, CardProfessionals];

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
          const CardComponent = cardComponents[i];
          return (
            <CardComponent
              key={item.title}
              title={item.title}
              description={item.description}
            />
          );
        })}
      </motion.div>
    </SectionWrapper>
  );
}
