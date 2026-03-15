"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { Company, Professional, Service, WhatsAppInstance } from "@talora/shared";
import { ArrowRight, Building2, CalendarRange, Link2, Plus, RefreshCw, Trash2, Wand2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RequireAdminAccess } from "@/components/role-guards";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type CompanyOverview = Company & {
  admin_count: number;
  professional_count: number;
  service_count: number;
  instance_count: number;
  connected_instance_count: number;
  calendar_connection_count: number;
  google_oauth_connected: boolean;
  whatsapp_connected: boolean;
  setup_ready: boolean;
  setup_progress: number;
};

type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  company_id?: string;
  professional_count?: number;
  connected_professional_count?: number;
};

type GoogleCalendarOption = {
  id: string;
  summary: string;
  primary: boolean;
  access_role: string;
  background_color: string | null;
};

type GoogleCalendarValidation = {
  configured: boolean;
  connected: boolean;
  professional_id?: string | null;
  calendars: GoogleCalendarOption[];
  professionals: Array<{
    id: string;
    name: string;
    specialty: string | null;
    calendar_id: string;
    google_account_email: string | null;
    is_connected: boolean;
  }>;
};

type ProfessionalEditDraft = Partial<Professional> & {
  user_email?: string;
  user_password?: string;
  user_full_name?: string;
  user_is_active?: boolean;
};

type ServiceEditDraft = Partial<Service> & {
  aliases_text?: string;
};

const verticalOptions = ["Peluqueria", "Dentista", "Tatuajes", "Service del auto"];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const emptyCompany = {
  name: "",
  industry: "",
  whatsapp: "",
  escalationNumber: "",
  adminFullName: "",
  adminEmail: "",
  adminPassword: "",
  professionals: "",
  services: "",
};

const emptyProfessional = {
  name: "",
  specialty: "",
  calendar_id: "primary",
  color_hex: "#17352d",
  user_email: "",
  user_password: "",
  user_full_name: "",
};

const emptyService = {
  name: "",
  aliases: "",
  duration_minutes: "60",
  price: "",
  description: "",
  professional_id: "all",
};

function toQrSrc(value: string | null | undefined) {
  if (!value) return null;
  return value.startsWith("data:image") ? value : `data:image/png;base64,${value}`;
}

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePriceInput(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
}

function statusBadge(ready: boolean) {
  return ready
    ? "rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
    : "rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700";
}

