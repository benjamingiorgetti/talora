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
    <div className="min-h-dvh bg-slate-100 px-4 py-6 lg:px-6">
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] w-full max-w-[1640px] overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.12)] lg:grid-cols-[0.96fr_1.04fr]">
        <section className="flex flex-col justify-between px-8 py-8 sm:px-12 sm:py-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-950 shadow-[0_18px_36px_rgba(6,78,59,0.2)]">
                <Image
                  src="/talora-logo-transparent.png"
                  alt="Talora"
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain"
                />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-950">Talora</p>
                <p className="text-sm text-slate-500">Turnos por WhatsApp para equipos reales</p>
              </div>
            </div>

            <div className="mt-14 max-w-md">
              <p className="text-sm font-medium uppercase text-emerald-700">Bienvenido de nuevo</p>
              <h1 className="mt-4 text-balance text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
                Entrá a tu workspace operativo
              </h1>
              <p className="mt-4 max-w-sm text-pretty text-base leading-7 text-slate-500">
                Talora ordena agenda, mensajes y turnos en una sola vista para que tu negocio trabaje con menos
                fricción.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-12 max-w-md space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@admin.com"
                  required
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-11 shadow-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-11 shadow-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Switch checked={remember} onCheckedChange={setRemember} aria-label="Recordar sesión" />
              <span className="text-sm text-slate-600">Mantener la sesión iniciada</span>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3" role="alert">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-2xl bg-emerald-950 text-sm font-semibold hover:bg-emerald-900"
            >
              {loading ? "Ingresando..." : "Entrar a Talora"}
            </Button>
          </form>

          <div className="mt-10 text-sm text-slate-400">
            Una sola bandeja para agenda, turnos y control humano cuando hace falta.
          </div>
        </section>

        <section className="relative hidden overflow-hidden bg-[#d5f2ea] lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.65),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.35),transparent_22%)]" />
          <div className="absolute inset-y-8 right-8 left-0 rounded-l-[36px] bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04))]" />
          <div className="absolute inset-0 opacity-60">
            <div className="absolute -left-24 top-10 h-[620px] w-[620px] rounded-full border border-white/35" />
            <div className="absolute left-10 top-24 h-[520px] w-[520px] rounded-full border border-white/30" />
            <div className="absolute right-[-120px] bottom-[-140px] h-[720px] w-[720px] rounded-full border border-white/25" />
          </div>

          <div className="relative flex h-full flex-col justify-between px-14 py-14">
            <div className="ml-auto rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm font-medium text-emerald-900">
              Workspace cliente
            </div>

            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase text-emerald-900/70">Talora</p>
              <h2 className="mt-4 text-balance text-5xl font-semibold leading-tight text-slate-950">
                Menos mensajes manuales. Más turnos cerrados.
              </h2>
              <p className="mt-6 max-w-lg text-pretty text-lg leading-8 text-slate-700">
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
                <div key={item.label} className="rounded-[26px] border border-white/50 bg-white/70 p-5 backdrop-blur">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-balance text-lg font-semibold text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
