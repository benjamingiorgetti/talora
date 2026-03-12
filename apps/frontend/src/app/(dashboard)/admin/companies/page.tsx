"use client";

import SuperadminCompaniesPage from "@/app/(dashboard)/superadmin/companies/page";
import { RequireAdminAccess } from "@/components/role-guards";

export default function AdminCompaniesPage() {
  return (
    <RequireAdminAccess description="Companias, setup, Google Calendar, QR y configuracion operativa quedan reservados para Talora.">
      <SuperadminCompaniesPage />
    </RequireAdminAccess>
  );
}
