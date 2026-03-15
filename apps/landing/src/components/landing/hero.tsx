"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Phone,
  Video,
  Paperclip,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hero } from "@/lib/content";
import { fadeUp, scaleIn, slideFromRight } from "@/lib/animations";

// ─── Single conversation (scroll-driven, no loop) ───────────────────────────

interface Message {
  from: "user" | "bot";
  text: string;
  time: string;
}

const messages: Message[] = [
  { from: "user", text: "Hola! Soy Martín, quiero un turno para corte", time: "14:28" },
  { from: "bot", text: "¡Hola Martín! Tengo disponible mañana a las 10:00, 14:30 o 17:00. ¿Cuál te queda más cómodo?", time: "14:28" },
  { from: "user", text: "14:30 perfecto", time: "14:29" },
  { from: "bot", text: "¡Perfecto Martín! Queda confirmado tu turno para mañana a las 14:30. Te voy a enviar un recordatorio antes", time: "14:29" },
];

// The event that appears in the calendar after all messages
const bookedAppointment = {
  time: "14:30",
  name: "Martín Pérez",
  service: "Corte de pelo",
};

// ─── SVG check marks ─────────────────────────────────────────────────────────

function DoubleCheck({ className }: { className?: string }) {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className={className}>
      <path d="M1 5.5L3.5 8L8 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 5.5L7.5 8L12 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SingleCheck({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={className}>
      <path d="M1.5 5.5L4 8L8.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Typing indicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="self-start flex items-end gap-1 bg-white rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm border border-[#E2E4EC]/80"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-gray-400"
          animate={{ y: [0, -4, 0] }}
          transition={{
            duration: 0.7,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  );
}

// ─── WhatsApp mockup (scroll-driven) ─────────────────────────────────────────

function WhatsAppMockup({ visibleCount, isTyping }: { visibleCount: number; isTyping: boolean }) {
  const visibleMsgs = messages.slice(0, visibleCount);

  return (
    <div className="relative">
      {/* iPhone frame */}
      <div className="relative w-[260px] sm:w-[280px] h-[520px] sm:h-[560px] rounded-[50px] bg-gradient-to-b from-[#3A3442] to-[#2C2B33] p-[12px] shadow-2xl flex-shrink-0">
        {/* Side buttons */}
        <div className="absolute -left-[3px] top-[72px] h-[28px] w-[3px] rounded-l-sm bg-[#232029]" />
        <div className="absolute -left-[3px] top-[110px] h-[44px] w-[3px] rounded-l-sm bg-[#232029]" />
        <div className="absolute -left-[3px] top-[162px] h-[44px] w-[3px] rounded-l-sm bg-[#232029]" />
        <div className="absolute -right-[3px] top-[120px] h-[60px] w-[3px] rounded-r-sm bg-[#232029]" />

        {/* Screen area */}
        <div className="relative h-full rounded-[40px] overflow-hidden bg-[#ECE5DD] flex flex-col">
          {/* Dynamic Island */}
          <div className="absolute top-[8px] left-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
            <div className="w-[90px] h-[28px] rounded-full bg-black flex items-center justify-end pr-[10px]">
              <div className="h-[10px] w-[10px] rounded-full bg-[#1a1a2e] ring-1 ring-[#2a2a3e]" />
            </div>
          </div>

          {/* WhatsApp header */}
          <div className="flex items-center gap-2 bg-[#075E54] px-3 pt-[44px] pb-3 flex-shrink-0">
            <ChevronLeft className="h-5 w-5 text-white/80" />
            <div className="h-8 w-8 rounded-full bg-[#25D366]/30 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              T
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white leading-none">Talora</p>
              <p className="text-[10px] text-white/70 mt-0.5">en línea</p>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <Video className="h-4 w-4 text-white/80" />
              <Phone className="h-4 w-4 text-white/80" />
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 flex flex-col gap-1.5 px-3 py-3 overflow-hidden justify-end">
            {visibleMsgs.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={`flex flex-col max-w-[82%] ${
                  msg.from === "user" ? "self-end items-end" : "self-start items-start"
                }`}
              >
                <div
                  className={`relative rounded-2xl px-3 py-1.5 text-[12px] leading-relaxed ${
                    msg.from === "user"
                      ? "bg-[#DCF8C6] text-[#111] rounded-br-sm"
                      : "bg-white text-[#111] rounded-bl-sm shadow-sm"
                  }`}
                >
                  <span>{msg.text}</span>
                  <span className="flex items-center gap-0.5 mt-0.5 justify-end">
                    <span className="text-[9px] text-gray-400">{msg.time}</span>
                    {msg.from === "user" && (
                      <DoubleCheck className="text-[#34B7F1] w-[14px] h-[9px]" />
                    )}
                    {msg.from === "bot" && (
                      <SingleCheck className="text-gray-400 w-[9px] h-[9px]" />
                    )}
                  </span>
                </div>
              </motion.div>
            ))}

            <AnimatePresence>
              {isTyping && <TypingIndicator />}
            </AnimatePresence>
          </div>

          {/* Input bar */}
          <div className="flex items-center gap-2 px-2 py-2 bg-[#F0F0F0] border-t border-black/[0.06] flex-shrink-0">
            <Paperclip className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[11px] text-gray-400 border border-gray-200">
              Mensaje
            </div>
            <Mic className="h-5 w-5 text-gray-400 flex-shrink-0" />
          </div>

          {/* Home indicator */}
          <div className="flex justify-center py-1.5 bg-[#F0F0F0] flex-shrink-0">
            <div className="w-[100px] h-[4px] rounded-full bg-black/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Agenda Calendar ─────────────────────────────────────────────────────────

interface AgendaEvent {
  time: string;
  name: string;
  service: string;
  dotColor: string;
  bgColor: string;
}

const agendaEvents: AgendaEvent[] = [
  { time: "09:00", name: "Ana García", service: "Consulta", dotColor: "bg-violet-400", bgColor: "bg-violet-50" },
  { time: "10:30", name: "Diego López", service: "Masaje relajante", dotColor: "bg-amber-400", bgColor: "bg-amber-50" },
  { time: "12:00", name: "Laura Méndez", service: "Masaje descontracturante", dotColor: "bg-amber-400", bgColor: "bg-amber-50" },
  { time: "14:00", name: "Carlos Ruiz", service: "Corte de pelo", dotColor: "bg-sky-400", bgColor: "bg-sky-50" },
];

function CalendarAgenda({ showBooked }: { showBooked: boolean }) {
  return (
    <div className="w-[320px] sm:w-[360px] rounded-2xl border border-[#E2E4EC] bg-white shadow-xl shadow-ink/5 ring-1 ring-black/[0.03] overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="px-5 py-4 border-b border-[#E2E4EC]"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold text-gray-800">Jueves 12 de Marzo</p>
            <p className="text-[12px] text-gray-400 mt-0.5">
              {showBooked ? "5" : "4"} turnos agendados
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium text-emerald-600">Google Calendar</span>
          </div>
        </div>
      </motion.div>

      {/* Event list */}
      <div className="px-4 py-3 space-y-2">
        {agendaEvents.map((evt, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + i * 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={`flex items-center gap-3 rounded-xl ${evt.bgColor} px-4 py-3 border border-black/[0.04]`}
          >
            <div className={`h-2.5 w-2.5 rounded-full ${evt.dotColor} flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-800 truncate">{evt.name}</p>
              <p className="text-[11px] text-gray-500">{evt.service}</p>
            </div>
            <span className="text-[12px] font-medium text-gray-500 tabular-nums flex-shrink-0">{evt.time}</span>
          </motion.div>
        ))}

        {/* Booked appointment from WhatsApp */}
        <AnimatePresence>
          {showBooked && (
            <motion.div
              key="booked"
              initial={{ opacity: 0, scale: 0.9, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 border-2 border-emerald-300 ring-4 ring-emerald-100 shadow-md shadow-emerald-100/50"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="h-2.5 w-2.5 rounded-full bg-emerald-500 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-semibold text-emerald-800 truncate">{bookedAppointment.name}</p>
                  <motion.span
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 400 }}
                    className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full flex-shrink-0"
                  >
                    Nuevo
                  </motion.span>
                </div>
                <p className="text-[11px] text-emerald-600">{bookedAppointment.service}</p>
              </div>
              <span className="text-[12px] font-semibold text-emerald-700 tabular-nums flex-shrink-0">{bookedAppointment.time}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Simple connector arrow ──────────────────────────────────────────────────

function ConnectorArrow() {
  return (
    <div className="flex flex-col items-center text-gray-soft">
      <div className="hidden md:block">
        <svg width="48" height="24" viewBox="0 0 48 24" fill="none">
          <path d="M0 12h40m0 0l-6-6m6 6l-6 6" stroke="#E2E4EC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4" />
        </svg>
      </div>
      <div className="md:hidden py-2">
        <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
          <path d="M12 0v24m0 0l-5-5m5 5l5-5" stroke="#E2E4EC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4" />
        </svg>
      </div>
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

const heroStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

// Scroll container adds this much extra height for the animation.
// Must be enough for all steps to complete but not so much that mockups disappear.
const SCROLL_EXTRA = 400;

export function Hero() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [showBooked, setShowBooked] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStepRef = useRef(-1);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const rect = scrollRef.current.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    if (scrollable <= 0) return;

    // progress: 0 when top of scroll container hits top of viewport
    //           1 when bottom of scroll container hits bottom of viewport
    const progress = Math.max(0, Math.min(1, -rect.top / scrollable));

    let step = -1;
    if (progress >= 0.10) step = 0;  // user msg 1
    if (progress >= 0.30) step = 1;  // bot msg 2 (with typing)
    if (progress >= 0.50) step = 2;  // user msg 3
    if (progress >= 0.65) step = 3;  // bot msg 4 (with typing)
    if (progress >= 0.85) step = 4;  // booked event

    if (step <= prevStepRef.current) return;

    if (step <= 3) {
      const msg = messages[step];
      if (msg.from === "bot") {
        setIsTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        prevStepRef.current = step;
        typingTimerRef.current = setTimeout(() => {
          setIsTyping(false);
          setVisibleCount(step + 1);
        }, 600);
      } else {
        prevStepRef.current = step;
        setVisibleCount(step + 1);
      }
    } else if (step === 4) {
      prevStepRef.current = step;
      setShowBooked(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [handleScroll]);

  return (
    <>
      {/* Part 1: Static hero text */}
      <section className="bg-white">
        <div className="container mx-auto max-w-[1200px] px-4 sm:px-6 pt-4 sm:pt-12 md:pt-24 pb-6 sm:pb-8">
          <motion.div
            variants={heroStagger}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center text-center"
          >
            <motion.div variants={fadeUp}>
              <Badge variant="outline" className="mb-4 sm:mb-6">
                {hero.badge}
              </Badge>
            </motion.div>

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

            <motion.p
              variants={fadeUp}
              className="mt-4 max-w-xl text-base sm:text-body-lg text-gray-medium"
            >
              {hero.subheadline}
            </motion.p>

            <motion.div variants={fadeUp} className="mt-6 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <a href={hero.ctaPrimaryHref}>{hero.ctaPrimary}</a>
              </Button>
              <Button size="lg" variant="secondary" className="w-full sm:w-auto" asChild>
                <a href={hero.ctaSecondaryHref}>{hero.ctaSecondary}</a>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Part 2: Scroll-driven mockup section
           The tall container creates scrollable space.
           The sticky div keeps mockups centered on screen while scrolling.
           overflow-hidden on the section clips mockups cleanly when exiting. */}
      <section
        ref={scrollRef}
        className="relative bg-white"
        style={{ height: `calc(100vh + ${SCROLL_EXTRA}px)` }}
      >
        <div className="sticky top-0 h-screen flex items-center justify-center px-4 sm:px-6 pointer-events-none">
          <div className="pointer-events-auto flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-10">
            <WhatsAppMockup visibleCount={visibleCount} isTyping={isTyping} />
            <ConnectorArrow />
            <CalendarAgenda showBooked={showBooked} />
          </div>
        </div>
      </section>
    </>
  );
}
