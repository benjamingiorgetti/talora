import Image from "next/image";
import Link from "next/link";
import { Calendar, MessageCircle, Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import { AuthRedirect } from "./auth-redirect";

const features = [
  {
    icon: MessageCircle,
    title: "Bot de WhatsApp",
    description:
      "Tus clientes escriben al WhatsApp de siempre. Talora responde, entiende lo que necesitan y agenda el turno.",
  },
  {
    icon: Calendar,
    title: "Sync con Google Calendar",
    description:
      "Cada profesional tiene su calendario. Talora ve la disponibilidad real y nunca agenda encima de otro turno.",
  },
  {
    icon: Building2,
    title: "Multi-negocio",
    description:
      "Una plataforma, multiples negocios. Cada empresa con sus servicios, profesionales y configuracion propia.",
  },
];

const highlights = [
  "Agenda automatica 24/7",
  "Sin apps extra para tus clientes",
  "Confirmacion y reprogramacion por IA",
  "Takeover humano cuando hace falta",
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-slate-50">
      <AuthRedirect />

      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-emerald-950 shadow-[0_12px_24px_rgba(6,78,59,0.15)]">
            <Image
              src="/talora-logo-transparent.png"
              alt="Talora"
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
          </div>
          <span className="text-lg font-semibold text-slate-950">Talora</span>
        </div>
        <Link
          href="/login"
          className="inline-flex h-10 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          Iniciar sesion
        </Link>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Plataforma de turnos con IA
          </div>
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Tu negocio recibe turnos por WhatsApp.{" "}
            <span className="text-emerald-700">Automaticamente.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-slate-600">
            Talora conecta WhatsApp con Google Calendar y usa inteligencia artificial para agendar,
            confirmar y reprogramar turnos sin que toques el telefono.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-emerald-950 px-7 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(6,78,59,0.2)] transition-colors hover:bg-emerald-900"
            >
              Empezar gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Highlights */}
        <div className="mx-auto mt-14 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {highlights.map((text) => (
            <div key={text} className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-slate-950 sm:text-3xl">Como funciona</h2>
          <p className="mx-auto mt-3 max-w-lg text-base text-slate-500">
            Tres piezas que trabajan juntas para que tu agenda se llene sola.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
                <feature.icon className="h-6 w-6 text-emerald-700" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-emerald-950">
              <Image
                src="/talora-logo-transparent.png"
                alt="Talora"
                width={18}
                height={18}
                className="h-[18px] w-[18px] object-contain"
              />
            </div>
            <span className="text-sm font-semibold text-slate-700">Talora</span>
          </div>
          <p className="text-sm text-slate-400">Hecho en Argentina</p>
        </div>
      </footer>
    </div>
  );
}
