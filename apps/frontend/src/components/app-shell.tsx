"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import useSWR, { useSWRConfig } from "swr";
import type { Company, WsEvent } from "@talora/shared";
import { fadeIn, slideInLeft } from "@/lib/motion";
import {
  ArrowLeftRight,
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
  TrendingUp,
  UsersRound,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWebSocket } from "@/hooks/useWebSocket";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AppShellProps {
  children: React.ReactNode;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
};

/* ------------------------------------------------------------------ */
/*  Nav arrays                                                         */
/* ------------------------------------------------------------------ */

const sharedNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageSquareMore },
  { href: "/appointments", label: "Turnos", icon: BriefcaseBusiness },
  { href: "/clients", label: "Clientes", icon: UsersRound },
  { href: "/workspace/growth", label: "CRM", icon: TrendingUp },
];

const settingsItem: NavItem = {
  href: "/settings/general",
  label: "Configuracion",
  icon: Settings2,
};

const adminNav: NavItem[] = [
  { href: "/admin/companies", label: "Companias", icon: Building2 },
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

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
/* ------------------------------------------------------------------ */

const ICON_SIZE = "h-[18px] w-[18px]";
const ICON_STROKE = 1.75;

const navItemBase =
  "group flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[15px] font-medium transition-colors duration-150";
const navItemActive =
  "bg-white text-[#111111] shadow-[0_2px_8px_rgba(0,0,0,0.06)]";
const navItemInactive =
  "text-[#2B2B2B] hover:bg-[#EDEDF0]";

const collapsedItemBase =
  "flex items-center justify-center rounded-[14px] p-2.5 transition-colors duration-150";
const collapsedItemActive =
  "bg-white text-[#111111] shadow-[0_2px_8px_rgba(0,0,0,0.06)]";
const collapsedItemInactive =
  "text-[#2B2B2B] hover:bg-[#EDEDF0]";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function navItemIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getInitial(name: string | null): string | null {
  if (!name) return null;
  return name.charAt(0).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  NavLink — renders a <Link> for navigation items                    */
/* ------------------------------------------------------------------ */

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

  if (collapsed) {
    const link = (
      <Link
        href={item.href}
        className={cn(
          collapsedItemBase,
          isActive ? collapsedItemActive : collapsedItemInactive,
        )}
      >
        <Icon className={cn(ICON_SIZE, "shrink-0")} strokeWidth={ICON_STROKE} />
      </Link>
    );

    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(navItemBase, isActive ? navItemActive : navItemInactive)}
    >
      <Icon className={cn(ICON_SIZE, "shrink-0")} strokeWidth={ICON_STROKE} />
      <span>{item.label}</span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  NavAction — renders a <button> for actions (logout, etc.)          */
/*  Same visual system as NavLink but semantically correct.            */
/* ------------------------------------------------------------------ */

function NavAction({
  label,
  icon: Icon,
  onClick,
  collapsed,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  onClick: () => void;
  collapsed: boolean;
}) {
  if (collapsed) {
    const btn = (
      <button
        onClick={onClick}
        className={cn(collapsedItemBase, "text-[#9A9AA0] hover:bg-[#EDEDF0] hover:text-[#2B2B2B]")}
        aria-label={label}
      >
        <Icon className={cn(ICON_SIZE, "shrink-0")} strokeWidth={ICON_STROKE} />
      </button>
    );

    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(navItemBase, "w-full text-[#9A9AA0] hover:bg-[#EDEDF0] hover:text-[#2B2B2B]")}
      aria-label={label}
    >
      <Icon className={cn(ICON_SIZE, "shrink-0")} strokeWidth={ICON_STROKE} />
      <span>{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  SidebarDivider                                                     */
/* ------------------------------------------------------------------ */

function SidebarDivider({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        "border-t border-[#E5E5EA]/60",
        collapsed ? "mx-2 my-2" : "mx-3 my-3",
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  SidebarFooter — identity at the very bottom                        */
/* ------------------------------------------------------------------ */

function SidebarFooter({
  collapsed,
  displayName,
  roleLabel,
  roleIcon: RoleIcon,
  isImpersonating,
  onExitImpersonation,
}: {
  collapsed: boolean;
  displayName: string;
  roleLabel: string;
  roleIcon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  isImpersonating: boolean;
  onExitImpersonation: () => void;
}) {
  const initial = getInitial(displayName);

  const avatar = (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E5E5EA] text-[13px] font-medium text-[#2B2B2B]">
      {initial ?? <RoleIcon className="h-4 w-4" strokeWidth={ICON_STROKE} />}
    </div>
  );

  if (collapsed) {
    return (
      <div className="flex flex-col items-center">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{avatar}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <p className="font-medium">{displayName}</p>
            <p className="text-xs text-[#9A9AA0]">{roleLabel}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-1">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[#2B2B2B]">{displayName}</p>
        <p className="truncate text-[12px] text-[#9A9AA0]">{roleLabel}</p>
      </div>
      {isImpersonating && (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={onExitImpersonation}
              className="shrink-0 rounded-lg p-1.5 text-[#9A9AA0] transition-colors hover:bg-[#EDEDF0] hover:text-[#2B2B2B]"
              aria-label="Volver a Talora"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>Volver a Talora</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BrandLockup                                                        */
/* ------------------------------------------------------------------ */

function BrandLockup({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center">
        <Image
          src="/talora-brand.png"
          alt="Talora"
          width={32}
          height={32}
          className="h-7 w-7 rounded-lg object-contain"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-12 items-center gap-2.5">
      <Image
        src="/talora-brand.png"
        alt=""
        width={32}
        height={32}
        className="h-7 w-7 rounded-lg object-contain"
        aria-hidden="true"
      />
      <span className="text-[17px] font-semibold text-[#111111] tracking-[-0.01em]">Talora</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function formatAppointmentTime(startsAt: string) {
  return new Date(startsAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

/* ------------------------------------------------------------------ */
/*  AppShell                                                           */
/* ------------------------------------------------------------------ */

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId, exitImpersonation, logout, session, setActiveCompanyId } = useAuth();
  const { mutate: globalMutate } = useSWRConfig();
  const { lastEvent } = useWebSocket();
  const lastEventRef = useRef<WsEvent | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { data: companies } = useSWR<Company[]>(
    session?.role === "superadmin" ? "/companies" : null,
    fetcher,
  );

  /* ---- WebSocket listener ---- */

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

    if (lastEvent.type === "slot_fill:new_opportunity") {
      void globalMutate((key) => {
        if (!key) return false;
        const keyStr = Array.isArray(key) ? key[0] : String(key);
        return keyStr.includes("/growth/slot-fill/opportunities");
      });
    }
  }, [lastEvent, globalMutate]);

  useEffect(() => {
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

  /* ---- Derived values ---- */

  const workspaceNav = session.role === "professional" ? professionalNav : sharedNav;

  const activeSharedItem =
    workspaceNav.find((item) => navItemIsActive(pathname, item.href)) ??
    (navItemIsActive(pathname, settingsItem.href) ? settingsItem : undefined) ??
    adminNav.find((item) => navItemIsActive(pathname, item.href));

  const activeCompany =
    session.role === "superadmin"
      ? (companies ?? []).find((company) => company.id === activeCompanyId) ?? null
      : null;

  const hasCompanies = (companies?.length ?? 0) > 0;
  const companiesLoaded = session.role !== "superadmin" || companies !== undefined;
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
      ? activeCompany?.name ?? (companiesLoaded ? (hasCompanies ? "Selecciona una empresa" : "Crea tu primera empresa") : "Cargando empresas")
      : session.role === "professional"
        ? session.fullName ?? session.companyName ?? "Profesional"
        : session.companyName ?? "Workspace";

  const topbarEyebrow =
    session.role === "superadmin"
      ? shellLabel
      : session.role === "professional"
        ? session.fullName ?? shellLabel
        : companyLabel;

  const identityName =
    session.fullName ?? session.email ?? shellLabel;

  const roleIcon =
    session.role === "superadmin"
      ? Shield
      : session.role === "professional"
        ? UsersRound
        : Building2;

  const handleSelectCompany = (companyId: string) => {
    setSwitcherOpen(false);
    setActiveCompanyId(companyId);
  };

  const exitImpersonationHandler = () => {
    void exitImpersonation().catch((error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo restaurar la sesion.");
    });
  };

  const showSettings = session.role !== "professional";
  const showAdmin = session.role === "superadmin";

  /* ---- Render ---- */

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#f8f9fc_0%,#f1f3f8_100%)] text-foreground">

      {/* ============================================================ */}
      {/*  Mobile nav drawer                                           */}
      {/* ============================================================ */}

      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            key="mobile-nav-backdrop"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-slate-950/28 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          >
            <motion.aside
              variants={slideInLeft}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex h-full w-[min(88vw,340px)] flex-col bg-[#F5F5F7] px-5 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.14)]"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <Link href={resolveDefaultRoute(session, activeCompanyId)}>
                  <BrandLockup collapsed={false} />
                </Link>
                <button
                  aria-label="Cerrar navegacion"
                  onClick={() => setMobileNavOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[#9A9AA0] transition-colors hover:bg-[#EDEDF0] hover:text-[#2B2B2B]"
                >
                  <X className="h-4 w-4" strokeWidth={ICON_STROKE} />
                </button>
              </div>

              {/* Main nav */}
              <nav className="mt-6 flex-1 space-y-0.5 overflow-y-auto" aria-label="Navegacion">
                {workspaceNav.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} collapsed={false} />
                ))}

                <SidebarDivider collapsed={false} />

                {showSettings && (
                  <NavLink item={settingsItem} pathname={pathname} collapsed={false} />
                )}

                {showAdmin && (
                  <>
                    <p className="px-3.5 pb-0.5 pt-3 text-[12px] font-medium text-[#9A9AA0]">Admin</p>
                    {adminNav.map((item) => (
                      <NavLink key={item.href} item={item} pathname={pathname} collapsed={false} />
                    ))}
                  </>
                )}
              </nav>

              {/* Bottom */}
              <SidebarDivider collapsed={false} />
              <NavAction label="Salir" icon={LogOut} onClick={logout} collapsed={false} />

              <div className="mt-3">
                <SidebarFooter
                  collapsed={false}
                  displayName={identityName}
                  roleLabel={shellLabel}
                  roleIcon={roleIcon}
                  isImpersonating={!!session.isImpersonating}
                  onExitImpersonation={exitImpersonationHandler}
                />
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/*  Main layout                                                 */}
      {/* ============================================================ */}

      <div className="mx-auto flex h-dvh w-full max-w-[1680px] overflow-hidden gap-4 px-3 py-3 lg:px-6 lg:py-4">

        {/* ========================================================== */}
        {/*  Desktop sidebar                                           */}
        {/* ========================================================== */}

        <aside
          className={cn(
            "group/sidebar relative sticky top-4 hidden h-[calc(100dvh-2rem)] shrink-0 flex-col rounded-[32px] bg-[#F5F5F7] transition-[width,padding] duration-200 ease-in-out lg:flex",
            sidebarCollapsed ? "w-[76px] px-3 py-5" : "w-[260px] px-5 py-5",
          )}
        >
          {/* ---- Edge toggle: sits on the right border of the sidebar ---- */}
          <button
            aria-label={sidebarCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="absolute -right-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E5EA] bg-white text-[#9A9AA0] shadow-sm opacity-0 transition-opacity duration-150 hover:text-[#2B2B2B] group-hover/sidebar:opacity-100"
          >
            <ChevronLeft className={cn("h-3 w-3", sidebarCollapsed && "rotate-180")} strokeWidth={2} />
          </button>

          <TooltipProvider delayDuration={0}>

            {/* ---- Header: brand only ---- */}
            {sidebarCollapsed ? (
              <div className="flex justify-center">
                <Link href={resolveDefaultRoute(session, activeCompanyId)}>
                  <BrandLockup collapsed />
                </Link>
              </div>
            ) : (
              <div className="px-1">
                <Link href={resolveDefaultRoute(session, activeCompanyId)}>
                  <BrandLockup collapsed={false} />
                </Link>
              </div>
            )}

            {/* ---- Main nav ---- */}
            <nav
              className={cn(
                "mt-5 flex-1 overflow-y-auto",
                sidebarCollapsed ? "space-y-1" : "space-y-0.5",
              )}
              aria-label="Navegacion principal"
            >
              {workspaceNav.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={sidebarCollapsed} />
              ))}

              <SidebarDivider collapsed={sidebarCollapsed} />

              {showSettings && (
                <NavLink item={settingsItem} pathname={pathname} collapsed={sidebarCollapsed} />
              )}

              {showAdmin && (
                <>
                  {!sidebarCollapsed && (
                    <p className="px-3.5 pb-0.5 pt-3 text-[12px] font-medium text-[#9A9AA0]">Admin</p>
                  )}
                  {adminNav.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} collapsed={sidebarCollapsed} />
                  ))}
                </>
              )}
            </nav>

            {/* ---- Bottom: salir + identity ---- */}
            <SidebarDivider collapsed={sidebarCollapsed} />
            <NavAction label="Salir" icon={LogOut} onClick={logout} collapsed={sidebarCollapsed} />

            <div className={cn("mt-3", sidebarCollapsed && "flex justify-center")}>
              <SidebarFooter
                collapsed={sidebarCollapsed}
                displayName={identityName}
                roleLabel={shellLabel}
                roleIcon={roleIcon}
                isImpersonating={!!session.isImpersonating}
                onExitImpersonation={exitImpersonationHandler}
              />
            </div>

          </TooltipProvider>
        </aside>

        {/* ========================================================== */}
        {/*  Main content                                              */}
        {/* ========================================================== */}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#fafbfe_100%)] shadow-[0_24px_80px_rgba(15,23,42,0.07)] sm:rounded-[32px]">
          <header className="sticky top-0 z-20 rounded-t-[28px] border-b border-[#e6e7ee] bg-white/92 px-4 py-2.5 backdrop-blur sm:rounded-t-[32px] md:px-5 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Abrir navegacion"
                  onClick={() => setMobileNavOpen(true)}
                  className="h-10 w-10 rounded-2xl border border-[#dde1ea] bg-[#f5f6fa] text-slate-600 hover:bg-white hover:text-slate-950 lg:hidden"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{topbarEyebrow}</p>
                  <h1 className="truncate text-[1.3rem] font-semibold leading-none text-slate-950 sm:text-[1.45rem] lg:text-[1.55rem]">{topbarTitle}</h1>
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
                          {activeCompany?.name ?? (companiesLoaded ? "Selecciona una empresa" : "Cargando empresas")}
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

                <div className="hidden h-11 items-center gap-3 rounded-full border border-[#dde1ea] bg-white px-4 text-sm text-slate-600 sm:flex">
                  <div className="h-2.5 w-2.5 rounded-full bg-slate-400 animate-status-pulse" />
                  <span className="hidden sm:inline">{session.email ?? "ops@talora"}</span>
                </div>
              </div>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-8 lg:py-7">{children}</main>
        </div>
      </div>
    </div>
  );
}