export default function SuperadminCompaniesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeCompanyId, impersonate, session, setActiveCompanyId } = useAuth();
  const { data: companies, mutate: mutateCompanies } = useSWR<CompanyOverview[]>("/companies", fetcher);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [professionalDraft, setProfessionalDraft] = useState(emptyProfessional);
  const [serviceDraft, setServiceDraft] = useState(emptyService);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [creatingProfessional, setCreatingProfessional] = useState(false);
  const [creatingService, setCreatingService] = useState(false);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [professionalEdits, setProfessionalEdits] = useState<Record<string, ProfessionalEditDraft>>({});
  const [serviceEdits, setServiceEdits] = useState<Record<string, ServiceEditDraft>>({});
  const [instanceQr, setInstanceQr] = useState<Record<string, string | null>>({});
  const professionalsSectionRef = useRef<HTMLDivElement | null>(null);
  const servicesSectionRef = useRef<HTMLDivElement | null>(null);
  const whatsappSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeCompanyId && activeCompanyId !== selectedCompanyId) {
      setSelectedCompanyId(activeCompanyId);
      return;
    }

    if (!selectedCompanyId && companies && companies.length > 0) {
      setSelectedCompanyId(activeCompanyId ?? companies[0].id);
    }
  }, [activeCompanyId, companies, selectedCompanyId]);

  useEffect(() => {
    if (pathname === "/superadmin/companies") {
      router.replace("/admin/companies");
    }
  }, [pathname, router]);

  const selectedCompany = useMemo(
    () => (companies ?? []).find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  const companyScope = selectedCompanyId ? `company_id=${encodeURIComponent(selectedCompanyId)}` : null;
  const { data: professionals, mutate: mutateProfessionals } = useSWR<Professional[]>(
    companyScope ? `/professionals?${companyScope}` : null,
    fetcher
  );
  const { data: services, mutate: mutateServices } = useSWR<Service[]>(
    companyScope ? `/services?${companyScope}` : null,
    fetcher
  );
  const { data: instances, mutate: mutateInstances } = useSWR<WhatsAppInstance[]>(
    companyScope ? `/instances?${companyScope}` : null,
    fetcher
  );
  const { data: googleStatus, mutate: mutateGoogleStatus } = useSWR<GoogleStatus>(
    companyScope ? `/auth/google/status?${companyScope}` : null,
    fetcher
  );
  const { data: googleCalendars, mutate: mutateGoogleCalendars } = useSWR<GoogleCalendarValidation>(
    companyScope ? `/auth/google/calendars?${companyScope}` : null,
    fetcher
  );

  const totals = useMemo(() => {
    return (companies ?? []).reduce(
      (acc, company) => {
        acc.professionals += company.professional_count ?? 0;
        acc.services += company.service_count ?? 0;
        acc.ready += company.setup_ready ? 1 : 0;
        return acc;
      },
      { professionals: 0, services: 0, ready: 0 }
    );
  }, [companies]);

  const refreshSelectedWorkspace = useCallback(async () => {
    await Promise.all([
      mutateCompanies(),
      mutateProfessionals(),
      mutateServices(),
      mutateInstances(),
      mutateGoogleStatus(),
      mutateGoogleCalendars(),
    ]);
  }, [mutateCompanies, mutateGoogleCalendars, mutateGoogleStatus, mutateInstances, mutateProfessionals, mutateServices]);

  useEffect(() => {
    const calendarStatus = searchParams.get("calendar");
    if (!calendarStatus) return;

    if (calendarStatus === "connected") {
      toast.success("Google Calendar conectado para el profesional.");
      void refreshSelectedWorkspace();
    } else if (calendarStatus === "error") {
      toast.error("No se pudo conectar Google Calendar.");
    }

    router.replace("/admin/companies");
  }, [refreshSelectedWorkspace, router, searchParams]);

  useEffect(() => {
    if (!selectedCompanyId || !instances?.length) return;

    const pendingInstanceIds = instances
      .filter((instance) => instance.status !== "connected")
      .map((instance) => instance.id);

    if (pendingInstanceIds.length === 0) return;

    let cancelled = false;

    const pollPendingInstances = async () => {
      try {
        const responses = await Promise.all(
          pendingInstanceIds.map(async (instanceId) => {
            const response = await api.get<{ data: { status: string; qr_code: string | null; phone_number?: string | null } }>(
              `/instances/${instanceId}/qr?company_id=${selectedCompanyId}`
            );
            return { instanceId, payload: response.data };
          })
        );

        if (cancelled) return;

        let shouldRefreshInstances = false;

        setInstanceQr((current) => {
          const next = { ...current };
          for (const response of responses) {
            const qrCode = response.payload.qr_code;
            if (response.payload.status === "connected") {
              delete next[response.instanceId];
              shouldRefreshInstances = true;
              continue;
            }
            if (qrCode) {
              next[response.instanceId] = qrCode;
            }
          }
          return next;
        });

        if (shouldRefreshInstances) {
          await mutateInstances();
        }
      } catch {
        // Best-effort polling; explicit actions already show errors.
      }
    };

    void pollPendingInstances();
    const interval = window.setInterval(() => {
      void pollPendingInstances();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [instances, mutateInstances, selectedCompanyId]);

  const handleCreateCompany = async () => {
    if (!companyForm.name.trim() || !companyForm.industry.trim() || !companyForm.adminEmail.trim() || !companyForm.adminPassword.trim() || !companyForm.adminFullName.trim()) {
      toast.error("Completa empresa, rubro y credenciales del admin.");
      return;
    }

    setCreatingCompany(true);
    try {
      const response = await api.post<{ data: { company: CompanyOverview } }>("/companies", {
        name: companyForm.name.trim(),
        industry: companyForm.industry,
        whatsapp_number: companyForm.whatsapp.trim() || null,
        escalation_number: companyForm.escalationNumber.trim() || null,
        admin_email: companyForm.adminEmail.trim(),
        admin_password: companyForm.adminPassword,
        admin_full_name: companyForm.adminFullName.trim(),
        professionals: parseCommaList(companyForm.professionals).map((name, index) => ({
          name,
          calendar_id: "primary",
          color_hex: ["#17352d", "#6c8f7f", "#d78d5c", "#b7c9d6"][index % 4],
        })),
        services: parseCommaList(companyForm.services).map((name) => ({
          name,
          duration_minutes: 60,
          price: 0,
          description: "",
        })),
      });
      await mutateCompanies();
      setSelectedCompanyId(response.data.company.id);
      setActiveCompanyId(response.data.company.id);
      setCompanyForm(emptyCompany);
      toast.success("Empresa creada. Ya podes completar agenda y WhatsApp.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la empresa.");
    } finally {
      setCreatingCompany(false);
    }
  };

  const handleImpersonate = async (companyId: string) => {
    setImpersonatingId(companyId);
    try {
      await impersonate(companyId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo abrir el workspace.";
      toast.error(
        message.includes("No company admin available")
          ? "Esta empresa todavía no tiene un admin cliente listo para abrir el workspace."
          : message
      );
      setImpersonatingId(null);
    }
  };

  if (!session || session.role !== "superadmin") {
    return (
      <RequireAdminAccess description="Si estas viendo esto como cliente o en modo impersonacion, primero volve a Talora para administrar empresas.">
        {null}
      </RequireAdminAccess>
    );
  }

  const handleCreateProfessional = async () => {
    if (!selectedCompanyId || !professionalDraft.name.trim() || !professionalDraft.calendar_id.trim()) {
      toast.error("Completa nombre y calendario del profesional.");
      return;
    }
    if ((professionalDraft.user_email && !professionalDraft.user_password) || (!professionalDraft.user_email && professionalDraft.user_password)) {
      toast.error("Si querés crear login, completa email y password.");
      return;
    }
    setCreatingProfessional(true);
    try {
      await api.post(`/professionals?company_id=${selectedCompanyId}`, {
        ...professionalDraft,
        name: professionalDraft.name.trim(),
        specialty: professionalDraft.specialty.trim(),
        user_email: professionalDraft.user_email.trim() || undefined,
        user_password: professionalDraft.user_password || undefined,
        user_full_name: professionalDraft.user_full_name.trim() || professionalDraft.name.trim(),
      });
      setProfessionalDraft(emptyProfessional);
      await refreshSelectedWorkspace();
      toast.success("Profesional agregado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el profesional.");
    } finally {
      setCreatingProfessional(false);
    }
  };

  const handleSaveProfessional = async (professional: Professional) => {
    if (!selectedCompanyId) return;
    const draft = professionalEdits[professional.id];
    if (!draft) return;

    const effectiveEmail = (draft.user_email as string | undefined) ?? professional.user_email ?? "";
    const hasExistingLogin = Boolean(professional.has_login ?? professional.user_id);

    if (!hasExistingLogin && ((effectiveEmail && !draft.user_password) || (!effectiveEmail && draft.user_password))) {
      toast.error("Para crear el login del profesional, completa email y password.");
      return;
    }

    try {
      await api.put(`/professionals/${professional.id}?company_id=${selectedCompanyId}`, draft);
      setProfessionalEdits((current) => {
        const next = { ...current };
        delete next[professional.id];
        return next;
      });
      await refreshSelectedWorkspace();
      toast.success("Profesional actualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el profesional.");
    }
  };

  const handleDeleteProfessional = async (professionalId: string) => {
    if (!selectedCompanyId) return;
    try {
      await api.delete(`/professionals/${professionalId}?company_id=${selectedCompanyId}`);
      await refreshSelectedWorkspace();
      toast.success("Profesional eliminado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el profesional.");
    }
  };

  const handleCreateService = async () => {
    if (!selectedCompanyId || !serviceDraft.name.trim()) {
      toast.error("Completa al menos el nombre del servicio.");
      return;
    }
    const price = parsePriceInput(serviceDraft.price);
    if (price === null) {
      toast.error("El precio es obligatorio y debe ser un entero.");
      return;
    }
    setCreatingService(true);
    try {
      await api.post(`/services?company_id=${selectedCompanyId}`, {
        ...serviceDraft,
        name: serviceDraft.name.trim(),
        aliases: parseCommaList(serviceDraft.aliases),
        duration_minutes: Number(serviceDraft.duration_minutes) || 60,
        price,
        professional_id: serviceDraft.professional_id === "all" ? null : serviceDraft.professional_id,
      });
      setServiceDraft(emptyService);
      await refreshSelectedWorkspace();
      toast.success("Servicio agregado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el servicio.");
    } finally {
      setCreatingService(false);
    }
  };

  const handleSaveService = async (service: Service) => {
    if (!selectedCompanyId) return;
    const draft = serviceEdits[service.id];
    if (!draft) return;
    try {
      await api.put(`/services/${service.id}?company_id=${selectedCompanyId}`, draft);
      setServiceEdits((current) => {
        const next = { ...current };
        delete next[service.id];
        return next;
      });
      await refreshSelectedWorkspace();
      toast.success("Servicio actualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el servicio.");
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!selectedCompanyId) return;
    try {
      await api.delete(`/services/${serviceId}?company_id=${selectedCompanyId}`);
      await refreshSelectedWorkspace();
      toast.success("Servicio eliminado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el servicio.");
    }
  };

  const handleCreateInstance = async () => {
    if (!selectedCompanyId || !selectedCompany) return;
    setCreatingInstance(true);
    try {
      await api.post("/instances", {
        company_id: selectedCompanyId,
        name: `${selectedCompany.name} WhatsApp`,
      });
      await refreshSelectedWorkspace();
      toast.success("Instancia creada. Ya podes pedir el QR.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la instancia.");
    } finally {
      setCreatingInstance(false);
    }
  };

  const handleConnectInstance = async (instanceId: string) => {
    if (!selectedCompanyId) return;
    try {
      await api.post(`/instances/${instanceId}/connect?company_id=${selectedCompanyId}`);
      const qrResponse = await api.get<{ data: { status: string; qr_code: string | null } }>(
        `/instances/${instanceId}/qr?company_id=${selectedCompanyId}`
      );
      setInstanceQr((current) => ({ ...current, [instanceId]: qrResponse.data.qr_code }));
      await mutateInstances();
      toast.success("Se solicito el QR de la instancia.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo conectar la instancia.");
    }
  };

  const handleRefreshQr = async (instanceId: string) => {
    if (!selectedCompanyId) return;
    try {
      const qrResponse = await api.get<{ data: { status: string; qr_code: string | null } }>(
        `/instances/${instanceId}/qr?company_id=${selectedCompanyId}`
      );
      setInstanceQr((current) => {
        const next = { ...current };
        if (qrResponse.data.status === "connected") {
          delete next[instanceId];
          return next;
        }
        next[instanceId] = qrResponse.data.qr_code;
        return next;
      });
      await mutateInstances();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo refrescar el QR.");
    }
  };

  const handleConnectGoogle = () => {
    professionalsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast.message("Primero crea o elige un profesional. La conexión de Google está en su tarjeta.");
  };

  const handleConnectProfessionalGoogle = (professionalId: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      toast.error("La sesión expiró. Volvé a iniciar sesión.");
      return;
    }

    const url = new URL(`${API_BASE_URL}/auth/google`);
    url.searchParams.set("token", token);
    url.searchParams.set("professional_id", professionalId);
    url.searchParams.set("return_to", "/admin/companies");
    window.location.href = url.toString();
  };

  const handleDisconnectProfessionalGoogle = async (professionalId: string) => {
    try {
      await api.post(`/auth/google/disconnect?professional_id=${encodeURIComponent(professionalId)}`);
      await refreshSelectedWorkspace();
      toast.success("Google Calendar desconectado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo desconectar Google Calendar.");
    }
  };

  const professionalValidationMap = new Map(
    (googleCalendars?.professionals ?? []).map((item) => [item.id, item])
  );
  const setupSteps = selectedCompany
    ? [
        {
          step: "1",
          title: "Empresa",
          status: "listo",
          description: `${selectedCompany.name} ya está creada y activa.`,
        },
        {
          step: "2",
          title: "Profesionales + Google",
          status: (googleStatus?.connected_professional_count ?? 0) > 0 ? "en curso" : "pendiente",
          description:
            (googleStatus?.connected_professional_count ?? 0) > 0
              ? `${googleStatus?.connected_professional_count ?? 0} profesional(es) con Google conectado.`
              : "Crea profesionales y conecta Google desde cada tarjeta.",
        },
        {
          step: "3",
          title: "Servicios",
          status: (services?.length ?? 0) > 0 ? "listo" : "pendiente",
          description: (services?.length ?? 0) > 0 ? `${services?.length ?? 0} servicio(s) cargados.` : "Define qué se puede reservar.",
        },
        {
          step: "4",
          title: "WhatsApp",
          status: (instances?.some((instance) => instance.status === "connected") ?? false) ? "listo" : "pendiente",
          description:
            (instances?.length ?? 0) > 0
              ? `${instances?.filter((instance) => instance.status === "connected").length ?? 0} instancia(s) conectadas.`
              : "Crea la instancia y pedí QR.",
        },
        {
          step: "5",
          title: "Workspace",
          status: selectedCompany.setup_ready ? "listo" : "bloqueado",
          description: selectedCompany.setup_ready ? "Ya podés entrar como cliente." : "Solo tiene sentido entrar cuando los pasos previos cierran.",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[30px] border-[#e9dfd2] bg-white shadow-none">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Cuentas</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Empresas activas</h2>
              </div>
              <span className="rounded-full border border-[#eadfce] bg-[#fcfaf6] px-3 py-1.5 text-xs font-semibold text-slate-600">
                {companies?.length ?? 0} seleccionables
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              {[
                { label: "Empresas", value: companies?.length ?? 0 },
                { label: "Listas", value: totals.ready },
                { label: "Profesionales", value: totals.professionals },
                { label: "Servicios", value: totals.services },
              ].map((item) => (
                <Card key={item.label} className="rounded-[24px] border-[#eadfce] bg-white shadow-none">
                  <CardContent className="p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{item.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[30px] border-[#e9dfd2] bg-white shadow-none">
          <CardContent className="p-7">
              <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[#17352d] text-white">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Paso 0</p>
                <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-950">Crear nueva empresa</h3>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Input value={companyForm.name} onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))} className="h-11 rounded-2xl border-[#eadfcd]" placeholder="Clinica Armonia Dental" />
              </div>
              <div className="space-y-2">
                <Label>Rubro</Label>
                <Select value={companyForm.industry} onValueChange={(value) => setCompanyForm((current) => ({ ...current, industry: value }))}>
                  <SelectTrigger className="h-11 rounded-2xl border-[#eadfcd]">
                    <SelectValue placeholder="Selecciona un vertical" />
                  </SelectTrigger>
                  <SelectContent>
                    {verticalOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>WhatsApp principal</Label>
                  <Input value={companyForm.whatsapp} onChange={(event) => setCompanyForm((current) => ({ ...current, whatsapp: event.target.value }))} className="h-11 rounded-2xl border-[#eadfcd]" placeholder="+54 9 11..." />
                </div>
                <div className="space-y-2">
                  <Label>Numero de escalacion</Label>
                  <Input value={companyForm.escalationNumber} onChange={(event) => setCompanyForm((current) => ({ ...current, escalationNumber: event.target.value }))} className="h-11 rounded-2xl border-[#eadfcd]" placeholder="+54 9 11..." />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Admin nombre</Label>
                  <Input value={companyForm.adminFullName} onChange={(event) => setCompanyForm((current) => ({ ...current, adminFullName: event.target.value }))} className="h-11 rounded-2xl border-[#eadfcd]" placeholder="Juliana Perez" />
                </div>
                <div className="space-y-2">
                  <Label>Admin email</Label>
                  <Input value={companyForm.adminEmail} onChange={(event) => setCompanyForm((current) => ({ ...current, adminEmail: event.target.value }))} className="h-11 rounded-2xl border-[#eadfcd]" placeholder="equipo@clinica.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Password temporal</Label>
                <Input type="password" value={companyForm.adminPassword} onChange={(event) => setCompanyForm((current) => ({ ...current, adminPassword: event.target.value }))} className="h-11 rounded-2xl border-[#eadfcd]" placeholder="••••••••" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Profesionales</Label>
                  <Input value={companyForm.professionals} onChange={(event) => setCompanyForm((current) => ({ ...current, professionals: event.target.value }))} className="h-11 rounded-2xl border-[#eadfcd]" placeholder="Dra. Nuñez, Dra. Mora" />
                </div>
                <div className="space-y-2">
                  <Label>Servicios</Label>
                  <Input value={companyForm.services} onChange={(event) => setCompanyForm((current) => ({ ...current, services: event.target.value }))} className="h-11 rounded-2xl border-[#eadfcd]" placeholder="Control, Limpieza, Consulta" />
                </div>
              </div>

              <Button disabled={creatingCompany} onClick={handleCreateCompany} className="mt-2 h-11 rounded-2xl bg-[#17352d] hover:bg-[#21453a]">
                <Plus className="mr-2 h-4 w-4" />
                {creatingCompany ? "Creando..." : "Crear empresa"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {(companies?.length ?? 0) === 0 ? (
        <Card className="rounded-[32px] border-[#ebe1d4] bg-white shadow-none">
          <CardContent className="px-8 py-14 text-center">
            <div className="mx-auto flex max-w-xl flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#17352d] text-white">
                <Building2 className="h-7 w-7" />
              </div>
              <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-slate-400">Primera cuenta</p>
              <h3 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                Crea la primera empresa para empezar
              </h3>
              <p className="mt-4 max-w-lg text-pretty text-sm leading-7 text-slate-500">
                Completa los datos básicos y después seguí con profesionales, Google, servicios y WhatsApp.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[32px] border-[#ebe1d4] bg-white shadow-none">
          <CardContent className="p-0">
            <div className="grid grid-cols-[minmax(0,1.2fr)_140px_120px_140px_160px] border-b border-[#efe6da] px-6 py-4 text-[11px] uppercase tracking-[0.18em] text-slate-400">
              <span>Empresa</span>
              <span>Setup</span>
              <span>WhatsApp</span>
              <span>Agenda</span>
              <span className="text-right">Accion</span>
            </div>
            <div className="divide-y divide-[#f1e8dd]">
              {(companies ?? []).map((company) => (
                <div
                  key={company.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedCompanyId(company.id);
                    setActiveCompanyId(company.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedCompanyId(company.id);
                      setActiveCompanyId(company.id);
                    }
                  }}
                  className={`grid w-full cursor-pointer grid-cols-[minmax(0,1.2fr)_140px_120px_140px_160px] items-center gap-4 px-6 py-5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17352d] ${selectedCompanyId === company.id ? "bg-[#fcfaf6]" : "hover:bg-[#fdfaf5]"}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{company.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{company.industry}</p>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{company.setup_progress}%</div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f1e8db]">
                      <div className="h-full rounded-full bg-[#17352d]" style={{ width: `${company.setup_progress}%` }} />
                    </div>
                  </div>
                  <span className={company.whatsapp_connected ? "text-sm font-semibold text-emerald-700" : "text-sm text-amber-700"}>
                    {company.whatsapp_connected ? "Listo" : "Pendiente"}
                  </span>
                  <span className={company.calendar_connected ? "text-sm font-semibold text-emerald-700" : "text-sm text-amber-700"}>
                    {company.calendar_connected ? "Lista" : "Pendiente"}
                  </span>
                  <div className="flex justify-end">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={activeCompanyId === company.id ? "default" : "outline"}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedCompanyId(company.id);
                          setActiveCompanyId(company.id);
                        }}
                        className={cn(
                          "h-10 rounded-2xl px-3",
                          activeCompanyId === company.id
                            ? "bg-[#17352d] text-white hover:bg-[#21453a]"
                            : "border-[#e5d9c8] bg-white text-slate-700 hover:bg-[#f7efe4]"
                        )}
                      >
                        {activeCompanyId === company.id ? "Activa" : "Usar"}
                      </Button>
                      <Button
                        type="button"
                        disabled={impersonatingId === company.id}
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleImpersonate(company.id);
                        }}
                        className="h-10 rounded-2xl px-3 text-slate-600 hover:bg-[#f7efe4] hover:text-slate-950"
                      >
                        {impersonatingId === company.id ? "Abriendo..." : "Ver como cliente"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-[#ebe1d4] bg-white shadow-none">
          <CardContent className="p-6">
            {selectedCompany ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Cuenta seleccionada</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{selectedCompany.name}</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {selectedCompany.industry} · {selectedCompany.professional_count} profesionales · {selectedCompany.service_count} servicios
                    </p>
                  </div>
                  <span className={statusBadge(selectedCompany.setup_ready)}>
                    {selectedCompany.setup_ready ? "Lista para demo" : "Falta setup"}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  {setupSteps.map((item) => (
                    <div key={item.step} className="rounded-[22px] border border-[#ece2d5] bg-[#fcfaf6] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full border border-[#e4d7c6] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          Paso {item.step}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            item.status === "listo"
                              ? "bg-emerald-50 text-emerald-700"
                              : item.status === "en curso"
                                ? "bg-sky-50 text-sky-700"
                                : item.status === "bloqueado"
                                  ? "bg-slate-100 text-slate-600"
                                  : "bg-amber-50 text-amber-700"
                          )}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[24px] border border-[#efe4d5] bg-[#fcfaf6] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Link2 className="h-4 w-4 text-[#17352d]" />
                      Google por profesional
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {googleStatus?.connected
                        ? `${googleStatus.connected_professional_count ?? 0} de ${googleStatus.professional_count ?? 0} profesionales ya tienen Google Calendar conectado.`
                        : "Todavía no hay profesionales con Google Calendar conectado."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" onClick={handleConnectGoogle} className="h-10 rounded-2xl border-[#e5d9c8] bg-white px-4 hover:bg-[#f7efe4]">
                        <CalendarRange className="mr-2 h-4 w-4" />
                        Ir a profesionales
                      </Button>
                      {googleStatus?.connected && (
                        <Button variant="outline" onClick={() => void mutateGoogleCalendars()} className="h-10 rounded-2xl border-[#e5d9c8] bg-white px-4 hover:bg-[#f7efe4]">
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Validar
                        </Button>
                      )}
                    </div>
                    {googleStatus?.connected && (
                      <div className="mt-4 rounded-[18px] border border-[#eadfce] bg-white p-3 text-xs text-slate-500">
                        {googleCalendars?.professionals?.length
                          ? googleCalendars.professionals.slice(0, 4).map((professional) => (
                              <div key={professional.id} className="flex items-center justify-between gap-3 py-1">
                                <span className="truncate">{professional.name}</span>
                                <span className="shrink-0 text-slate-400">
                                  {professional.is_connected ? professional.google_account_email ?? "Conectado" : "Pendiente"}
                                </span>
                              </div>
                            ))
                          : "Todavía no hay profesionales activos para configurar."}
                      </div>
                    )}
                  </div>

                  <div ref={whatsappSectionRef} className="rounded-[24px] border border-[#efe4d5] bg-[#fcfaf6] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Wifi className="h-4 w-4 text-[#17352d]" />
                      WhatsApp
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {(instances?.length ?? 0) > 0
                        ? `${instances?.filter((instance) => instance.status === "connected").length ?? 0} instancia(s) conectadas.`
                        : "Todavia no hay instancia creada para este cliente."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button disabled={creatingInstance} onClick={handleCreateInstance} className="h-10 rounded-2xl bg-[#17352d] px-4 hover:bg-[#21453a]">
                        <Plus className="mr-2 h-4 w-4" />
                        {creatingInstance ? "Creando..." : "Crear instancia"}
                      </Button>
                      {instances?.[0] && (
                        <>
                          <Button variant="outline" onClick={() => handleConnectInstance(instances[0].id)} className="h-10 rounded-2xl border-[#e5d9c8] bg-white px-4 hover:bg-[#f7efe4]">
                            <Wifi className="mr-2 h-4 w-4" />
                            Pedir QR
                          </Button>
                          <Button variant="outline" onClick={() => handleRefreshQr(instances[0].id)} className="h-10 rounded-2xl border-[#e5d9c8] bg-white px-4 hover:bg-[#f7efe4]">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refrescar
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => whatsappSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        className="h-10 rounded-2xl border-[#e5d9c8] bg-white px-4 hover:bg-[#f7efe4]"
                      >
                        Ver estado
                      </Button>
                    </div>
                    {(instances ?? []).length > 0 && (
                      <div className="mt-4 space-y-3">
                        {(instances ?? []).map((instance) => {
                          const qrSrc = toQrSrc(instanceQr[instance.id] ?? instance.qr_code);
                          return (
                            <div key={instance.id} className="rounded-[20px] border border-[#eadfce] bg-white p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-950">{instance.name}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {instance.status === "connected"
                                      ? `Conectado${instance.phone_number ? ` · ${instance.phone_number}` : ""}`
                                      : instance.status === "qr_pending"
                                      ? "Esperando escaneo QR"
                                      : "Desconectado"}
                                  </p>
                                </div>
                                <span className={instance.status === "connected" ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700" : "rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"}>
                                  {instance.status === "connected" ? "Conectado" : instance.status === "qr_pending" ? "QR" : "Pendiente"}
                                </span>
                              </div>
                              {qrSrc && instance.status !== "connected" && (
                                <div className="mt-3 rounded-[18px] border border-[#f0e7da] bg-[#fcfaf6] p-3">
                                  <Image
                                    src={qrSrc}
                                    alt={`QR ${instance.name}`}
                                    width={160}
                                    height={160}
                                    unoptimized
                                    className="mx-auto rounded-xl bg-white p-2"
                                  />
                                  <p className="mt-2 text-center text-xs text-slate-500">
                                    Escanea este QR desde WhatsApp para terminar la vinculacion.
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-[#efe4d5] bg-[#fcfaf6] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Wand2 className="h-4 w-4 text-[#17352d]" />
                      Estado de setup
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {selectedCompany.setup_progress}% completo · {googleStatus?.connected_professional_count ?? 0} profesionales con Google · {selectedCompany.connected_instance_count} instancias conectadas.
                    </p>
                    <Button
                      type="button"
                      disabled={!selectedCompany.setup_ready || impersonatingId === selectedCompany.id}
                      variant="outline"
                      onClick={() => void handleImpersonate(selectedCompany.id)}
                      className="mt-4 h-10 rounded-2xl border-[#e5d9c8] bg-white px-4 hover:bg-[#f7efe4]"
                    >
                      {impersonatingId === selectedCompany.id ? "Abriendo..." : "Abrir workspace"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card ref={professionalsSectionRef} className="rounded-[26px] border-[#ece2d5] bg-[#fcfaf6] shadow-none">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Paso 2 · Profesionales</p>
                          <h4 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Agenda por persona</h4>
                        </div>
                        <Button variant="outline" onClick={() => void mutateProfessionals()} className="h-9 rounded-2xl border-[#e5d9c8] bg-white px-3 hover:bg-[#f7efe4]">
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Actualizar
                        </Button>
                      </div>

                      <div className="mt-5 grid gap-3">
                        <Input value={professionalDraft.name} onChange={(event) => setProfessionalDraft((current) => ({ ...current, name: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="Nombre del profesional" />
                        <Input value={professionalDraft.specialty} onChange={(event) => setProfessionalDraft((current) => ({ ...current, specialty: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="Especialidad o rol" />
                        <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                          <select
                            value={professionalDraft.calendar_id}
                            onChange={(event) => setProfessionalDraft((current) => ({ ...current, calendar_id: event.target.value }))}
                            className="h-10 rounded-2xl border border-[#eadfcd] bg-white px-3 text-sm text-slate-700"
                          >
                            {(googleCalendars?.calendars?.length ?? 0) > 0 ? (
                              googleCalendars!.calendars.map((calendar) => (
                                <option key={calendar.id} value={calendar.id}>
                                  {calendar.summary}{calendar.primary ? " · principal" : ""}
                                </option>
                              ))
                            ) : (
                              <option value={professionalDraft.calendar_id}>
                                {professionalDraft.calendar_id || "primary"}
                              </option>
                            )}
                          </select>
                          <Input value={professionalDraft.color_hex} onChange={(event) => setProfessionalDraft((current) => ({ ...current, color_hex: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="#17352d" />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <Input
                            value={professionalDraft.user_full_name}
                            onChange={(event) => setProfessionalDraft((current) => ({ ...current, user_full_name: event.target.value }))}
                            className="h-10 rounded-2xl border-[#eadfcd]"
                            placeholder="Nombre para el login"
                          />
                          <Input
                            type="email"
                            value={professionalDraft.user_email}
                            onChange={(event) => setProfessionalDraft((current) => ({ ...current, user_email: event.target.value }))}
                            className="h-10 rounded-2xl border-[#eadfcd]"
                            placeholder="Email del profesional"
                          />
                        </div>
                        <Input
                          type="password"
                          value={professionalDraft.user_password}
                          onChange={(event) => setProfessionalDraft((current) => ({ ...current, user_password: event.target.value }))}
                          className="h-10 rounded-2xl border-[#eadfcd]"
                          placeholder="Password inicial del profesional"
                        />
                        <p className="text-xs text-slate-500">
                          Si dejás email y password vacíos, se crea solo la agenda. Si los completas, el profesional ya queda listo para iniciar sesión.
                        </p>
                        <Button disabled={creatingProfessional} onClick={handleCreateProfessional} className="h-10 rounded-2xl bg-[#17352d] hover:bg-[#21453a]">
                          <Plus className="mr-2 h-4 w-4" />
                          {creatingProfessional ? "Guardando..." : "Agregar profesional"}
                        </Button>
                      </div>

                      <div className="mt-5 space-y-3">
                        {(professionals ?? []).map((professional) => {
                          const draft = professionalEdits[professional.id] ?? {};
                          const validation = professionalValidationMap.get(professional.id);
                          const hasLogin = Boolean(professional.has_login ?? professional.user_id);
                          return (
                            <div key={professional.id} className="rounded-[22px] border border-[#eadfce] bg-white p-4">
                              <div className="grid gap-3">
                                <Input
                                  value={(draft.name as string | undefined) ?? professional.name}
                                  onChange={(event) => setProfessionalEdits((current) => ({ ...current, [professional.id]: { ...current[professional.id], name: event.target.value } }))}
                                  className="h-10 rounded-2xl border-[#eadfcd]"
                                />
                                <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
                                  <Input
                                    value={(draft.specialty as string | undefined) ?? (professional.specialty ?? "")}
                                    onChange={(event) => setProfessionalEdits((current) => ({ ...current, [professional.id]: { ...current[professional.id], specialty: event.target.value } }))}
                                    className="h-10 rounded-2xl border-[#eadfcd]"
                                    placeholder="Especialidad"
                                  />
                                  <select
                                    value={(draft.calendar_id as string | undefined) ?? professional.calendar_id}
                                    onChange={(event) => setProfessionalEdits((current) => ({ ...current, [professional.id]: { ...current[professional.id], calendar_id: event.target.value } }))}
                                    className="h-10 rounded-2xl border border-[#eadfcd] bg-white px-3 text-sm text-slate-700"
                                  >
                                    {(googleCalendars?.calendars?.length ?? 0) > 0 ? (
                                      googleCalendars!.calendars.map((calendar) => (
                                        <option key={calendar.id} value={calendar.id}>
                                          {calendar.summary}{calendar.primary ? " · principal" : ""}
                                        </option>
                                      ))
                                    ) : (
                                      <option value={(draft.calendar_id as string | undefined) ?? professional.calendar_id}>
                                        {(draft.calendar_id as string | undefined) ?? professional.calendar_id}
                                      </option>
                                    )}
                                  </select>
                                  <Input
                                    value={(draft.color_hex as string | undefined) ?? (professional.color_hex ?? "")}
                                    onChange={(event) => setProfessionalEdits((current) => ({ ...current, [professional.id]: { ...current[professional.id], color_hex: event.target.value } }))}
                                    className="h-10 rounded-2xl border-[#eadfcd]"
                                    placeholder="#17352d"
                                  />
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <Input
                                    value={(draft.user_full_name as string | undefined) ?? (professional.user_full_name ?? professional.name)}
                                    onChange={(event) => setProfessionalEdits((current) => ({ ...current, [professional.id]: { ...current[professional.id], user_full_name: event.target.value } }))}
                                    className="h-10 rounded-2xl border-[#eadfcd]"
                                    placeholder="Nombre del login"
                                  />
                                  <Input
                                    type="email"
                                    value={(draft.user_email as string | undefined) ?? (professional.user_email ?? "")}
                                    onChange={(event) => setProfessionalEdits((current) => ({ ...current, [professional.id]: { ...current[professional.id], user_email: event.target.value } }))}
                                    className="h-10 rounded-2xl border-[#eadfcd]"
                                    placeholder="Email del login"
                                  />
                                </div>
                                <Input
                                  type="password"
                                  value={(draft.user_password as string | undefined) ?? ""}
                                  onChange={(event) => setProfessionalEdits((current) => ({ ...current, [professional.id]: { ...current[professional.id], user_password: event.target.value } }))}
                                  className="h-10 rounded-2xl border-[#eadfcd]"
                                  placeholder={hasLogin ? "Nueva password (opcional)" : "Password inicial para crear login"}
                                />
                                <div className={`rounded-2xl px-3 py-2 text-xs ${validation?.is_connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                  {validation?.is_connected
                                    ? `Google conectado${validation.google_account_email ? ` · ${validation.google_account_email}` : ""}`
                                    : `Google pendiente para ${((draft.user_email as string | undefined) ?? professional.user_email ?? professional.name)}`}
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${hasLogin ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                    {hasLogin ? "Login activo" : "Sin login"}
                                  </span>
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      validation?.is_connected
                                        ? void handleDisconnectProfessionalGoogle(professional.id)
                                        : handleConnectProfessionalGoogle(professional.id)
                                    }
                                    className="h-9 rounded-2xl border-[#e5d9c8] bg-white px-3 hover:bg-[#f7efe4]"
                                  >
                                    <CalendarRange className="mr-2 h-4 w-4" />
                                    {validation?.is_connected ? "Desconectar Google" : "Conectar Google"}
                                  </Button>
                                </div>
                                <Button variant="outline" onClick={() => handleDeleteProfessional(professional.id)} className="h-9 rounded-2xl border-[#edd6d3] bg-white px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar
                                </Button>
                                <Button onClick={() => handleSaveProfessional(professional)} className="h-9 rounded-2xl bg-[#17352d] px-3 hover:bg-[#21453a]">
                                  Guardar
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {(professionals ?? []).length === 0 && (
                          <div className="rounded-[22px] border border-dashed border-[#e5d9c7] bg-white px-4 py-8 text-center text-sm text-slate-500">
                            Todavia no hay profesionales para esta cuenta.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card ref={servicesSectionRef} className="rounded-[26px] border-[#ece2d5] bg-[#fcfaf6] shadow-none">
                    <CardContent className="p-5">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Paso 3 · Servicios</p>
                        <h4 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Qué se puede reservar</h4>
                      </div>

                      <div className="mt-5 grid gap-3">
                        <Input value={serviceDraft.name} onChange={(event) => setServiceDraft((current) => ({ ...current, name: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="Nombre del servicio" />
                        <Input value={serviceDraft.aliases} onChange={(event) => setServiceDraft((current) => ({ ...current, aliases: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="Aliases para el bot: corte, pelo, corte clasico" />
                        <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                          <Input value={serviceDraft.duration_minutes} onChange={(event) => setServiceDraft((current) => ({ ...current, duration_minutes: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="60" />
                          <Input value={serviceDraft.price} onChange={(event) => setServiceDraft((current) => ({ ...current, price: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="25000" />
                        </div>
                        <select
                          value={serviceDraft.professional_id}
                          onChange={(event) => setServiceDraft((current) => ({ ...current, professional_id: event.target.value }))}
                          className="h-10 rounded-2xl border border-[#eadfcd] bg-white px-3 text-sm text-slate-700"
                        >
                          <option value="all">Disponible para todos</option>
                          {(professionals ?? []).map((professional) => (
                            <option key={professional.id} value={professional.id}>
                              {professional.name}
                            </option>
                          ))}
                        </select>
                        <Input value={serviceDraft.description} onChange={(event) => setServiceDraft((current) => ({ ...current, description: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="Descripcion corta" />
                        <Button disabled={creatingService} onClick={handleCreateService} className="h-10 rounded-2xl bg-[#17352d] hover:bg-[#21453a]">
                          <Plus className="mr-2 h-4 w-4" />
                          {creatingService ? "Guardando..." : "Agregar servicio"}
                        </Button>
                      </div>

                      <div className="mt-5 space-y-3">
                        {(services ?? []).map((service) => {
                          const draft = serviceEdits[service.id] ?? {};
                          return (
                            <div key={service.id} className="rounded-[22px] border border-[#eadfce] bg-white p-4">
                              <div className="grid gap-3">
                                <Input
                                  value={(draft.name as string | undefined) ?? service.name}
                                  onChange={(event) => setServiceEdits((current) => ({ ...current, [service.id]: { ...current[service.id], name: event.target.value } }))}
                                  className="h-10 rounded-2xl border-[#eadfcd]"
                                />
                                <Input
                                  value={draft.aliases_text ?? (service.aliases ?? []).join(", ")}
                                  onChange={(event) => setServiceEdits((current) => ({
                                    ...current,
                                    [service.id]: {
                                      ...current[service.id],
                                      aliases_text: event.target.value,
                                      aliases: parseCommaList(event.target.value),
                                    },
                                  }))}
                                  className="h-10 rounded-2xl border-[#eadfcd]"
                                  placeholder="Aliases para el bot"
                                />
                                <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                                  <Input
                                    value={String((draft.duration_minutes as number | undefined) ?? service.duration_minutes)}
                                    onChange={(event) => setServiceEdits((current) => ({ ...current, [service.id]: { ...current[service.id], duration_minutes: Number(event.target.value) || 60 } }))}
                                    className="h-10 rounded-2xl border-[#eadfcd]"
                                  />
                                  <Input
                                    value={String((draft.price as number | undefined) ?? service.price)}
                                    onChange={(event) => setServiceEdits((current) => ({ ...current, [service.id]: { ...current[service.id], price: parsePriceInput(event.target.value) ?? service.price } }))}
                                    className="h-10 rounded-2xl border-[#eadfcd]"
                                    placeholder="Precio"
                                  />
                                </div>
                                <select
                                  value={(draft.professional_id as string | undefined) ?? (service.professional_id ?? "all")}
                                  onChange={(event) => setServiceEdits((current) => ({ ...current, [service.id]: { ...current[service.id], professional_id: event.target.value === "all" ? null : event.target.value } }))}
                                  className="h-10 rounded-2xl border border-[#eadfcd] bg-white px-3 text-sm text-slate-700"
                                >
                                  <option value="all">Disponible para todos</option>
                                  {(professionals ?? []).map((professional) => (
                                    <option key={professional.id} value={professional.id}>
                                      {professional.name}
                                    </option>
                                  ))}
                                </select>
                                <Input
                                  value={(draft.description as string | undefined) ?? service.description}
                                  onChange={(event) => setServiceEdits((current) => ({ ...current, [service.id]: { ...current[service.id], description: event.target.value } }))}
                                  className="h-10 rounded-2xl border-[#eadfcd]"
                                  placeholder="Descripcion"
                                />
                              </div>
                              <div className="mt-3 flex items-center justify-end gap-2">
                                <Button variant="outline" onClick={() => handleDeleteService(service.id)} className="h-9 rounded-2xl border-[#edd6d3] bg-white px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar
                                </Button>
                                <Button onClick={() => handleSaveService(service)} className="h-9 rounded-2xl bg-[#17352d] px-3 hover:bg-[#21453a]">
                                  Guardar
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {(services ?? []).length === 0 && (
                          <div className="rounded-[22px] border border-dashed border-[#e5d9c7] bg-white px-4 py-8 text-center text-sm text-slate-500">
                            Todavia no hay servicios para esta cuenta.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

              </div>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-[#e7dbc8] bg-[#fcfaf6] text-center">
                <div className="max-w-sm px-6">
                  <Building2 className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-4 text-lg font-semibold text-slate-950">Todavia no hay empresas seleccionadas</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Elegí una empresa y seguí el orden: profesionales, Google, servicios, WhatsApp y recién después workspace.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      )}
    </div>
  );
}
