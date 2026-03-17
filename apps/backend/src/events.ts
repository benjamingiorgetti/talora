import { EventEmitter } from 'events';

export interface AppointmentCreatedEvent {
  appointmentId: string;
  clientId: string | null;
  companyId: string;
  serviceId: string | null;
  professionalId: string | null;
}

export interface AppointmentCancelledEvent {
  appointmentId: string;
  companyId: string;
  serviceId: string | null;
  professionalId: string | null;
  startsAt: string;
  cancelledClientId: string | null;
}

export const appEvents = new EventEmitter();
appEvents.setMaxListeners(20);
appEvents.on('error', (err) => {
  console.error('[appEvents] Unhandled event error:', err);
});
