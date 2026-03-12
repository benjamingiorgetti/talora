"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ShieldAlert, Building2 } from "lucide-react";
import useSWR from "swr";
import { useAuth } from "@/lib/auth";
import { pickPreferredCompanyId } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/api";
import type { Company } from "@talora/shared";
import { usePathname, useRouter } from "next/navigation";

export function RequireAdminAccess({
  children,
  title = "Acceso solo para superadmin",
  description = "Este modulo queda reservado para Talora y no forma parte del workspace del cliente.",
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const { session, exitImpersonation } = useAuth();

  if (!session) return null;

  if (session.role === "superadmin") {
    return <>{children}</>;
  }

  return (
    <Card className="rounded-[28px] border-[#eadfcd] bg-white shadow-none">
      <CardContent className="flex flex-col gap-4 p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Administracion</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {session.isImpersonating ? (
          <Button
            onClick={() => {
              void exitImpersonation();
            }}
            className="h-11 w-fit rounded-2xl bg-primary px-4 hover:bg-primary/90"
          >
            Volver a Talora
          </Button>
        ) : (
          <Button asChild variant="outline" className="h-11 w-fit rounded-2xl border-[#e5d9c8] bg-white px-4 hover:bg-[#f7efe4]">
            <Link href="/dashboard">Ir al workspace</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function RequireActiveCompany({
  children,
  title = "Crea la primera cuenta para empezar a operar",
  description = "El workspace necesita una empresa activa. Primero crea la cuenta del cliente y después la app te va a dejar trabajar siempre con un contexto cargado.",
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, activeCompanyId, setActiveCompanyId } = useAuth();
  const { data: companies } = useSWR<Company[]>(
    session?.role === "superadmin" ? "/companies" : null,
    fetcher
  );

  useEffect(() => {
    if (session?.role !== "superadmin" || !companies) return;

    if (companies.length === 0) {
      localStorage.setItem("talora_superadmin_zero_companies", "1");
      if (!pathname.startsWith("/admin/companies")) {
        router.replace("/admin/companies");
      }
      return;
    }

    localStorage.removeItem("talora_superadmin_zero_companies");
    const preferredCompanyId = pickPreferredCompanyId(companies, activeCompanyId);
    if (preferredCompanyId && preferredCompanyId !== activeCompanyId) {
      setActiveCompanyId(preferredCompanyId);
    }
  }, [activeCompanyId, companies, pathname, router, session?.role, setActiveCompanyId]);

  if (!session) return null;

  if (session.role === "admin_empresa" || session.role === "professional" || activeCompanyId) {
    return <>{children}</>;
  }

  if (session.role === "superadmin" && !companies) {
    return null;
  }

  if (session.role === "superadmin" && (companies?.length ?? 0) > 0) {
    return null;
  }

  return (
    <Card className="rounded-[28px] border-[#eadfcd] bg-white shadow-none">
      <CardContent className="flex flex-col gap-4 p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Primera empresa</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <Button asChild className="h-11 w-fit rounded-2xl bg-primary px-4 hover:bg-primary/90">
          <Link href="/admin/companies">Crear primera empresa</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ModulePlaceholderPage({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Card className="rounded-[28px] border-[#eadfcd] bg-white shadow-none">
      <CardContent className="p-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
      </CardContent>
    </Card>
  );
}
