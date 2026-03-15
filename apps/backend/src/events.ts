import { EventEmitter } from 'events';

export interface AppointmentCreatedEvent {
  appointmentId: string;
  clientId: string | null;
  companyId: string;
  serviceId: string | null;
  professionalId: string | null;
}

export const appEvents = new EventEmitter();
