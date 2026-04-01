"use client";

import Image from "next/image";
import brandWhite from "../../../../../img/blanco.png";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hero } from "@/lib/content";
import { fadeUp, scaleIn, slideFromRight } from "@/lib/animations";

const messages = [
  {
    from: "client",
    text: "Hola! Quiero un turno para color y brushing.",
    time: "14:28",
  },
  {
    from: "talora",
    text: "Tengo jueves 10:30 o viernes 15:00. ¿Cuál te queda mejor?",
    time: "14:28",
  },
  {
    from: "client",
    text: "Viernes 15:00.",
    time: "14:29",
  },
  {
    from: "talora",
    text: "Perfecto. Quedó confirmado para el viernes. Si querés, podés sumar cejas en el mismo turno.",
    time: "14:29",
  },
];

const agendaRows = [
  {
    time: "10:30",
    title: "Color y brushing",
    meta: "Ana · Confirmado",
    tone: "bg-mint text-emerald-700",
  },
  {
    time: "13:00",
    title: "Reactivación enviada",
    meta: "Julieta · Esperando respuesta",
    tone: "bg-lilac text-violet-700",
  },
  {
    time: "15:00",
    title: "Cejas + brushing",
    meta: "Sofi · Upsell agregado",
    tone: "bg-sand text-amber-700",
  },
];

function ProductScene() {
  return (
    <motion.div
      variants={scaleIn}
      className="relative isolate mx-auto w-full max-w-[680px]"
    >
      <div className="absolute inset-x-10 top-10 h-40 rounded-full bg-[radial-gradient(circle,_rgba(232,246,235,0.7),_transparent_72%)] blur-3xl" />
      <div className="absolute -left-4 bottom-6 h-28 w-28 rounded-full bg-[radial-gradient(circle,_rgba(239,233,255,0.9),_transparent_72%)] blur-2xl" />

      <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/88 p-4 shadow-[0_24px_80px_rgba(17,19,24,0.08)] backdrop-blur-sm sm:p-5">
        <div className="grid items-center gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[30px] bg-[#2A2D37] p-3 shadow-[0_18px_40px_rgba(17,19,24,0.18)]">
            <div className="overflow-hidden rounded-[24px] border border-black/5 bg-[#EDE3D7]">
              <div className="flex items-center gap-3 border-b border-black/5 bg-[#0D6B5C] px-4 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                  <Image
                    src={brandWhite}
                    alt="Talora"
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Talora</p>
                  <p className="text-[11px] text-white/70">en línea</p>
                </div>
              </div>

              <div className="space-y-2 px-3 py-4">
                {messages.map((message, index) => (
                  <motion.div
                    key={`${message.time}-${index}`}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-64px" }}
                    transition={{ delay: index * 0.08 }}
                    className={`max-w-[85%] rounded-[20px] px-3 py-2 text-[13px] leading-relaxed shadow-sm ${
                      message.from === "client"
                        ? "ml-auto rounded-br-md bg-[#DCF6C8] text-[#111318]"
                        : "rounded-bl-md bg-white text-[#111318]"
                    }`}
                  >
                    <p>{message.text}</p>
                    <p className="mt-1 text-[10px] text-gray-soft">{message.time}</p>
                  </motion.div>
                ))}
              </div>

              <div className="border-t border-black/5 bg-white/65 px-3 py-3">
                <div className="rounded-full border border-[#E2E4EC] bg-white px-4 py-2 text-[12px] text-gray-soft">
                  Mensaje
                </div>
              </div>
            </div>
          </div>

          <motion.div
            variants={slideFromRight}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-64px" }}
            className="rounded-[28px] border border-[#E7E9F0] bg-[#FCFCFD] p-4 shadow-[0_18px_40px_rgba(17,19,24,0.05)]"
          >
            <div className="flex items-center justify-between border-b border-[#ECEEF4] pb-4">
              <div>
                <p className="text-sm font-semibold text-text-strong">Agenda de hoy</p>
                <p className="mt-1 text-xs text-gray-medium">Viernes · Operando desde WhatsApp</p>
              </div>
              <span className="rounded-full border border-[#DCEFE1] bg-mint px-3 py-1 text-[11px] font-medium text-emerald-700">
                Agenda activa
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {agendaRows.map((row, index) => (
                <motion.div
                  key={row.time}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-64px" }}
                  transition={{ delay: 0.16 + index * 0.08 }}
                  className="grid grid-cols-[56px_1fr] items-center gap-3 rounded-[22px] border border-[#ECEEF4] bg-white px-3 py-3"
                >
                  <div className="text-sm font-semibold text-text-strong">{row.time}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-strong">{row.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${row.tone}`}>
                        {row.meta}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-4 rounded-[22px] border border-[#ECEEF4] bg-white px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-soft">Seguimiento</p>
              <p className="mt-2 text-sm text-text-strong">
                Talora volvió a escribirle a <span className="font-semibold">3 clientas inactivas</span> y ya recuperó <span className="font-semibold">1 turno</span>.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

const heroStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
};

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#F7F5F0]">
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/70 to-transparent" />
      <div className="absolute left-1/2 top-24 h-[420px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.9),_rgba(255,255,255,0.45)_42%,_transparent_72%)]" />

      <div className="container mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-10 md:pb-24 md:pt-16">
        <motion.div
          variants={heroStagger}
          initial="hidden"
          animate="visible"
          className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10"
        >
          <div className="relative z-10 flex flex-col items-start">
            <motion.div variants={fadeUp}>
              <Badge variant="outline" className="mb-6">
                {hero.badge}
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="max-w-[12ch] font-display text-hero-mobile font-semibold text-text-strong md:text-hero"
            >
              {hero.headline.before}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">{hero.headline.highlight}</span>
                <span className="absolute inset-x-0 bottom-1 z-0 h-3 rounded-full bg-mint/90" />
              </span>
              {hero.headline.after}
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-5 max-w-xl text-base leading-7 text-gray-medium sm:text-body-lg"
            >
              {hero.subheadline}
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
            >
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <a href={hero.ctaPrimaryHref} target="_blank" rel="noopener noreferrer">
                  {hero.ctaPrimary}
                </a>
              </Button>
              <Button size="lg" variant="secondary" className="w-full sm:w-auto bg-white/85" asChild>
                <a href={hero.ctaSecondaryHref}>{hero.ctaSecondary}</a>
              </Button>
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="mt-5 max-w-md text-sm leading-6 text-gray-medium"
            >
              {hero.supportLine}
            </motion.p>
          </div>

          <div className="relative z-10">
            <ProductScene />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
