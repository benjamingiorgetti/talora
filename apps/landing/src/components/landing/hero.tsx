"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Video, Paperclip, Mic, TrendingUp, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hero } from "@/lib/content";
import { fadeUp, scaleIn, slideFromRight, float } from "@/lib/animations";

// ─── Conversation data ──────────────────────────────────────────────────────

interface Message {
  from: "user" | "bot";
  text: string;
  time: string;
}

const CONVERSATION: Message[] = [
  { from: "user", text: "Hola! Quiero un turno para color y brushing", time: "14:28" },
  { from: "bot", text: "Hola! Para color y brushing tengo jueves a las 10:30 o viernes a las 15:00. Cual te queda mejor?", time: "14:28" },
  { from: "user", text: "Viernes a las 15:00", time: "14:29" },
  { from: "bot", text: "Perfecto! Te reservo color y brushing el viernes a las 15:00. Si queres, tambien podes sumar cejas y perfilado en el mismo turno.", time: "14:29" },
  { from: "user", text: "Si, sumalo!", time: "14:30" },
  { from: "bot", text: "Listo! Color, brushing + cejas y perfilado el viernes a las 15:00. Te envio un recordatorio antes.", time: "14:30" },
];

// ─── SVG check marks ──────────────────────────────────────────────────────────

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

// ─── Typing indicator ──────────────────────────────────────────────────────────

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

// ─── WhatsApp mockup ──────────────────────────────────────────────────────────

