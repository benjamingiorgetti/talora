"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import type { Company, WsEvent } from "@talora/shared";
import {
  ArrowLeftRight,
  BookOpenText,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Command,
  LayoutDashboard,
  LogOut,
  MessageSquareMore,
  PanelLeft,
  Settings2,
  Shield,
  Sparkles,
  UsersRound,
  Wrench,
  BellRing,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { fetcher } from "@/lib/api";
import { resolveDefaultRoute, useAuth } from "@/lib/auth";
import { pickPreferredCompanyId } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { CompanySwitcherDialog } from "@/components/company-switcher-dialog";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/hooks/useWebSocket";

interface AppShellProps {
  children: React.ReactNode;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type SidebarIdentityProps = {
  session: NonNullable<ReturnType<typeof useAuth>["session"]>;
  companyLabel: string;
  shellLabel: string;
  onExitImpersonation: () => void;
};

const sharedNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageSquareMore },
  { href: "/appointments", label: "Turnos", icon: BriefcaseBusiness },
  { href: "/clients", label: "Clientes", icon: UsersRound },
];

const configNav: NavItem[] = [
  { href: "/settings/general", label: "General", icon: Settings2 },
  { href: "/settings/services", label: "Servicios", icon: BookOpenText },
  { href: "/settings/professionals", label: "Profesionales", icon: Sparkles },
];

const adminNav: NavItem[] = [
  { href: "/admin/companies", label: "Compañías", icon: Building2 },
  { href: "/admin/ai", label: "IA", icon: Sparkles },
  { href: "/admin/messages", label: "Mensajes", icon: BellRing },
  { href: "/admin/settings", label: "Ajustes", icon: Settings2 },
];

const professionalNav: NavItem[] = [
  { href: "/clients", label: "Mis clientes", icon: UsersRound },
  { href: "/appointments", label: "Mis turnos", icon: BriefcaseBusiness },
  { href: "/calendar", label: "Mi agenda", icon: CalendarDays },
  { href: "/settings/professionals", label: "Mi Google", icon: Sparkles },
];

function navItemIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const isActive = navItemIsActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      className={cn(
        "interactive-soft group flex items-center gap-3 rounded-[20px] border px-3 py-2.5 text-sm font-medium",
        isActive
          ? "border-[#dfe1e9] bg-[linear-gradient(180deg,#ffffff_0%,#f4f5fa_100%)] text-slate-950 shadow-[0_12px_26px_rgba(15,23,42,0.05)]"
          : "border-transparent text-slate-500 hover:border-[#e5e7ef] hover:bg-white hover:text-slate-950",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? item.label : undefined}
    >
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-[15px] border transition-all duration-200",
          isActive
            ? "border-[#d7dae4] bg-white text-slate-950 shadow-sm"
            : "border-[#e5e7ef] bg-[#f6f7fb] text-slate-500 group-hover:border-[#daddE8] group-hover:bg-white group-hover:text-slate-800"
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function DropdownMenu({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div className="absolute right-0 top-[calc(100%+12px)] z-40 w-[320px] rounded-[28px] border border-[#dde1ea] bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
      <p className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = navItemIsActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-[22px] border px-3 py-3 text-sm transition-all duration-200",
                isActive
                  ? "border-[#dfe1e9] bg-[linear-gradient(180deg,#ffffff_0%,#f4f5fa_100%)] text-slate-950"
                  : "border-transparent text-slate-600 hover:border-[#e5e7ef] hover:bg-[#f7f8fc] hover:text-slate-950"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[#dfe3eb] bg-[#f6f7fb]">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function BrandLockup({
  collapsed,
}: {
  collapsed: boolean;
}) {
  return (
    <>
      {collapsed ? (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-[#dfe2ea] bg-white shadow-[0_14px_28px_rgba(15,23,42,0.06)]">
          <Image
            src="/talora-icon.png"
            alt="Talora"
            width={34}
            height={34}
            className="h-8 w-8 object-contain"
          />
        </div>
      ) : (
        <div className="flex min-h-14 items-center">
          <Image
            src="/talora-wordmark.png"
            alt="Talora"
            width={148}
            height={54}
            className="h-auto w-[136px] object-contain"
          />
        </div>
      )}
    </>
  );
}

function SidebarIdentityCard({
  session,
  companyLabel,
  shellLabel,
  onExitImpersonation,
}: SidebarIdentityProps) {
  const isClientWorkspace = session.role === "admin_empresa";

  return (
    <div className="mt-6 rounded-[24px] border border-[#e3e5ec] bg-[linear-gradient(180deg,#fcfcfe_0%,#f5f6fa_100%)] p-4">
      <div className="flex items-center gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#d8dce6] bg-white text-slate-900">
          {session.role === "superadmin" ? (
            <Shield className="h-5 w-5" />
          ) : session.role === "professional" ? (
            <UsersRound className="h-5 w-5" />
          ) : (
            <Building2 className="h-5 w-5" />
          )}
          <div className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-[#dfe2ea] bg-white shadow-sm">
            <Image
              src="/talora-icon.png"
              alt=""
              width={10}
              height={10}
              className="h-2.5 w-2.5 object-contain"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="min-w-0">
          {isClientWorkspace ? (
            <p className="truncate text-base font-semibold text-slate-950">{companyLabel}</p>
          ) : (
            <>
              <p className="truncate text-sm font-semibold text-slate-950">{shellLabel}</p>
              <p className="truncate text-sm text-slate-500">{companyLabel}</p>
            </>
          )}
        </div>
      </div>

      {session.isImpersonating && (
        <Button
          variant="outline"
          onClick={() => {
            onExitImpersonation();
          }}
          className="mt-4 h-10 w-full justify-start rounded-2xl border-[#dde1ea] bg-white px-3 text-sm hover:bg-[#f6f7fb]"
        >
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Volver a Talora
        </Button>
      )}
    </div>
  );
}

function formatAppointmentTime(startsAt: string) {
  return new Date(startsAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId, exitImpersonation, logout, session, setActiveCompanyId } = useAuth();
  const { mutate: globalMutate } = useSWRConfig();
  const { lastEvent } = useWebSocket();
  const lastEventRef = useRef<WsEvent | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { data: companies } = useSWR<Company[]>(
    session?.role === "superadmin" ? "/companies" : null,
    fetcher
  );

  // Global WebSocket listener: show toasts for appointment events and revalidate SWR caches
  useEffect(() => {
    if (!lastEvent || lastEvent === lastEventRef.current) return;
    lastEventRef.current = lastEvent;

    const isAppointmentEvent =
      lastEvent.type === "appointment:created" ||
      lastEvent.type === "appointment:rescheduled" ||
      lastEvent.type === "appointment:cancelled";

    if (isAppointmentEvent) {
      const payload = lastEvent.payload;
      const time = formatAppointmentTime(payload.starts_at);
      const professional = payload.professional_name ?? "Profesional";

      if (lastEvent.type === "appointment:created") {
        toast.success(`Nuevo turno: ${payload.client_name} a las ${time} con ${professional}`);
      } else if (lastEvent.type === "appointment:rescheduled") {
        toast.info(`Turno reprogramado: ${payload.client_name} a las ${time} con ${professional}`);
      } else {
        toast.info(`Turno cancelado: ${payload.client_name} con ${professional}`);
      }

      // Revalidate appointment-related caches across all pages
      void globalMutate((key) => {
        if (!key) return false;
        const keyStr = Array.isArray(key) ? key[0] : String(key);
        return keyStr.includes("/appointments") || keyStr.includes("/dashboard/metrics");
      });
    }

    if (lastEvent.type === "message:new" || lastEvent.type === "conversation:updated") {
      void globalMutate((key) => {
        if (!key) return false;
        const keyStr = Array.isArray(key) ? key[0] : String(key);
        return keyStr.includes("/conversations");
      });
    }
  }, [lastEvent, globalMutate]);

  useEffect(() => {
    setConfigOpen(false);
    setAdminOpen(false);
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!session || session.role !== "superadmin" || !companies) return;

    if (companies.length === 0) {
      localStorage.setItem("talora_superadmin_zero_companies", "1");
      if (activeCompanyId) {
        setActiveCompanyId(null);
      }
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
  }, [activeCompanyId, companies, pathname, router, session, setActiveCompanyId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      if (session?.role !== "superadmin" || !companies?.length) return;
      event.preventDefault();
      setSwitcherOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [companies, session?.role]);

  if (!session) return null;

  const activeSharedItem =
    (session.role === "professional" ? professionalNav : sharedNav).find((item) => navItemIsActive(pathname, item.href)) ??
    configNav.find((item) => navItemIsActive(pathname, item.href)) ??
    adminNav.find((item) => navItemIsActive(pathname, item.href));

  const activeCompany =
    session.role === "superadmin"
      ? (companies ?? []).find((company) => company.id === activeCompanyId) ?? null
      : null;

  const hasCompanies = (companies?.length ?? 0) > 0;
  const companiesLoaded = session.role !== "superadmin" || companies !== undefined;
  const workspaceNav = session.role === "professional" ? professionalNav : sharedNav;
  const topbarTitle = activeSharedItem?.label ?? "Talora";
  const shellLabel = session.isImpersonating
    ? "Vista cliente"
    : session.role === "superadmin"
      ? "Superadmin"
      : session.role === "professional"
        ? "Profesional"
        : "Cliente";

  const companyLabel =
    session.role === "superadmin"
      ? activeCompany?.name ?? (companiesLoaded ? (hasCompanies ? "Seleccioná una empresa" : "Crea tu primera empresa") : "Cargando empresas")
      : session.role === "professional"
        ? session.fullName ?? session.companyName ?? "Profesional"
        : session.companyName ?? "Workspace";
  const topbarEyebrow =
    session.role === "superadmin"
      ? shellLabel
      : session.role === "professional"
        ? session.fullName ?? shellLabel
        : companyLabel;

  const handleSelectCompany = (companyId: string) => {
    setSwitcherOpen(false);
    setConfigOpen(false);
    setAdminOpen(false);
    setActiveCompanyId(companyId);
  };

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#f8f9fc_0%,#f1f3f8_100%)] text-foreground">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/28 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        >
          <aside
            className="flex h-full w-[min(88vw,340px)] flex-col border-r border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fb_100%)] px-4 py-4 shadow-[0_24px_80px_rgba(15,23,42,0.14)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <Link href={resolveDefaultRoute(session, activeCompanyId)} className="flex min-w-0 items-center gap-3">
                <BrandLockup collapsed={false} />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar navegación"
                onClick={() => setMobileNavOpen(false)}
                className="h-10 w-10 rounded-2xl border border-[#e3e6ee] bg-white text-slate-500 hover:bg-[#f6f7fb] hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <SidebarIdentityCard
              session={session}
              companyLabel={companyLabel}
              shellLabel={shellLabel}
              onExitImpersonation={() => {
                void exitImpersonation().catch((error) => {
                  toast.error(error instanceof Error ? error.message : "No se pudo restaurar la sesión.");
                });
              }}
            />

            <nav className="mt-6 space-y-1.5" aria-label="Navegación móvil">
              {workspaceNav.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={false} />
              ))}
            </nav>

            <div className="mt-6 space-y-4 overflow-y-auto pr-1">
              {session.role !== "professional" && (
                <div className="space-y-1.5">
                  <p className="px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Configurar</p>
                  {configNav.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} collapsed={false} />
                  ))}
                </div>
              )}
              {session.role === "superadmin" && (
                <div className="space-y-1.5">
                  <p className="px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Admin</p>
                  {adminNav.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} collapsed={false} />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-auto pt-6">
              <Button
                variant="outline"
                onClick={logout}
                className="h-11 w-full justify-start rounded-2xl border-[#dde1ea] bg-white px-4 text-slate-700 hover:bg-[#f6f7fb]"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Salir
              </Button>
            </div>
          </aside>
        </div>
      )}

      <div className="mx-auto flex h-dvh w-full max-w-[1680px] overflow-hidden gap-4 px-3 py-3 lg:px-6 lg:py-4">
        <aside
          className={cn(
            "sticky top-4 hidden h-[calc(100dvh-2rem)] shrink-0 flex-col overflow-hidden rounded-[30px] border border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fb_100%)] p-4 shadow-[0_24px_64px_rgba(15,23,42,0.06)] lg:flex",
            sidebarCollapsed ? "w-[92px]" : "w-[260px]"
          )}
        >
          <div className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "justify-between gap-3")}>
            <Link
              href={resolveDefaultRoute(session, activeCompanyId)}
              className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "gap-3")}
            >
              <BrandLockup collapsed={sidebarCollapsed} />
            </Link>

            {!sidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Colapsar sidebar"
                onClick={() => setSidebarCollapsed(true)}
                className="h-10 w-10 rounded-2xl border border-transparent text-slate-500 hover:border-[#e3e6ee] hover:bg-white hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>

          {sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Expandir sidebar"
              onClick={() => setSidebarCollapsed(false)}
              className="mt-4 h-11 w-11 self-center rounded-2xl border border-[#e3e6ee] bg-white text-slate-500 shadow-sm hover:bg-[#f6f7fb] hover:text-slate-900"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}

          {!sidebarCollapsed && (
            <SidebarIdentityCard
              session={session}
              companyLabel={companyLabel}
              shellLabel={shellLabel}
              onExitImpersonation={() => {
                void exitImpersonation().catch((error) => {
                  toast.error(error instanceof Error ? error.message : "No se pudo restaurar la sesión.");
                });
              }}
            />
          )}

          <div className={cn("mt-6 flex-1 overflow-y-auto", sidebarCollapsed ? "pr-0" : "pr-1")}>
            <nav className="space-y-1.5" aria-label="Navegación principal">
              {workspaceNav.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={sidebarCollapsed} />
              ))}
            </nav>
          </div>

          <div className={cn("border-t border-[#e4e7ef] pt-4", sidebarCollapsed && "flex flex-col items-center")}>
            <Button
              variant="outline"
              onClick={logout}
              className={cn(
                "h-11 rounded-2xl border-[#dde1ea] bg-white text-slate-700 hover:bg-[#f6f7fb]",
                sidebarCollapsed ? "w-11 px-0" : "w-full justify-start px-4"
              )}
              aria-label="Cerrar sesión"
            >
              <LogOut className={cn("h-4 w-4", !sidebarCollapsed && "mr-2")} />
              {!sidebarCollapsed && "Salir"}
            </Button>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#fafbfe_100%)] shadow-[0_24px_80px_rgba(15,23,42,0.07)] sm:rounded-[32px]">
          <header className="sticky top-0 z-20 rounded-t-[28px] border-b border-[#e6e7ee] bg-white/92 px-4 py-3.5 backdrop-blur sm:rounded-t-[32px] md:px-5 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Abrir navegación"
                  onClick={() => setMobileNavOpen(true)}
                  className="h-10 w-10 rounded-2xl border border-[#dde1ea] bg-[#f5f6fa] text-slate-600 hover:bg-white hover:text-slate-950 lg:hidden"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{topbarEyebrow}</p>
                  <h1 className="font-display truncate text-[1.8rem] leading-none text-slate-950 sm:text-[2rem] lg:text-[2.15rem]">{topbarTitle}</h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                {session.role === "superadmin" && hasCompanies && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setSwitcherOpen(true)}
                      className="h-11 min-w-[220px] justify-between rounded-2xl border-[#dde1ea] bg-white px-4 shadow-none hover:bg-[#f6f7fb]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        <span className="truncate text-sm font-medium text-slate-900 sm:text-base">
                          {activeCompany?.name ?? (companiesLoaded ? "Seleccioná una empresa" : "Cargando empresas")}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-sm text-slate-400">
                        <Command className="h-3.5 w-3.5" />
                        <ChevronDown className="h-4 w-4" />
                      </span>
                    </Button>
                    <CompanySwitcherDialog
                      companies={companies ?? []}
                      activeCompanyId={activeCompanyId}
                      open={switcherOpen}
                      onOpenChange={setSwitcherOpen}
                      onSelect={handleSelectCompany}
                    />
                  </>
                )}

                {session.role !== "professional" && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setConfigOpen((current) => !current);
                        setAdminOpen(false);
                      }}
                      className="h-11 rounded-2xl border-[#dde1ea] bg-white px-4 shadow-none hover:bg-[#f6f7fb]"
                    >
                      <Wrench className="mr-2 h-4 w-4" />
                      Configurar
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                    {configOpen && (
                      <DropdownMenu
                        title="Configuración"
                        items={configNav}
                        pathname={pathname}
                        onNavigate={() => setConfigOpen(false)}
                      />
                    )}
                  </div>
                )}

                {session.role === "superadmin" && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAdminOpen((current) => !current);
                        setConfigOpen(false);
                      }}
                      className="h-11 rounded-2xl border-[#dde1ea] bg-white px-4 shadow-none hover:bg-[#f6f7fb]"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Admin
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                    {adminOpen && (
                      <DropdownMenu
                        title="Administración"
                        items={adminNav}
                        pathname={pathname}
                        onNavigate={() => setAdminOpen(false)}
                      />
                    )}
                  </div>
                )}

                <div className="hidden h-11 items-center gap-3 rounded-full border border-[#dde1ea] bg-white px-4 text-sm text-slate-600 sm:flex">
                  <div className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                  <span className="hidden sm:inline">{session.email ?? "ops@talora"}</span>
                </div>
              </div>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-8 lg:py-7">{children}</main>
        </div>
      </div>
    </div>
  );
}
