"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  Video,
  Paperclip,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hero } from "@/lib/content";
import { fadeUp, scaleIn, staggerContainer, slideFromRight } from "@/lib/animations";

// ─── Conversation data ──────────────────────────────────────────────────────

interface Message {
  from: "user" | "bot";
  text: string;
  time: string;
}

interface Conversation {
  niche: string;
  messages: Message[];
}

const conversations: Conversation[] = [
  {
    niche: "Peluqueria",
    messages: [
      { from: "user", text: "Hola! Quiero un turno para corte", time: "14:28" },
      { from: "bot", text: "Hola! Tengo disponible manana a las 10:00, 14:30 o 17:00. Cual te queda mas comodo?", time: "14:28" },
      { from: "user", text: "14:30 perfecto", time: "14:29" },
      { from: "bot", text: "Perfecto! Queda confirmado tu turno para manana a las 14:30. Te voy a enviar un recordatorio antes", time: "14:29" },
    ],
  },
  {
    niche: "Tatuaje",
    messages: [
      { from: "user", text: "Quiero agendar una sesion", time: "11:02" },
      { from: "bot", text: "Hola! Para sesion de tatuaje tengo jueves 11:00 o viernes 16:00. Cual te viene mejor?", time: "11:02" },
      { from: "user", text: "Jueves a las 11", time: "11:03" },
      { from: "bot", text: "Genial! Queda agendado para el jueves a las 11:00. No te olvides de traer tu referencia!", time: "11:03" },
    ],
  },
  {
    niche: "Dentista",
    messages: [
      { from: "user", text: "Necesito turno para limpieza", time: "09:15" },
      { from: "bot", text: "Hola! Para limpieza dental tengo lunes 9:30 o miercoles 15:00. Cual preferis?", time: "09:15" },
      { from: "user", text: "Lunes 9:30", time: "09:16" },
      { from: "bot", text: "Listo! Tu turno queda confirmado el lunes 9:30 con la Dra. Martinez. Te esperamos!", time: "09:16" },
    ],
  },
  {
    niche: "Manicuria",
    messages: [
      { from: "user", text: "Hola! Turno para semi-permanente", time: "16:44" },
      { from: "bot", text: "Hola! Para semi-permanente tengo manana a las 10:00 o 16:30. Cual te queda mejor?", time: "16:44" },
      { from: "user", text: "16:30 genial!", time: "16:45" },
      { from: "bot", text: "Perfecto! Queda confirmado manana a las 16:30. Te esperamos!", time: "16:45" },
    ],
  },
];

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

// ─── WhatsApp mockup ─────────────────────────────────────────────────────────

