"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, Lock, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-dvh overflow-hidden bg-background p-4 lg:p-5">
      <div className="mx-auto grid h-full w-full max-w-[1640px] overflow-hidden rounded-[30px] border border-border bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[0.96fr_1.04fr]">
        {/* ── Left: form ── */}
        <section className="flex flex-col justify-between overflow-y-auto px-8 py-8 sm:px-12 sm:py-10">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/icono-negro.png"
                alt="Talora"
                width={48}
                height={48}
                className="h-12 w-12 rounded-[14px] object-contain"
              />
              <div>
                <p className="text-base font-semibold text-foreground">Talora</p>
                <p className="text-sm text-[#9AA1AE]">Turnos por WhatsApp para equipos reales</p>
              </div>
            </div>

            <div className="mt-14 max-w-md">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9AA1AE]">Bienvenido de nuevo</p>
              <h1 className="font-display mt-4 text-balance text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
                Entrá a tu workspace operativo
              </h1>
              <p className="mt-4 max-w-sm text-pretty text-base leading-7 text-muted-foreground">
                Talora ordena agenda, mensajes y turnos en una sola vista para que tu negocio trabaje con menos
                fricción.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-12 max-w-md space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA1AE]" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@admin.com"
                  required
                  className="h-12 rounded-2xl border-border bg-secondary pl-11 shadow-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA1AE]" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="h-12 rounded-2xl border-border bg-secondary pl-11 shadow-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Switch checked={remember} onCheckedChange={setRemember} aria-label="Recordar sesión" />
              <span className="text-sm text-muted-foreground">Mantener la sesión iniciada</span>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-[#F8EAEF] bg-[#F8EAEF]/50 px-4 py-3" role="alert">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-2xl bg-primary text-sm font-semibold hover:bg-foreground"
            >
              {loading ? "Ingresando..." : "Entrar a Talora"}
            </Button>
          </form>

          <div className="mt-10 text-sm text-[#9AA1AE]">
            Una sola bandeja para agenda, turnos y control humano cuando hace falta.
          </div>
        </section>

        {/* ── Right: showcase ── */}
        <section className="relative hidden overflow-hidden bg-secondary lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,233,255,0.45),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(231,245,251,0.35),transparent_26%)]" />
          <div className="absolute inset-y-8 right-8 left-0 rounded-l-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04))]" />
          <div className="absolute inset-0 opacity-50">
            <div className="absolute -left-24 top-10 h-[620px] w-[620px] rounded-full border border-[#E2E4EC]/60" />
            <div className="absolute left-10 top-24 h-[520px] w-[520px] rounded-full border border-[#E2E4EC]/50" />
            <div className="absolute right-[-120px] bottom-[-140px] h-[720px] w-[720px] rounded-full border border-[#E2E4EC]/40" />
          </div>

          <div className="relative flex h-full flex-col justify-between px-14 py-14">
            <div className="ml-auto rounded-full border border-border bg-white/80 px-4 py-2 text-sm font-medium text-primary">
              Workspace cliente
            </div>

            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9AA1AE]">Talora</p>
              <h2 className="font-display mt-4 text-balance text-5xl font-semibold leading-tight text-foreground">
                Menos mensajes manuales. Más turnos cerrados.
              </h2>
              <p className="mt-6 max-w-lg text-pretty text-lg leading-8 text-muted-foreground">
                Unificá agenda, WhatsApp y operación diaria con una experiencia limpia para clientes y una capa admin
                separada para Talora.
              </p>
            </div>

            <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
              {[
                { label: "Agenda visible", value: "Google Calendar mapeado" },
                { label: "Inbox operativa", value: "Takeover y seguimiento" },
                { label: "Turnos resueltos", value: "Bot + intervención humana" },
              ].map((item) => (
                <div key={item.label} className="rounded-[22px] border border-[#E2E4EC]/70 bg-white/80 p-5 backdrop-blur">
                  <p className="text-sm text-[#9AA1AE]">{item.label}</p>
                  <p className="mt-2 text-balance text-lg font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
