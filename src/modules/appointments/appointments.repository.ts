import { Prisma } from '@prisma/client';
import prisma from '../../shared/db/client';

export interface IAppointmentsRepository {
  findVehicleByOwner(vehicleId: string, ownerId: string): Promise<{ id: string } | null>;
  findServiceType(id: string): Promise<{ id: string; durationMinutes: number } | null>;
  findAvailableBay(dealershipId: string, start: Date, end: Date, excludeId?: string): Promise<{ id: string } | null>;
  findAvailableTechnician(dealershipId: string, serviceTypeId: string, start: Date, end: Date, excludeId?: string): Promise<{ id: string } | null>;
  createAppointmentWithOutbox(data: {
    customerId: string; vehicleId: string; technicianId: string;
    serviceBayId: string; serviceTypeId: string; startTime: Date; endTime: Date;
  }): Promise<any>;
  findAppointmentByOwner(appointmentId: string, customerId: string): Promise<any | null>;
  cancelAppointment(appointmentId: string): Promise<any>;
  rescheduleAppointment(appointmentId: string, startTime: Date, endTime: Date, bayId: string, technicianId: string): Promise<any>;
  listAppointmentsByCustomer(customerId: string): Promise<any[]>;
  getAvailableSlots(dealershipId: string, serviceTypeId: string, date: Date, durationMinutes: number): Promise<Date[]>;
}

export const appointmentsRepository: IAppointmentsRepository = {
  findVehicleByOwner: (vehicleId, ownerId) =>
    prisma.vehicle.findFirst({ where: { id: vehicleId, ownerId }, select: { id: true } }),

  findServiceType: (id) =>
    prisma.serviceType.findUnique({ where: { id }, select: { id: true, durationMinutes: true } }),

  findAvailableBay: async (dealershipId, start, end, excludeId?) => {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT sb.id FROM service_bays sb
      WHERE sb.dealership_id = ${dealershipId}::uuid
        AND NOT EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.service_bay_id = sb.id
            AND a.status = 'CONFIRMED'
            AND a.start_time < ${end}
            AND a.end_time   > ${start}
            ${excludeId ? Prisma.sql`AND a.id != ${excludeId}::uuid` : Prisma.empty}
        )
      LIMIT 1
    `;
    return rows[0] ?? null;
  },

  findAvailableTechnician: async (dealershipId, serviceTypeId, start, end, excludeId?) => {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT t.id FROM technicians t
      INNER JOIN technician_certifications tc ON tc.technician_id = t.id
      WHERE t.dealership_id   = ${dealershipId}::uuid
        AND tc.service_type_id = ${serviceTypeId}::uuid
        AND NOT EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.technician_id = t.id
            AND a.status = 'CONFIRMED'
            AND a.start_time < ${end}
            AND a.end_time   > ${start}
            ${excludeId ? Prisma.sql`AND a.id != ${excludeId}::uuid` : Prisma.empty}
        )
      LIMIT 1
    `;
    return rows[0] ?? null;
  },

  createAppointmentWithOutbox: (data) =>
    prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.create({
        data: { ...data, status: 'CONFIRMED' },
        include: { serviceType: true, serviceBay: true, technician: true, vehicle: true },
      });
      await tx.$executeRaw`
        INSERT INTO outbox (event_type, payload)
        VALUES ('appointment.confirmed', ${JSON.stringify({ appointmentId: appt.id, customerId: data.customerId })}::jsonb)
      `;
      return appt;
    }),

  findAppointmentByOwner: (appointmentId, customerId) =>
    prisma.appointment.findFirst({
      where: { id: appointmentId, customerId },
      include: { serviceType: true, serviceBay: { include: { dealership: true } }, technician: true, vehicle: true },
    }),

  cancelAppointment: (appointmentId) =>
    prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.update({ where: { id: appointmentId }, data: { status: 'CANCELLED' } });
      await tx.$executeRaw`
        INSERT INTO outbox (event_type, payload)
        VALUES ('appointment.cancelled', ${JSON.stringify({ appointmentId, customerId: appt.customerId })}::jsonb)
      `;
      return appt;
    }),

  rescheduleAppointment: (appointmentId, startTime, endTime, bayId, technicianId) =>
    prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.update({
        where: { id: appointmentId },
        data: { startTime, endTime, serviceBayId: bayId, technicianId },
      });
      await tx.$executeRaw`
        INSERT INTO outbox (event_type, payload)
        VALUES ('appointment.rescheduled', ${JSON.stringify({ appointmentId, customerId: appt.customerId })}::jsonb)
      `;
      return appt;
    }),

  listAppointmentsByCustomer: (customerId) =>
    prisma.appointment.findMany({
      where: { customerId },
      include: { serviceType: true, serviceBay: true, technician: true, vehicle: true },
      orderBy: { startTime: 'asc' },
    }),

  getAvailableSlots: async (dealershipId, serviceTypeId, date, durationMinutes) => {
    const slots: Date[] = [];
    const dayStart = new Date(date);
    dayStart.setUTCHours(8, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(18, 0, 0, 0);

    let cursor = new Date(dayStart);
    while (cursor < dayEnd) {
      const end = new Date(cursor.getTime() + durationMinutes * 60_000);
      if (end > dayEnd) break;
      const [bay, tech] = await Promise.all([
        appointmentsRepository.findAvailableBay(dealershipId, cursor, end),
        appointmentsRepository.findAvailableTechnician(dealershipId, serviceTypeId, cursor, end),
      ]);
      if (bay && tech) slots.push(new Date(cursor));
      cursor = new Date(cursor.getTime() + 30 * 60_000);
    }
    return slots;
  },
};