function WhatsAppMockup() {
  const [convIndex, setConvIndex] = useState(0);
  const [renderedMsgs, setRenderedMsgs] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ids: ReturnType<typeof setTimeout>[] = [];

    // Reset state for new conversation
    setRenderedMsgs([]);
    setIsTyping(false);

    const msgs = conversations[convIndex].messages;

    // Build timeline with absolute delays
    const timeline: { delay: number; action: () => void }[] = [];
    let t = 500;

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      if (msg.from === "user") {
        timeline.push({ delay: t, action: () => {
          if (!cancelled) setRenderedMsgs((prev) => [...prev, msg]);
        }});
        t += 700;
      } else {
        timeline.push({ delay: t, action: () => {
          if (!cancelled) setIsTyping(true);
        }});
        t += 1300;
        timeline.push({ delay: t, action: () => {
          if (!cancelled) {
            setIsTyping(false);
            setRenderedMsgs((prev) => [...prev, msg]);
          }
        }});
        t += 900;
      }
    }

    // After all messages: clear and advance to next conversation
    timeline.push({ delay: t + 2000, action: () => {
      if (!cancelled) setConvIndex((prev) => (prev + 1) % conversations.length);
    }});

    // Schedule all at once
    for (const { delay, action } of timeline) {
      ids.push(setTimeout(action, delay));
    }

    return () => {
      cancelled = true;
      ids.forEach(clearTimeout);
    };
  }, [convIndex]);

  return (
    <div className="relative">
      {/* iPhone frame */}
      <div className="relative w-[280px] h-[560px] rounded-[50px] bg-gradient-to-b from-[#3A3442] to-[#2C2B33] p-[12px] shadow-2xl flex-shrink-0">
        {/* Side buttons — volume (left) */}
        <div className="absolute -left-[3px] top-[72px] h-[28px] w-[3px] rounded-l-sm bg-[#232029]" />
        <div className="absolute -left-[3px] top-[110px] h-[44px] w-[3px] rounded-l-sm bg-[#232029]" />
        <div className="absolute -left-[3px] top-[162px] h-[44px] w-[3px] rounded-l-sm bg-[#232029]" />
        {/* Side button — power (right) */}
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
              <p className="text-[10px] text-white/70 mt-0.5">en linea</p>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <Video className="h-4 w-4 text-white/80" />
              <Phone className="h-4 w-4 text-white/80" />
            </div>
          </div>

          {/* Messages area — always present in DOM for stable flex layout */}
          <div className="flex-1 flex flex-col gap-1.5 px-3 py-3 overflow-hidden">
            {renderedMsgs.map((msg, i) => (
              <motion.div
                key={`${convIndex}-${i}`}
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

// ─── Calendar event data ──────────────────────────────────────────────────────

interface CalEvent {
  col: number;
  startMin: number;
  durationMin: number;
  label: string;
  color: string;
}

const calEvents: CalEvent[] = [
  { col: 0, startMin: 60, durationMin: 60, label: "Ana — Consulta", color: "bg-[#EFE9FF] border-[#C4B5FD]" },
  { col: 0, startMin: 180, durationMin: 60, label: "Laura — Masaje", color: "bg-[#FFF5E0] border-[#FCD34D]" },
  { col: 1, startMin: 120, durationMin: 60, label: "Diego — Masaje", color: "bg-[#FFF5E0] border-[#FCD34D]" },
  { col: 1, startMin: 240, durationMin: 90, label: "Sofia — Tratamiento", color: "bg-[#FFE4E6] border-[#FCA5A5]" },
  { col: 2, startMin: 60, durationMin: 60, label: "Carlos — Corte", color: "bg-[#E0F2FE] border-[#7DD3FC]" },
  { col: 2, startMin: 180, durationMin: 60, label: "Paula — Consulta", color: "bg-[#EFE9FF] border-[#C4B5FD]" },
  { col: 3, startMin: 30, durationMin: 60, label: "Belen — Peinado", color: "bg-[#E6F9EE] border-[#6EE7B7]" },
  { col: 3, startMin: 300, durationMin: 60, label: "Juan — Corte", color: "bg-[#E0F2FE] border-[#7DD3FC]" },
  { col: 4, startMin: 0, durationMin: 60, label: "Lucas — Barba", color: "bg-[#E6F9EE] border-[#6EE7B7]" },
  { col: 4, startMin: 120, durationMin: 120, label: "Maria — Color", color: "bg-[#FFE4E6] border-[#FCA5A5]" },
];

const GRID_HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];
const GRID_MINUTES = 360;

const dayHeaders = [
  { short: "LUN", num: "9", isToday: false },
  { short: "MAR", num: "10", isToday: false },
  { short: "MIE", num: "11", isToday: false },
  { short: "JUE", num: "12", isToday: true },
  { short: "VIE", num: "13", isToday: false },
];

const NOW_TOP_PCT = (255 / GRID_MINUTES) * 100;

function DashboardMockup() {
  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-[#E2E4EC] bg-white shadow-xl shadow-ink/5 ring-1 ring-black/[0.03] overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="flex items-center justify-between px-4 py-3 border-b border-[#E2E4EC]"
      >
        <div className="flex items-center gap-2">
          <button aria-hidden="true" tabIndex={-1} className="rounded-md px-2 py-0.5 text-[11px] font-medium bg-[#F3F4F6] text-gray-600 hover:bg-[#E5E7EB] transition-colors">
            Hoy
          </button>
          <ChevronLeft className="h-4 w-4 text-gray-400 cursor-pointer" />
          <ChevronRight className="h-4 w-4 text-gray-400 cursor-pointer" />
          <span className="text-[13px] font-semibold text-gray-800">Marzo 2026</span>
        </div>
        <div className="flex items-center gap-0.5 rounded-full bg-[#F3F4F6] p-0.5">
          {["Dia", "Semana", "Mes"].map((v) => (
            <span
              key={v}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                v === "Semana"
                  ? "bg-[#1C1B22] text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {v}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Day headers */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.35 }}
        className="flex border-b border-[#E2E4EC]"
      >
        <div className="w-10 flex-shrink-0" />
        {dayHeaders.map((d) => (
          <div
            key={d.short}
            className="flex-1 flex flex-col items-center py-1.5 gap-0.5"
          >
            <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wide">
              {d.short}
            </span>
            <span
              className={`text-[12px] font-semibold flex items-center justify-center h-5 w-5 rounded-full ${
                d.isToday
                  ? "bg-[#1C1B22] text-white"
                  : "text-gray-700"
              }`}
            >
              {d.num}
            </span>
          </div>
        ))}
      </motion.div>

      {/* Time grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.35 }}
        className="flex"
        style={{ height: 216 }}
      >
        <div className="w-10 flex-shrink-0 flex flex-col relative">
          {GRID_HOURS.map((h, i) => (
            <div
              key={h}
              className="absolute left-0 right-0 flex justify-end pr-1"
              style={{ top: `${(i / (GRID_HOURS.length - 1)) * 100}%`, transform: "translateY(-50%)" }}
            >
              <span className="text-[8px] text-gray-400 leading-none">{h}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 flex relative">
          {GRID_HOURS.map((h, i) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-[#F0F0F0]"
              style={{ top: `${(i / (GRID_HOURS.length - 1)) * 100}%` }}
            />
          ))}

          {dayHeaders.map((d, colIdx) => (
            <div
              key={d.short}
              className={`flex-1 relative ${colIdx < dayHeaders.length - 1 ? "border-r border-[#F0F0F0]" : ""}`}
            >
              {calEvents
                .filter((e) => e.col === colIdx)
                .map((evt, ei) => {
                  const topPct = (evt.startMin / GRID_MINUTES) * 100;
                  const heightPct = (evt.durationMin / GRID_MINUTES) * 100;
                  return (
                    <motion.div
                      key={ei}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 1.0 + colIdx * 0.12 + ei * 0.1,
                        duration: 0.35,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className={`absolute inset-x-0.5 ${evt.color} rounded border-l-[2px] px-1 py-0.5 overflow-hidden`}
                      style={{
                        top: `${topPct}%`,
                        height: `${heightPct}%`,
                      }}
                    >
                      <p className="text-[9px] font-medium text-gray-700 leading-tight truncate">
                        {evt.label}
                      </p>
                    </motion.div>
                  );
                })}
            </div>
          ))}

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 2.0, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 right-0 origin-left pointer-events-none z-10"
            style={{ top: `${NOW_TOP_PCT}%` }}
          >
            <div className="relative flex items-center" style={{ marginLeft: "60%", marginRight: "0%" }}>
              <div className="h-2 w-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
              <div className="flex-1 h-[1.5px] bg-red-500" />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Hero stagger ─────────────────────────────────────────────────────────────

const heroStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

// ─── Hero export ──────────────────────────────────────────────────────────────

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Subtle radial gradient behind mockup area */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,_rgba(239,233,255,0.15)_0%,_rgba(232,246,235,0.1)_40%,_transparent_70%)] pointer-events-none" />

      <div className="container mx-auto max-w-[1200px] px-4 sm:px-6 pb-10 pt-4 sm:pb-14 sm:pt-12 md:pb-20 md:pt-24">
        <motion.div
          variants={heroStagger}
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
              <a href={hero.ctaSecondaryHref} target="_blank" rel="noopener noreferrer">{hero.ctaSecondary}</a>
            </Button>
          </motion.div>

          {/* Mockup composition */}
          <motion.div
            variants={scaleIn}
            className="relative mt-8 sm:mt-12 md:mt-16"
          >
            {/* Background glow */}
            <div className="absolute inset-0 sm:-m-8 md:-m-12 rounded-3xl bg-gradient-to-b from-surface-cool via-surface-cool/50 to-transparent" />
            {/* Dot grid background */}
            <div className="absolute inset-0 sm:-m-4 md:-m-8 dot-grid opacity-40 rounded-3xl" />

            <div className="relative flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-10">
              <WhatsAppMockup />

              {/* Connector arrow */}
              <div className="hidden md:flex flex-col items-center gap-2 text-gray-soft">
                <svg width="48" height="24" viewBox="0 0 48 24" fill="none">
                  <path d="M0 12h40m0 0l-6-6m6 6l-6 6" stroke="#E2E4EC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4" />
                </svg>
              </div>

              <motion.div
                variants={slideFromRight}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-64px" }}
                className="hidden sm:block"
              >
                <DashboardMockup />
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
