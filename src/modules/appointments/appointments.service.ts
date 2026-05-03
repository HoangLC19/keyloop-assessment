import { IAppointmentsRepository, appointmentsRepository } from './appointments.repository';
import { NotFoundError, ConflictError } from '../../shared/errors';

export class AppointmentsService {
  constructor(private repo: IAppointmentsRepository) {}

  async createAppointment(data: {
    customerId: string; vehicleId: string; dealershipId: string;
    serviceTypeId: string; startTime: Date;
  }) {
    const vehicle = await this.repo.findVehicleByOwner(data.vehicleId, data.customerId);
    if (!vehicle) throw new NotFoundError('Vehicle not found');

    const serviceType = await this.repo.findServiceType(data.serviceTypeId);
    if (!serviceType) throw new NotFoundError('Service type not found');

    const endTime = new Date(data.startTime.getTime() + serviceType.durationMinutes * 60_000);

    const bay = await this.repo.findAvailableBay(data.dealershipId, data.startTime, endTime);
    if (!bay) throw new ConflictError('No service bay available for this time slot');

    const technician = await this.repo.findAvailableTechnician(data.dealershipId, data.serviceTypeId, data.startTime, endTime);
    if (!technician) throw new ConflictError('No qualified technician available for this time slot');

    return this.repo.createAppointmentWithOutbox({
      customerId: data.customerId, vehicleId: data.vehicleId,
      technicianId: technician.id, serviceBayId: bay.id,
      serviceTypeId: data.serviceTypeId, startTime: data.startTime, endTime,
    });
  }

  async cancelAppointment(appointmentId: string, customerId: string) {
    const appt = await this.repo.findAppointmentByOwner(appointmentId, customerId);
    if (!appt) throw new NotFoundError('Appointment not found');
    return this.repo.cancelAppointment(appointmentId);
  }

  async rescheduleAppointment(appointmentId: string, customerId: string, newStart: Date) {
    const appt = await this.repo.findAppointmentByOwner(appointmentId, customerId);
    if (!appt) throw new NotFoundError('Appointment not found');

    const serviceType = await this.repo.findServiceType(appt.serviceTypeId);
    const endTime = new Date(newStart.getTime() + serviceType!.durationMinutes * 60_000);
    const dealershipId = appt.serviceBay.dealership.id;

    const bay = await this.repo.findAvailableBay(dealershipId, newStart, endTime, appointmentId);
    if (!bay) throw new ConflictError('No service bay available for this time slot');

    const technician = await this.repo.findAvailableTechnician(dealershipId, appt.serviceTypeId, newStart, endTime, appointmentId);
    if (!technician) throw new ConflictError('No qualified technician available for this time slot');

    return this.repo.rescheduleAppointment(appointmentId, newStart, endTime, bay.id, technician.id);
  }

  async getAppointment(appointmentId: string, customerId: string) {
    const appt = await this.repo.findAppointmentByOwner(appointmentId, customerId);
    if (!appt) throw new NotFoundError('Appointment not found');
    return appt;
  }

  listAppointments(customerId: string) {
    return this.repo.listAppointmentsByCustomer(customerId);
  }

  async getAvailableSlots(params: { dealershipId: string; serviceTypeId: string; date: Date }) {
    const serviceType = await this.repo.findServiceType(params.serviceTypeId);
    if (!serviceType) throw new NotFoundError('Service type not found');
    return this.repo.getAvailableSlots(params.dealershipId, params.serviceTypeId, params.date, serviceType.durationMinutes);
  }
}

export const appointmentsService = new AppointmentsService(appointmentsRepository);
