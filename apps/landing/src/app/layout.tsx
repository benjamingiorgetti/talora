import type { Metadata } from "next";
import { IBM_Plex_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Talora - Turnos por WhatsApp con IA",
  description:
    "Automatiza la gestion de turnos de tu negocio con un agente de WhatsApp inteligente. Conecta Google Calendar, configura servicios y deja que tus clientes agenden solos.",
  openGraph: {
    title: "Talora - Turnos por WhatsApp con IA",
    description:
      "Automatiza la gestion de turnos de tu negocio con un agente de WhatsApp inteligente.",
    type: "website",
    locale: "es_AR",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className={`${ibmPlex.variable} ${fraunces.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
