import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
});

const SITE_URL = "https://talora.vip";
const DESCRIPTION =
  "Automatiza turnos y agenda de tu negocio por WhatsApp con IA. Conecta Google Calendar, configura servicios y deja que tu asistente gestione todo.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Talora — Turnos por WhatsApp con IA",
    template: "%s | Talora",
  },
  description: DESCRIPTION,
  keywords: [
    "turnos whatsapp",
    "agenda online",
    "reservas whatsapp",
    "bot turnos",
    "gestión turnos",
    "agendar citas whatsapp",
    "software turnos",
    "talora",
  ],
  authors: [{ name: "Talora" }],
  creator: "Talora",
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: SITE_URL,
    siteName: "Talora",
    title: "Talora — Turnos por WhatsApp con IA",
    description: DESCRIPTION,
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Talora — Turnos por WhatsApp con IA" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talora — Turnos por WhatsApp con IA",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${plusJakarta.variable} antialiased`} style={{ ["--font-display" as string]: "var(--font-ui)" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
