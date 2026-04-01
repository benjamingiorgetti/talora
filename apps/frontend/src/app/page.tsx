import Image from "next/image";
import Link from "next/link";
import { Calendar, MessageCircle, Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import brandLogo from "../../../../img/logo.png";
import { AuthRedirect } from "./auth-redirect";

const features = [
  {
    icon: MessageCircle,
    title: "Bot de WhatsApp",
    description:
      "Tus clientes escriben al WhatsApp de siempre. Talora responde, entiende lo que necesitan y agenda el turno.",
    accent: "bg-mint",
    iconColor: "text-ink",
  },
  {
    icon: Calendar,
    title: "Sync con Google Calendar",
    description:
      "Cada profesional tiene su calendario. Talora ve la disponibilidad real y nunca agenda encima de otro turno.",
    accent: "bg-sky",
    iconColor: "text-ink",
  },
  {
    icon: Building2,
    title: "Multi-negocio",
    description:
      "Una plataforma, multiples negocios. Cada empresa con sus servicios, profesionales y configuracion propia.",
    accent: "bg-lilac",
    iconColor: "text-ink",
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
    <div className="min-h-dvh bg-white">
      <AuthRedirect />

      {/* Nav */}
      <nav className="mx-auto flex max-w-[1200px] items-center justify-between px-4 sm:px-6 py-5">
        <a href="/" className="flex items-center gap-2.5">
          <Image
            src={brandLogo}
            alt="Talora"
            width={112}
            height={34}
            className="h-auto w-[102px] object-contain"
          />
        </a>
        <Link
          href="/login"
          className="inline-flex h-10 items-center rounded-full border border-[#E2E4EC] bg-white px-5 text-sm font-medium text-gray-medium shadow-sm transition-colors hover:text-ink hover:border-gray-soft"
        >
          Iniciar sesion
        </Link>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20 pt-12 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#E2E4EC] bg-surface-cool px-4 py-1.5 text-sm font-medium text-gray-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" />
            Plataforma de turnos con IA
          </div>
          <h1 className="font-display text-hero-mobile md:text-hero font-semibold text-text-strong">
            Tu negocio recibe turnos por WhatsApp.{" "}
            <span className="border-b-[3px] border-mint pb-0.5">Automaticamente.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base sm:text-body-lg text-gray-medium">
            Talora conecta WhatsApp con Google Calendar y usa inteligencia artificial para agendar,
            confirmar y reprogramar turnos sin que toques el telefono.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-7 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-text-strong"
            >
              Empezar gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Highlights */}
        <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {highlights.map((text) => (
            <div key={text} className="flex items-center gap-2 text-sm text-gray-medium">
              <CheckCircle2 className="h-4 w-4 text-ink" />
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-surface-cool">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-20 sm:py-24">
          <div className="text-center">
            <h2 className="font-display text-section-mobile sm:text-section font-semibold text-text-strong">
              Como funciona
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-gray-medium">
              Tres piezas que trabajan juntas para que tu agenda se llene sola.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-[#E2E4EC]/60 bg-white p-8 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${feature.accent}`}>
                  <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-text-strong font-body">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-medium">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E2E4EC] bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 sm:px-6 py-8">
          <div className="flex items-center">
            <Image
              src={brandLogo}
              alt="Talora"
              width={90}
              height={28}
              className="h-auto w-[86px] object-contain"
            />
          </div>
          <p className="text-sm text-gray-soft">Hecho en Argentina</p>
        </div>
      </footer>
    </div>
  );
}
