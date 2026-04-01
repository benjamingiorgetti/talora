"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, Lock, Mail } from "lucide-react";
import brandLogo from "../../../../../img/logo.png";
import brandWhite from "../../../../../img/blanco.png";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="h-dvh overflow-hidden bg-[#F8F9FC] p-3 lg:p-4">
      <div className="mx-auto grid h-full w-full max-w-[1540px] overflow-hidden rounded-[32px] border border-[#E2E4EC] bg-white shadow-[0_24px_80px_rgba(17,19,24,0.08)] lg:grid-cols-[0.78fr_1fr_0.96fr]">
        <section className="hidden h-full items-center justify-center border-r border-[#E2E4EC] bg-white px-10 lg:flex xl:px-14">
          <div className="flex max-w-[260px] items-center justify-center">
            <Image
              src={brandLogo}
              alt="Talora"
              priority
              className="h-auto w-full max-w-[220px] object-contain"
            />
          </div>
        </section>

        <section className="flex h-full items-center justify-center bg-white px-6 py-8 sm:px-10 lg:px-12">
          <div className="w-full max-w-[390px]">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6B7280]">Iniciar sesión</p>
              <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-[#111318] sm:text-[2.2rem]">Entrá a tu cuenta</h1>
              <p className="max-w-[22rem] text-sm leading-6 text-[#667085]">
                Usá tu email y contraseña para entrar al workspace de Talora.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-[#111318]">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@admin.com"
                    required
                    className="h-11 rounded-[18px] border-[#E2E4EC] bg-[#F5F6FA] pl-11 text-[#111318] placeholder:text-[#9AA1AE] shadow-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-[#111318]">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="h-11 rounded-[18px] border-[#E2E4EC] bg-[#F5F6FA] pl-11 text-[#111318] shadow-none"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3" role="alert">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                  <p className="text-sm text-rose-700">{error}</p>
                </div>
              )}

              <label className="flex items-center gap-2 pt-0.5 text-[11px] text-[#667085]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border border-[#E2E4EC] accent-[#1C1D22] focus:ring-1 focus:ring-[#E2E4EC]"
                />
                Mantener sesión iniciada
              </label>

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-[18px] bg-[#1C1D22] text-sm font-semibold text-white hover:bg-[#111318]"
              >
                {loading ? "Ingresando..." : "Entrar"}
              </Button>
            </form>

            <p className="mt-6 text-xs text-[#9AA1AE]">Acceso exclusivo para clientes Talora.</p>
          </div>
        </section>

        <section className="relative hidden h-full overflow-hidden bg-[linear-gradient(180deg,#111318_0%,#1C1D22_100%)] lg:block">
          <div className="absolute left-[14%] top-[14%] h-[320px] w-[320px] rounded-full border border-white/[0.05]" />
          <div className="absolute right-[12%] top-[22%] h-[220px] w-[220px] rounded-full bg-white/[0.03] blur-2xl" />
          <div className="absolute bottom-[10%] left-[12%] h-[240px] w-[240px] rounded-full bg-black/20 blur-3xl" />
          <div className="absolute bottom-[14%] right-[16%] h-[160px] w-[160px] rounded-full border border-white/[0.04]" />

          <div className="relative flex h-full items-center justify-center px-10 py-10">
            <div className="relative h-full w-full max-w-[430px]">
              <div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.015)_55%,transparent_72%)]" />
              <Image
                src={brandWhite}
                alt="Talora"
                width={164}
                height={164}
                priority
                className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 object-contain opacity-95"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
