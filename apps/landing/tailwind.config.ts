import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1200px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        ink: "#1C1D22",
        "text-strong": "#111318",
        "gray-medium": "#6B7280",
        "gray-soft": "#9AA1AE",
        "surface-cool": "#F5F6FA",
        lilac: "#EFE9FF",
        sky: "#E7F5FB",
        sand: "#F7EDDF",
        mint: "#E8F6EB",
        rose: "#F8EAEF",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      fontSize: {
        "hero": ["2.75rem", { lineHeight: "1.1", letterSpacing: "-0.03em" }],
        "hero-mobile": ["1.875rem", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        "section": ["2.5rem", { lineHeight: "1.15", letterSpacing: "-0.025em" }],
        "section-mobile": ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "body-lg": ["1.125rem", { lineHeight: "1.6" }],
      },
      boxShadow: {
        'card': '0 14px 28px rgba(15,23,42,0.04)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "marquee": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "subtle-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(28, 29, 34, 0)" },
          "50%": { boxShadow: "0 0 0 4px rgba(28, 29, 34, 0.06)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "marquee": "marquee 30s linear infinite",
        "subtle-pulse": "subtle-pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
