"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hero } from "@/lib/content";
import { fadeUp, staggerContainer } from "@/lib/animations";

const conversations = [
  {
    niche: "Peluqueria",
    messages: [
      { from: "user", text: "Hola! Quiero un turno para corte" },
      { from: "bot", text: "Hola! Tengo manana 10:00, 14:30 o 17:00. Cual te va?" },
      { from: "user", text: "14:30" },
      { from: "bot", text: "Listo! Turno confirmado manana 14:30. Te mando recordatorio!" },
    ],
  },
  {
    niche: "Tatuaje",
    messages: [
      { from: "user", text: "Quiero agendar una sesion" },
      { from: "bot", text: "Tengo jueves 11:00 o viernes 16:00. Cual preferis?" },
      { from: "user", text: "Jueves a las 11" },
      { from: "bot", text: "Agendado jueves 11:00. Recorda traer la referencia!" },
    ],
  },
  {
    niche: "Dentista",
    messages: [
      { from: "user", text: "Necesito turno para limpieza" },
      { from: "bot", text: "Tengo lunes 9:30 o miercoles 15:00. Te sirve alguno?" },
      { from: "user", text: "Lunes 9:30" },
      { from: "bot", text: "Confirmado lunes 9:30 con Dra. Martinez!" },
    ],
  },
  {
    niche: "Manicuria",
    messages: [
      { from: "user", text: "Hola! Turno para semi-permanente" },
      { from: "bot", text: "Manana tengo 10:00 o 16:30. Que te viene mejor?" },
      { from: "user", text: "16:30" },
      { from: "bot", text: "Agendado! Semi-permanente manana 16:30. Nos vemos!" },
    ],
  },
];

