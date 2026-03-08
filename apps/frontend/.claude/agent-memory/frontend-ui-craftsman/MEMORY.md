# Frontend UI Craftsman — Project Memory

## Design System (Phase 1 — applied)
- **CSS variables** in `src/app/globals.css`: blue electric palette (`--primary: 224 85% 56%`), `--glass-bg`, `--primary-glow`
- **Utility classes**: `.glass` (glassmorphism), `.text-gradient-primary` (blue→indigo gradient text), `.hover-lift`, `.pulse-success/warning/primary`, `.shimmer-bg`
- **Font**: Inter (system), `font-size: 15px` base on body
- **Motion presets**: `src/lib/motion.ts` exports `fadeInUp, fadeIn, scaleIn, slideInLeft, staggerContainer, staggerItem, pageTransition, transition`

## Typography Scale
- Page titles: `text-2xl font-bold`
- Section titles: `text-xl font-semibold`
- Card titles: `text-lg font-semibold`
- Subtitles: `text-sm font-medium text-muted-foreground`
- Buttons: `font-medium` or `font-semibold`

## Key Component Patterns

### Navbar (`src/components/navbar.tsx`)
- Header: `glass sticky top-0 z-50 border-b border-border/30`
- Logo: `<span className="text-gradient-primary font-bold">Talora</span>` (capitalized)
- Active nav: `bg-primary/8 text-primary border border-primary/15 rounded-lg`
- Inactive nav: `text-muted-foreground hover:text-foreground hover:bg-muted/60`
- Logout: ghost variant, `hover:text-red-500 hover:bg-red-50`
- Nav wrapped in `motion.nav` with `staggerContainer` / `staggerItem`

### WsConnectionStatus (`src/components/ws-connection-status.tsx`)
- Uses `.pulse-success` / `.pulse-warning` CSS classes on the dot spans
- Status pill: `rounded-full border border-border/50 bg-background/60 backdrop-blur-sm`
- Reconnect banner: `bg-white/90 backdrop-blur-md` (glassmorphism, not solid red)

### Dashboard Layout (`src/app/(dashboard)/layout.tsx`)
- Uses `AnimatePresence` + `motion.main` with `pageTransition` variants
- Main: `container py-8 max-w-7xl mx-auto`

### Login Page (`src/app/login/page.tsx`)
- Background: 2 absolutely-positioned `motion.div` orbs with radial gradients, 9–10s float loop
- Card: `glass shadow-xl shadow-black/5 border border-border/50 rounded-2xl`
- Logo icon: small box with `bg-primary/8 border border-primary/15`, letter "b"
- Inputs: `h-11 rounded-lg border border-border/70` with `focus-visible:ring-primary/20`
- Submit: `h-12 rounded-lg bg-primary font-semibold shadow-md shadow-primary/20`
- Error: `AnimatePresence` + `fadeInUp` variant
- Card entrance: `scaleIn` variant

## Instancias Dashboard (`src/app/(dashboard)/page.tsx`) — Phase 4
- Status icon containers: `h-10 w-10 rounded-xl` (square with rounded corners, not circles)
- Status colors: green-500 connected, red-500 disconnected, yellow-400 qr_pending (no orange)
- Connected cards get: `border-t-2 border-t-green-500/50`
- Grid wrapped in `motion.div variants={staggerContainer}`, each card in `motion.div variants={staggerItem}`
- QR dialog uses `AnimatePresence mode="wait"` to animate between loading shimmer and QR image
- QR loading state: `shimmer-bg` utility class + simple spinner
- QR image entrance: `scaleIn` variant
- All buttons: `h-9 rounded-lg text-sm font-medium`
- All dialog buttons: `h-10 rounded-lg text-sm font-medium`
- Delete button on cards: icon-only `h-9 rounded-lg` for compact layout

## Agent Page (`src/app/(dashboard)/agent/page.tsx`) — Phase 5
- Sidebar: `w-56 glass rounded-xl sticky top-24 self-start`
- Sidebar label above nav: `text-xs font-semibold uppercase tracking-wider text-muted-foreground`
- Nav items: `rounded-lg px-3 py-2.5 text-sm`, icons `h-4 w-4`
- Active nav: `bg-primary/8 text-primary font-medium` (NOT `bg-primary text-white`)
- Content area: `AnimatePresence mode="wait"` keyed by `activeTab` + `fadeInUp` variant

## Agent Component Patterns — Phase 5
- Section titles: `text-xl font-semibold`, subtitles `text-sm font-medium text-muted-foreground`
- Cards: `rounded-xl border border-border/50 shadow-sm` (not rounded-2xl, not border-0)
- Icon containers: `h-10 w-10 rounded-xl` (status) or `h-9 w-9 rounded-lg` (alerts) or `h-10 w-10 rounded-lg` (tools)
- Expand/collapse in sections-tab: `AnimatePresence` + `motion.div` with `height: 0→"auto"` + `opacity`, `overflow-hidden`
- Textarea bg: `bg-muted/30`
- Section active border: `border-l-2 border-l-primary`, inactive: `border-l-2 border-l-border opacity-60`
- Conversations left panel: `bg-white/80 backdrop-blur-sm`, right panel: `bg-muted/20`
- Avatar palette (cool only): blue-100, indigo-100, sky-100, violet-100, teal-100, cyan-100, slate-100
- Selected conversation: `bg-primary/6 border-l-2 border-l-primary`
- Message bubbles: inline motion with `initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}`
- Search input: `rounded-lg border border-border/60 bg-white`
- Alerts icon bg opacity reduced: `bg-red-100/80`, `bg-yellow-100/80`, `bg-blue-100/80`
- All lists that can stagger: `staggerContainer` + `staggerItem`

## Architectural Notes
- `framer-motion` is the animation library — always import `motion`, `AnimatePresence` from it
- Motion presets are centralized in `@/lib/motion` — always import from there, never redeclare
- `"use client"` required on any file using framer-motion or React hooks
- TypeScript check: `cd apps/frontend && bunx tsc --noEmit`
- Lint check: `cd apps/frontend && bun run lint`
- Pre-existing lint warning: `<img>` in QR dialog (base64 data URI, acceptable — not fixable with next/image)
