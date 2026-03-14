import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "Talora - Admin",
  description: "Panel de administracion del bot de WhatsApp",
  icons: { icon: "/talora-icon.png" },
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
