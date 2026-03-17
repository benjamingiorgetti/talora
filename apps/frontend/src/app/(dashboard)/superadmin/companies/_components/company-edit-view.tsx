"use client";

import type { Professional, Service, WhatsAppInstance } from "@talora/shared";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CompanyOverview, GoogleCalendarValidation, ProfessionalEditDraft, ServiceEditDraft } from "./types";
import { TabGeneral } from "./tab-general";
import { TabWhatsapp } from "./tab-whatsapp";
import { TabEquipo } from "./tab-equipo";
import { TabServicios } from "./tab-servicios";

export function CompanyEditView({
  company,
  onCompanyUpdated,
  activeTab,
  setActiveTab,
  onBack,
  onImpersonate,
  isImpersonating,
  // WhatsApp
  instances,
  instanceQr,
  creatingInstance,
  onCreateInstance,
  onConnectInstance,
  onRefreshQr,
  onDeleteInstance,
  // Equipo
  professionals,
  googleCalendars,
  professionalDraft,
  setProfessionalDraft,
  professionalEdits,
  setProfessionalEdits,
  creatingProfessional,
  onCreateProfessional,
  onSaveProfessional,
  onDeleteProfessional,
  onConnectGoogle,
  onDisconnectGoogle,
  onRefreshProfessionals,
  // Servicios
  services,
  serviceDraft,
  setServiceDraft,
  serviceEdits,
  setServiceEdits,
  creatingService,
  onCreateService,
  onSaveService,
  onDeleteService,
}: {
  company: CompanyOverview;
  onCompanyUpdated: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onBack: () => void;
  onImpersonate: () => void;
  isImpersonating: boolean;
  // WhatsApp
  instances: WhatsAppInstance[] | undefined;
  instanceQr: Record<string, string | null>;
  creatingInstance: boolean;
  onCreateInstance: () => void;
  onConnectInstance: (instanceId: string) => void;
  onRefreshQr: (instanceId: string) => void;
  onDeleteInstance: (instanceId: string) => void;
  // Equipo
  professionals: Professional[] | undefined;
  googleCalendars: GoogleCalendarValidation | undefined;
  professionalDraft: { name: string; specialty: string; calendar_id: string; color_hex: string; user_email: string; user_password: string; user_full_name: string };
  setProfessionalDraft: (updater: (current: typeof professionalDraft) => typeof professionalDraft) => void;
  professionalEdits: Record<string, ProfessionalEditDraft>;
  setProfessionalEdits: (updater: (current: Record<string, ProfessionalEditDraft>) => Record<string, ProfessionalEditDraft>) => void;
  creatingProfessional: boolean;
  onCreateProfessional: () => void;
  onSaveProfessional: (professional: Professional) => void;
  onDeleteProfessional: (professionalId: string) => void;
  onConnectGoogle: (professionalId: string) => void;
  onDisconnectGoogle: (professionalId: string) => void;
  onRefreshProfessionals: () => void;
  // Servicios
  services: Service[] | undefined;
  serviceDraft: { name: string; aliases: string; duration_minutes: string; price: string; description: string; professional_id: string };
  setServiceDraft: (updater: (current: typeof serviceDraft) => typeof serviceDraft) => void;
  serviceEdits: Record<string, ServiceEditDraft>;
  setServiceEdits: (updater: (current: Record<string, ServiceEditDraft>) => Record<string, ServiceEditDraft>) => void;
  creatingService: boolean;
  onCreateService: () => void;
  onSaveService: (service: Service) => void;
  onDeleteService: (serviceId: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a empresas
        </button>
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">{company.name}</h2>
        <Button
          variant="outline"
          disabled={!company.setup_ready || isImpersonating}
          onClick={onImpersonate}
          className="h-9 rounded-2xl border-[#e5d9c8] bg-white px-4 hover:bg-[#f7efe4]"
        >
          {isImpersonating ? "Abriendo..." : "Ver como cliente"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-11 w-full justify-start rounded-2xl border border-[#eadfce] bg-[#fcfaf6] p-1">
          <TabsTrigger value="general" className="rounded-xl px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            General
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="rounded-xl px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="equipo" className="rounded-xl px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Equipo ({professionals?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="servicios" className="rounded-xl px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Servicios ({services?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <div className="mx-auto mt-4 max-w-3xl">
          <TabsContent value="general">
            <TabGeneral company={company} onUpdated={onCompanyUpdated} />
          </TabsContent>

          <TabsContent value="whatsapp">
            <TabWhatsapp
              instances={instances}
              instanceQr={instanceQr}
              creatingInstance={creatingInstance}
              onCreateInstance={onCreateInstance}
              onConnectInstance={onConnectInstance}
              onRefreshQr={onRefreshQr}
              onDeleteInstance={onDeleteInstance}
            />
          </TabsContent>

          <TabsContent value="equipo">
            <TabEquipo
              professionals={professionals}
              googleCalendars={googleCalendars}
              professionalDraft={professionalDraft}
              setProfessionalDraft={setProfessionalDraft}
              professionalEdits={professionalEdits}
              setProfessionalEdits={setProfessionalEdits}
              creatingProfessional={creatingProfessional}
              onCreateProfessional={onCreateProfessional}
              onSaveProfessional={onSaveProfessional}
              onDeleteProfessional={onDeleteProfessional}
              onConnectGoogle={onConnectGoogle}
              onDisconnectGoogle={onDisconnectGoogle}
              onRefresh={onRefreshProfessionals}
            />
          </TabsContent>

          <TabsContent value="servicios">
            <TabServicios
              services={services}
              professionals={professionals}
              serviceDraft={serviceDraft}
              setServiceDraft={setServiceDraft}
              serviceEdits={serviceEdits}
              setServiceEdits={setServiceEdits}
              creatingService={creatingService}
              onCreateService={onCreateService}
              onSaveService={onSaveService}
              onDeleteService={onDeleteService}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
