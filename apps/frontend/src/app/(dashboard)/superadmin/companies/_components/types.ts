import type { Company, Professional, Service, WhatsAppInstance } from "@talora/shared";

export type CompanyOverview = Company & {
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

export type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  company_id?: string;
  professional_count?: number;
  connected_professional_count?: number;
};

export type GoogleCalendarOption = {
  id: string;
  summary: string;
  primary: boolean;
  access_role: string;
  background_color: string | null;
};

export type GoogleCalendarValidation = {
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

export type ProfessionalEditDraft = Partial<Professional> & {
  user_email?: string;
  user_password?: string;
  user_full_name?: string;
  user_is_active?: boolean;
};

export type ServiceEditDraft = Partial<Service> & {
  aliases_text?: string;
};

export const verticalOptions = ["Peluqueria", "Dentista", "Tatuajes", "Service del auto"];
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const emptyCompany = {
  name: "",
  industry: "",
  whatsapp: "",
  escalationNumber: "",
  adminFullName: "",
  adminEmail: "",
  adminPassword: "",
};

export const emptyProfessional = {
  name: "",
  specialty: "",
  calendar_id: "primary",
  color_hex: "#17352d",
  user_email: "",
  user_password: "",
  user_full_name: "",
};

export const emptyService = {
  name: "",
  aliases: "",
  duration_minutes: "60",
  price: "",
  description: "",
  professional_id: "all",
};

export function toQrSrc(value: string | null | undefined) {
  if (!value) return null;
  return value.startsWith("data:image") ? value : `data:image/png;base64,${value}`;
}

export function parseCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parsePriceInput(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
}