function WhatsAppMockup() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % conversations.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      {/* iPhone frame */}
      <div className="relative w-[240px] sm:w-[270px] md:w-[290px] rounded-[42px] sm:rounded-[50px] bg-gradient-to-b from-[#3A3442] to-[#2C2B33] p-[10px] sm:p-[12px] shadow-2xl">
        {/* Side buttons — volume (left) */}
        <div className="absolute -left-[3px] top-[72px] h-[28px] w-[3px] rounded-l-sm bg-[#2C2B33]" />
        <div className="absolute -left-[3px] top-[110px] h-[44px] w-[3px] rounded-l-sm bg-[#2C2B33]" />
        <div className="absolute -left-[3px] top-[162px] h-[44px] w-[3px] rounded-l-sm bg-[#2C2B33]" />
        {/* Side button — power (right) */}
        <div className="absolute -right-[3px] top-[120px] h-[60px] w-[3px] rounded-r-sm bg-[#2C2B33]" />

        {/* Screen area */}
        <div className="relative rounded-[40px] overflow-hidden bg-white">
          {/* Dynamic Island */}
          <div className="absolute top-[8px] left-1/2 -translate-x-1/2 z-10 flex items-center justify-center">
            <div className="w-[75px] h-[24px] sm:w-[90px] sm:h-[28px] rounded-full bg-black flex items-center justify-end pr-[10px]">
              <div className="h-[10px] w-[10px] rounded-full bg-[#1a1a2e] ring-1 ring-[#2a2a3e]" />
            </div>
          </div>

          {/* WhatsApp header */}
          <div className="flex items-center gap-3 bg-ink px-4 pt-[44px] pb-3">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-semibold">
              T
            </div>
            <div>
              <p className="text-sm font-medium text-white">Talora</p>
              <p className="text-[11px] text-white/60">en linea</p>
            </div>
            <div className="ml-auto flex items-center gap-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </div>
          </div>

          {/* Niche badge */}
          <div className="flex items-center justify-center py-2 bg-[#F8F9FC] border-b border-[#E2E4EC]/60">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-[11px] font-medium text-gray-medium bg-white rounded-full px-3 py-0.5 border border-[#E2E4EC]"
              >
                {conversations[currentIndex].niche}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Messages */}
          <div className="flex flex-col gap-2 p-3 bg-[#F8F9FC] min-h-[200px] sm:min-h-[240px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-2"
              >
                {conversations[currentIndex].messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.35, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] sm:text-[13px] leading-relaxed ${
                      msg.from === "user"
                        ? "self-end bg-mint text-ink"
                        : "self-start bg-white text-ink border border-[#E2E4EC] shadow-sm"
                    }`}
                  >
                    {msg.text}
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center py-2 bg-[#F8F9FC]">
            <div className="w-[100px] h-[4px] rounded-full bg-black/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

const appointments = [
  { top: "0%", height: "25%", color: "bg-lilac/60", name: "Ana - Consulta" },
  { top: "25%", height: "18.75%", color: "bg-sand/60", name: "Diego - Masaje" },
  { top: "50%", height: "25%", color: "bg-mint/60", name: "Belen - Peinado" },
  { top: "62.5%", height: "25%", color: "bg-sky/60", name: "Juan - Corte" },
];

const hours = ["11:00", "12:00", "13:00", "14:00"];

function DashboardMockup() {
  return (
    <div className="w-full max-w-[260px] sm:max-w-[290px] md:max-w-[320px] rounded-2xl border border-[#E2E4EC] bg-white shadow-xl shadow-ink/5 ring-1 ring-black/[0.03] overflow-hidden -rotate-1">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="flex items-center justify-between px-4 py-3 border-b border-[#E2E4EC]"
      >
        <div>
          <p className="font-display text-base font-semibold text-ink">Marzo 2026</p>
          <p className="text-[10px] text-gray-medium mt-0.5">Hoy: jueves 12</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-medium text-emerald-600">En vivo</span>
        </div>
      </motion.div>

      {/* Stat mini-cards */}
      <div className="flex gap-2 px-4 py-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="flex-1 rounded-xl bg-lilac/50 px-3 py-2.5"
        >
          <p className="text-[10px] text-gray-medium">Turnos hoy</p>
          <p className="font-display text-lg font-bold text-ink">5</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="flex-1 rounded-xl bg-sky/50 px-3 py-2.5"
        >
          <p className="text-[10px] text-gray-medium">Proximo</p>
          <p className="font-display text-lg font-bold text-ink">14:30</p>
        </motion.div>
      </div>

      {/* Timeline / Agenda */}
      <div className="bg-[#F8F9FC] px-4 py-3 relative h-[160px] sm:h-[180px] md:h-[200px]">
        {/* Hour labels + grid lines */}
        {hours.map((hour, i) => (
          <div
            key={hour}
            className="absolute left-4 flex items-start gap-2"
            style={{ top: `${(i / 4) * 100}%` }}
          >
            <span className="text-[9px] text-gray-soft w-7 shrink-0 -translate-y-1">{hour}</span>
            <div className="absolute left-9 right-4 h-px bg-[#E2E4EC]/60" />
          </div>
        ))}

        {/* Appointment blocks */}
        <div className="absolute left-14 right-4 top-0 bottom-0">
          {appointments.map((apt, i) => (
            <motion.div
              key={apt.name}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1 + i * 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className={`absolute left-0 right-0 ${apt.color} rounded-lg px-2.5 py-1.5 border border-black/[0.04]`}
              style={{ top: apt.top, height: apt.height }}
            >
              <p className="text-[11px] font-medium text-ink truncate">{apt.name}</p>
            </motion.div>
          ))}

          {/* "Now" red line at ~13:15 position (56.25% through the 11:00-15:00 range) */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 2.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 right-0 origin-left"
            style={{ top: "56.25%" }}
          >
            <div className="relative flex items-center">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-[5px] shrink-0" />
              <div className="flex-1 h-[1.5px] bg-red-500" />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="container mx-auto max-w-[1200px] px-4 sm:px-6 pb-10 pt-4 sm:pb-14 sm:pt-12 md:pb-20 md:pt-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center"
        >
          {/* Badge */}
          <motion.div variants={fadeUp}>
            <Badge variant="outline" className="mb-4 sm:mb-6">
              {hero.badge}
            </Badge>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="font-display text-hero-mobile md:text-hero font-semibold text-text-strong max-w-3xl"
          >
            {hero.headline.before}
            <span className="border-b-[3px] border-mint pb-0.5">
              {hero.headline.highlight}
            </span>
            {hero.headline.after}
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeUp}
            className="mt-4 max-w-xl text-base sm:text-body-lg text-gray-medium"
          >
            {hero.subheadline}
          </motion.p>

          {/* CTAs */}
          <motion.div variants={fadeUp} className="mt-6 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <a href={hero.ctaPrimaryHref}>{hero.ctaPrimary}</a>
            </Button>
            <Button size="lg" variant="secondary" className="w-full sm:w-auto" asChild>
              <a href={hero.ctaSecondaryHref}>{hero.ctaSecondary}</a>
            </Button>
          </motion.div>

          {/* Mockup composition */}
          <motion.div
            variants={fadeUp}
            className="relative mt-8 sm:mt-12 md:mt-16"
          >
            {/* Background glow */}
            <div className="absolute inset-0 -m-4 sm:-m-8 md:-m-12 rounded-3xl bg-gradient-to-b from-surface-cool via-surface-cool/50 to-transparent" />
            {/* Dot grid background */}
            <div className="absolute inset-0 -m-2 sm:-m-4 md:-m-8 dot-grid opacity-40 rounded-3xl" />

            <div className="relative flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-10">
              <WhatsAppMockup />
              {/* Connector */}
              <div className="hidden md:flex flex-col items-center gap-2 text-gray-soft">
                <svg width="48" height="24" viewBox="0 0 48 24" fill="none">
                  <path d="M0 12h40m0 0l-6-6m6 6l-6 6" stroke="#E2E4EC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4" />
                </svg>
              </div>
              <div className="hidden text-gray-soft py-1">
                <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
                  <path d="M12 0v24m0 0l-6-6m6 6l6-6" stroke="#E2E4EC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <DashboardMockup />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