function WhatsAppMockup() {
  const [renderedMsgs, setRenderedMsgs] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ids: ReturnType<typeof setTimeout>[] = [];

    const msgs = CONVERSATION;

    // Build timeline with absolute delays — play once, no loop
    const timeline: { delay: number; action: () => void }[] = [];
    let t = 1200;

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      if (msg.from === "user") {
        timeline.push({
          delay: t,
          action: () => {
            if (!cancelled) setRenderedMsgs((prev) => [...prev, msg]);
          },
        });
        t += 1000;
      } else {
        timeline.push({
          delay: t,
          action: () => {
            if (!cancelled) setIsTyping(true);
          },
        });
        t += 1800;
        timeline.push({
          delay: t,
          action: () => {
            if (!cancelled) {
              setIsTyping(false);
              setRenderedMsgs((prev) => [...prev, msg]);
            }
          },
        });
        t += 900;
      }
    }

    for (const { delay, action } of timeline) {
      ids.push(setTimeout(action, delay));
    }

    return () => {
      cancelled = true;
      ids.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="relative">
      {/* iPhone frame */}
      <div className="relative w-[220px] h-[500px] sm:w-[240px] sm:h-[480px] rounded-[40px] sm:rounded-[44px] bg-gradient-to-b from-[#3A3442] to-[#2C2B33] p-[12px] shadow-2xl flex-shrink-0">
        {/* Side buttons — volume (left) */}
        <div className="absolute -left-[3px] top-[72px] h-[28px] w-[3px] rounded-l-sm bg-[#232029]" />
        <div className="absolute -left-[3px] top-[110px] h-[44px] w-[3px] rounded-l-sm bg-[#232029]" />
        <div className="absolute -left-[3px] top-[162px] h-[44px] w-[3px] rounded-l-sm bg-[#232029]" />
        {/* Side button — power (right) */}
        <div className="absolute -right-[3px] top-[120px] h-[60px] w-[3px] rounded-r-sm bg-[#232029]" />

        {/* Screen area */}
        <div className="relative h-full rounded-[30px] sm:rounded-[34px] overflow-hidden bg-[#ECE5DD] flex flex-col">
          {/* Dynamic Island */}
          <div className="absolute top-[8px] left-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
            <div className="w-[90px] h-[28px] rounded-full bg-black flex items-center justify-end pr-[10px]">
              <div className="h-[10px] w-[10px] rounded-full bg-[#1a1a2e] ring-1 ring-[#2a2a3e]" />
            </div>
          </div>

          {/* WhatsApp header */}
          <div className="flex items-center gap-2 bg-[#075E54] px-3 pt-[44px] pb-3 flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img src="/images/icono-blanco.png" alt="Talora" className="h-5 w-5 object-contain" />
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

          {/* Messages area */}
          <div className="flex-1 flex flex-col gap-1.5 px-3 py-3 overflow-hidden">
            {renderedMsgs.map((msg, i) => (
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
                  className={`relative rounded-2xl px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-[12px] leading-relaxed ${
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

// ─── Results panel data ───────────────────────────────────────────────────────

interface Metric {
  label: string;
  value: string;
  sub?: string;
  type: "number" | "progress";
  progress?: number;
  color: string;
}

const METRICS: Metric[] = [
  {
    label: "Turnos esta semana",
    value: "47",
    sub: "+8 vs semana anterior",
    type: "number",
    color: "text-emerald-600",
  },
  {
    label: "Clientas reactivadas",
    value: "12",
    sub: "en los ultimos 30 dias",
    type: "number",
    color: "text-violet-600",
  },
  {
    label: "Ocupacion",
    value: "89%",
    type: "progress",
    progress: 89,
    color: "text-sky-600",
  },
  {
    label: "Ticket promedio",
    value: "+23%",
    sub: "vs mes anterior",
    type: "number",
    color: "text-amber-600",
  },
];

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedCounter({ value, delay = 0 }: { value: string; delay?: number }) {
  const [display, setDisplay] = useState("0");
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const prefix = value.startsWith("+") ? "+" : "";
    const suffix = value.endsWith("%") ? "%" : "";
    const num = parseInt(value.replace(/[^0-9]/g, ""), 10);
    if (isNaN(num)) { setDisplay(value); return; }

    const duration = 800;
    const startTime = performance.now() + delay * 1000;

    function tick(now: number) {
      const elapsed = now - startTime;
      if (elapsed < 0) { requestAnimationFrame(tick); return; }
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * num);
      setDisplay(`${prefix}${current}${suffix}`);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [value, delay]);

  return <>{display}</>;
}

// ─── Results panel mockup ──────────────────────────────────────────────────────

function ResultsPanelMockup() {
  return (
    <div className="w-full max-w-[280px] sm:max-w-[300px] rounded-2xl border border-[#E2E4EC] bg-white shadow-card overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.4 }}
        className="flex items-center justify-between px-4 py-3 border-b border-[#E2E4EC]"
      >
        <div>
          <p className="text-[13px] font-semibold text-[#1C1D22]">Resultados</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Semana del 9 al 15 de marzo</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-medium text-emerald-700">en vivo</span>
        </div>
      </motion.div>

      {/* Metrics grid */}
      <div className="p-4 flex flex-col gap-3">
        {METRICS.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 1.2 + i * 0.18,
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">{metric.label}</span>
              <div className="flex items-center gap-1">
                <TrendingUp className={`h-3 w-3 ${metric.color}`} />
                <span className={`text-[13px] font-semibold ${metric.color}`}>
                  <AnimatedCounter value={metric.value} delay={1.2 + i * 0.18} />
                </span>
              </div>
            </div>

            {metric.type === "progress" && metric.progress !== undefined && (
              <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${metric.progress}%` }}
                  transition={{
                    delay: 1.4 + i * 0.18,
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="h-full rounded-full bg-sky-400"
                />
              </div>
            )}

            {metric.sub && (
              <span className="text-[10px] text-gray-400">{metric.sub}</span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Footer row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.0, duration: 0.35 }}
        className="px-4 py-3 border-t border-[#E2E4EC] bg-[#FAFAFA] flex items-center gap-1.5"
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
        <span className="text-[10px] text-gray-500">
          Talora atendio <span className="font-semibold text-gray-700">23 consultas</span> esta semana sin intervension manual
        </span>
      </motion.div>
    </div>
  );
}

// ─── Hero stagger ──────────────────────────────────────────────────────────────

const heroStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

// ─── Hero export ───────────────────────────────────────────────────────────────

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#f8f9fc]">
      {/* Subtle radial gradient */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,_rgba(239,233,255,0.12)_0%,_rgba(232,246,235,0.08)_40%,_transparent_70%)] pointer-events-none" />

      <div className="container mx-auto max-w-[1200px] px-4 sm:px-6 pb-10 pt-4 sm:pb-16 sm:pt-8 md:pb-20 md:pt-16">
        <motion.div
          variants={heroStagger}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center lg:flex-row lg:items-center lg:gap-16 lg:text-left"
        >
          {/* ── Left column: text ── */}
          <div className="flex flex-col items-center lg:items-start lg:w-1/2 lg:flex-shrink-0">
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
              className="mt-5 max-w-lg text-base sm:text-body-lg text-gray-medium"
            >
              {hero.subheadline}
            </motion.p>

            {/* CTAs */}
            <motion.div variants={fadeUp} className="mt-7 sm:mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <a
                  href={hero.ctaPrimaryHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {hero.ctaPrimary}
                </a>
              </Button>
              <Button size="lg" variant="secondary" className="w-full sm:w-auto" asChild>
                <a href={hero.ctaSecondaryHref}>{hero.ctaSecondary}</a>
              </Button>
            </motion.div>

            {/* Microcopy pills */}
            <motion.div
              variants={fadeUp}
              className="mt-4 flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-1.5"
            >
              {hero.microcopy.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-2 text-[13px] font-medium text-gray-medium"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  {item}
                </span>
              ))}
            </motion.div>
          </div>

          {/* ── Right column: mockups ── */}
          <motion.div
            variants={scaleIn}
            className="relative mt-12 sm:mt-14 lg:mt-0 lg:w-1/2 lg:flex-shrink-0"
          >
            {/* Background glow */}
            <div className="absolute inset-0 sm:-m-8 md:-m-12 rounded-3xl bg-gradient-to-b from-surface-cool via-surface-cool/50 to-transparent" />
            {/* Dot grid background */}
            <div className="absolute inset-0 sm:-m-4 md:-m-8 dot-grid opacity-40 rounded-3xl" />

            <div className="relative flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-6">
              <WhatsAppMockup />

              <motion.div
                variants={slideFromRight}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-64px" }}
                className="block"
              >
                <ResultsPanelMockup />
              </motion.div>
            </div>

            {/* Floating card 1 — Agenda del dia (lilac, top-right) */}
            <motion.div
              animate={{ y: [-6, 6] }}
              transition={{ y: { duration: 2.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" } }}
              className="hidden lg:flex floating-card absolute -top-4 -right-6 items-center gap-2 px-3.5 py-2 bg-lilac"
            >
              <span className="h-2 w-2 rounded-full bg-violet-400 flex-shrink-0" />
              <span className="text-xs font-medium text-[#1C1D22] whitespace-nowrap">Agenda del dia</span>
            </motion.div>

            {/* Floating card 2 — 4h ahorradas (sand, bottom-left) */}
            <motion.div
              animate={{ y: [-6, 6] }}
              transition={{ y: { duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" } }}
              className="hidden lg:flex floating-card absolute -bottom-4 -left-6 items-center gap-2 px-3.5 py-2 bg-sand"
            >
              <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
              <span className="text-xs font-medium text-[#1C1D22] whitespace-nowrap">4h ahorradas esta semana</span>
            </motion.div>

            {/* Floating card 3 — Online 24/7 (mint, bottom-right) */}
            <motion.div
              animate={{ y: [-6, 6] }}
              transition={{ y: { duration: 3.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" } }}
              className="hidden lg:flex floating-card absolute bottom-16 -right-6 items-center gap-2 px-3.5 py-2 bg-mint"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className="text-xs font-medium text-[#1C1D22] whitespace-nowrap">Online 24/7</span>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
