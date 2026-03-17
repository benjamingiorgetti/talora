"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { Professional, Service, WhatsAppInstance } from "@talora/shared";
import { toast } from "sonner";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RequireAdminAccess } from "@/components/role-guards";
import {
  type CompanyOverview,
  type GoogleStatus,
  type GoogleCalendarValidation,
  type ProfessionalEditDraft,
  type ServiceEditDraft,
  API_BASE_URL,
  emptyCompany,
  emptyProfessional,
  emptyService,
  parseCommaList,
  parsePriceInput,
} from "./_components/types";
import { CompanyList } from "./_components/company-list";
import { CompanyEditView } from "./_components/company-edit-view";
import { CreateCompanyDialog } from "./_components/create-company-dialog";

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
  const [activeTab, setActiveTab] = useState("general");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Redirect /superadmin/companies → /admin/companies
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (pathname === "/superadmin/companies") {
      router.replace("/admin/companies");
    }
  }, [pathname, router]);

  // ---------------------------------------------------------------------------
  // SWR fetches scoped to selected company
  // ---------------------------------------------------------------------------
  const companyScope = selectedCompanyId ? `company_id=${encodeURIComponent(selectedCompanyId)}` : null;
  const { data: professionals, mutate: mutateProfessionals } = useSWR<Professional[]>(
    companyScope ? `/professionals?${companyScope}` : null, fetcher
  );
  const { data: services, mutate: mutateServices } = useSWR<Service[]>(
    companyScope ? `/services?${companyScope}` : null, fetcher
  );
  const { data: instances, mutate: mutateInstances } = useSWR<WhatsAppInstance[]>(
    companyScope ? `/instances?${companyScope}` : null, fetcher
  );
  const { data: googleStatus, mutate: mutateGoogleStatus } = useSWR<GoogleStatus>(
    companyScope ? `/auth/google/status?${companyScope}` : null, fetcher
  );
  const { data: googleCalendars, mutate: mutateGoogleCalendars } = useSWR<GoogleCalendarValidation>(
    companyScope ? `/auth/google/calendars?${companyScope}` : null, fetcher
  );

  const selectedCompany = useMemo(
    () => (companies ?? []).find((c) => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const refreshSelectedWorkspace = useCallback(async () => {
    await Promise.all([
      mutateCompanies(), mutateProfessionals(), mutateServices(),
      mutateInstances(), mutateGoogleStatus(), mutateGoogleCalendars(),
    ]);
  }, [mutateCompanies, mutateGoogleCalendars, mutateGoogleStatus, mutateInstances, mutateProfessionals, mutateServices]);

  // ---------------------------------------------------------------------------
  // Calendar OAuth redirect handler
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // QR polling for pending WhatsApp instances
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedCompanyId || !instances?.length) return;
    const pendingIds = instances.filter((i) => i.status !== "connected").map((i) => i.id);
    if (pendingIds.length === 0) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const responses = await Promise.all(
          pendingIds.map(async (id) => {
            const r = await api.get<{ data: { status: string; qr_code: string | null } }>(
              `/instances/${id}/qr?company_id=${selectedCompanyId}`
            );
            return { id, payload: r.data };
          })
        );
        if (cancelled) return;
        let shouldRefresh = false;
        setInstanceQr((current) => {
          const next = { ...current };
          for (const r of responses) {
            if (r.payload.status === "connected") { delete next[r.id]; shouldRefresh = true; continue; }
            if (r.payload.qr_code) next[r.id] = r.payload.qr_code;
          }
          return next;
        });
        if (shouldRefresh) await mutateInstances();
      } catch { /* best-effort polling */ }
    };
    void poll();
    const interval = window.setInterval(() => { void poll(); }, 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [instances, mutateInstances, selectedCompanyId]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleCreateCompany = async () => {
    if (!companyForm.name.trim() || !companyForm.industry.trim() || !companyForm.adminEmail.trim() || !companyForm.adminPassword.trim() || !companyForm.adminFullName.trim()) {
      toast.error("Completa empresa, rubro y credenciales del admin."); return;
    }
    setCreatingCompany(true);
    try {
      const response = await api.post<{ data: { company: CompanyOverview } }>("/companies", {
        name: companyForm.name.trim(), industry: companyForm.industry,
        whatsapp_number: companyForm.whatsapp.trim() || null, escalation_number: companyForm.escalationNumber.trim() || null,
        admin_email: companyForm.adminEmail.trim(), admin_password: companyForm.adminPassword,
        admin_full_name: companyForm.adminFullName.trim(), professionals: [], services: [],
      });
      await mutateCompanies();
      setSelectedCompanyId(response.data.company.id);
      setActiveCompanyId(response.data.company.id);
      setCompanyForm(emptyCompany);
      setCreateDialogOpen(false);
      setActiveTab("whatsapp");
      toast.success("Empresa creada. Conecta WhatsApp para empezar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la empresa.");
    } finally { setCreatingCompany(false); }
  };

  const handleImpersonate = async (companyId: string) => {
    setImpersonatingId(companyId);
    try { await impersonate(companyId); } catch (error) {
      const msg = error instanceof Error ? error.message : "No se pudo abrir el workspace.";
      toast.error(msg.includes("No company admin available") ? "Esta empresa todavia no tiene un admin cliente listo para abrir el workspace." : msg);
      setImpersonatingId(null);
    }
  };

  const handleCreateProfessional = async () => {
    if (!selectedCompanyId || !professionalDraft.name.trim() || !professionalDraft.calendar_id.trim()) {
      toast.error("Completa nombre y calendario del profesional."); return;
    }
    if ((professionalDraft.user_email && !professionalDraft.user_password) || (!professionalDraft.user_email && professionalDraft.user_password)) {
      toast.error("Si queres crear login, completa email y password."); return;
    }
    setCreatingProfessional(true);
    try {
      await api.post(`/professionals?company_id=${selectedCompanyId}`, {
        ...professionalDraft, name: professionalDraft.name.trim(), specialty: professionalDraft.specialty.trim(),
        user_email: professionalDraft.user_email.trim() || undefined, user_password: professionalDraft.user_password || undefined,
        user_full_name: professionalDraft.user_full_name.trim() || professionalDraft.name.trim(),
      });
      setProfessionalDraft(emptyProfessional);
      await refreshSelectedWorkspace();
      toast.success("Profesional agregado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el profesional.");
    } finally { setCreatingProfessional(false); }
  };

  const handleSaveProfessional = async (professional: Professional) => {
    if (!selectedCompanyId) return;
    const draft = professionalEdits[professional.id];
    if (!draft) return;
    const effectiveEmail = (draft.user_email as string | undefined) ?? professional.user_email ?? "";
    const hasExistingLogin = Boolean(professional.has_login ?? professional.user_id);
    if (!hasExistingLogin && ((effectiveEmail && !draft.user_password) || (!effectiveEmail && draft.user_password))) {
      toast.error("Para crear el login del profesional, completa email y password."); return;
    }
    try {
      await api.put(`/professionals/${professional.id}?company_id=${selectedCompanyId}`, draft);
      setProfessionalEdits((c) => { const next = { ...c }; delete next[professional.id]; return next; });
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
    if (!selectedCompanyId || !serviceDraft.name.trim()) { toast.error("Completa al menos el nombre del servicio."); return; }
    const price = parsePriceInput(serviceDraft.price);
    if (price === null) { toast.error("El precio es obligatorio y debe ser un entero."); return; }
    setCreatingService(true);
    try {
      await api.post(`/services?company_id=${selectedCompanyId}`, {
        ...serviceDraft, name: serviceDraft.name.trim(), aliases: parseCommaList(serviceDraft.aliases),
        duration_minutes: Number(serviceDraft.duration_minutes) || 60, price,
        professional_id: serviceDraft.professional_id === "all" ? null : serviceDraft.professional_id,
      });
      setServiceDraft(emptyService);
      await refreshSelectedWorkspace();
      toast.success("Servicio agregado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el servicio.");
    } finally { setCreatingService(false); }
  };

  const handleSaveService = async (service: Service) => {
    if (!selectedCompanyId) return;
    const draft = serviceEdits[service.id];
    if (!draft) return;
    try {
      await api.put(`/services/${service.id}?company_id=${selectedCompanyId}`, draft);
      setServiceEdits((c) => { const next = { ...c }; delete next[service.id]; return next; });
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
      await api.post("/instances", { company_id: selectedCompanyId, name: `${selectedCompany.name} WhatsApp` });
      await refreshSelectedWorkspace();
      toast.success("Instancia creada. Ya podes pedir el QR.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la instancia.");
    } finally { setCreatingInstance(false); }
  };

  const handleConnectInstance = async (instanceId: string) => {
    if (!selectedCompanyId) return;
    try {
      await api.post(`/instances/${instanceId}/connect?company_id=${selectedCompanyId}`);
      const qrResponse = await api.get<{ data: { status: string; qr_code: string | null } }>(
        `/instances/${instanceId}/qr?company_id=${selectedCompanyId}`
      );
      setInstanceQr((c) => ({ ...c, [instanceId]: qrResponse.data.qr_code }));
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
      setInstanceQr((c) => {
        const next = { ...c };
        if (qrResponse.data.status === "connected") { delete next[instanceId]; return next; }
        next[instanceId] = qrResponse.data.qr_code; return next;
      });
      await mutateInstances();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo refrescar el QR.");
    }
  };

  const handleConnectProfessionalGoogle = (professionalId: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) { toast.error("La sesion expiro. Volve a iniciar sesion."); return; }
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

  const handleDeleteInstance = async (instanceId: string) => {
    if (!selectedCompanyId) return;
    try {
      await api.delete(`/instances/${instanceId}?company_id=${selectedCompanyId}`);
      await refreshSelectedWorkspace();
      toast.success("Instancia eliminada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar la instancia.");
    }
  };

  const handleBack = () => {
    setSelectedCompanyId(null);
    setProfessionalEdits({});
    setServiceEdits({});
    setActiveTab("general");
  };

  const handleEdit = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setActiveCompanyId(companyId);
    setProfessionalEdits({});
    setServiceEdits({});
    setActiveTab("general");
  };

  // ---------------------------------------------------------------------------
  // Guard
  // ---------------------------------------------------------------------------
  if (!session || session.role !== "superadmin") {
    return (
      <RequireAdminAccess description="Si estas viendo esto como cliente o en modo impersonacion, primero volve a Talora para administrar empresas.">
        {null}
      </RequireAdminAccess>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Superadmin</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Empresas</h1>
        </div>
        {!selectedCompanyId && (
          <CreateCompanyDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            form={companyForm}
            onFormChange={setCompanyForm}
            creating={creatingCompany}
            onCreate={() => void handleCreateCompany()}
          />
        )}
      </div>

      {/* View toggle: list vs edit */}
      {selectedCompanyId && selectedCompany ? (
        <CompanyEditView
          company={selectedCompany}
          onCompanyUpdated={() => void mutateCompanies()}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onBack={handleBack}
          onImpersonate={() => void handleImpersonate(selectedCompany.id)}
          isImpersonating={impersonatingId === selectedCompany.id}
          instances={instances}
          instanceQr={instanceQr}
          creatingInstance={creatingInstance}
          onCreateInstance={() => void handleCreateInstance()}
          onConnectInstance={(id) => void handleConnectInstance(id)}
          onRefreshQr={(id) => void handleRefreshQr(id)}
          onDeleteInstance={(id) => void handleDeleteInstance(id)}
          professionals={professionals}
          googleCalendars={googleCalendars}
          professionalDraft={professionalDraft}
          setProfessionalDraft={setProfessionalDraft}
          professionalEdits={professionalEdits}
          setProfessionalEdits={setProfessionalEdits}
          creatingProfessional={creatingProfessional}
          onCreateProfessional={() => void handleCreateProfessional()}
          onSaveProfessional={(p) => void handleSaveProfessional(p)}
          onDeleteProfessional={(id) => void handleDeleteProfessional(id)}
          onConnectGoogle={handleConnectProfessionalGoogle}
          onDisconnectGoogle={(id) => void handleDisconnectProfessionalGoogle(id)}
          onRefreshProfessionals={() => void mutateProfessionals()}
          services={services}
          serviceDraft={serviceDraft}
          setServiceDraft={setServiceDraft}
          serviceEdits={serviceEdits}
          setServiceEdits={setServiceEdits}
          creatingService={creatingService}
          onCreateService={() => void handleCreateService()}
          onSaveService={(s) => void handleSaveService(s)}
          onDeleteService={(id) => void handleDeleteService(id)}
        />
      ) : (
        <CompanyList
          companies={companies}
          impersonatingId={impersonatingId}
          onEdit={handleEdit}
          onImpersonate={(id) => void handleImpersonate(id)}
          onCreateOpen={() => setCreateDialogOpen(true)}
        />
      )}
    </div>
  );
}
