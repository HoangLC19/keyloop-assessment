import { AppointmentsService } from '../../src/modules/appointments/appointments.service';
import { ConflictError, NotFoundError } from '../../src/shared/errors';

const repo = {
  findVehicleByOwner: jest.fn(),
  findServiceType: jest.fn(),
  findAvailableBay: jest.fn(),
  findAvailableTechnician: jest.fn(),
  createAppointmentWithOutbox: jest.fn(),
  findAppointmentByOwner: jest.fn(),
  cancelAppointment: jest.fn(),
  rescheduleAppointment: jest.fn(),
  listAppointmentsByCustomer: jest.fn(),
  getAvailableSlots: jest.fn(),
};

const svc = new AppointmentsService(repo as any);
beforeEach(() => jest.clearAllMocks());

const baseInput = {
  customerId: 'c1', vehicleId: 'v1', dealershipId: 'd1',
  serviceTypeId: 'st1', startTime: new Date('2026-05-01T09:00:00Z'),
};

describe('createAppointment', () => {
  it('throws NotFoundError when vehicle not owned by customer', async () => {
    repo.findVehicleByOwner.mockResolvedValue(null);
    await expect(svc.createAppointment(baseInput)).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when no bay available', async () => {
    repo.findVehicleByOwner.mockResolvedValue({ id: 'v1' });
    repo.findServiceType.mockResolvedValue({ id: 'st1', durationMinutes: 60 });
    repo.findAvailableBay.mockResolvedValue(null);
    await expect(svc.createAppointment(baseInput)).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError when no technician available', async () => {
    repo.findVehicleByOwner.mockResolvedValue({ id: 'v1' });
    repo.findServiceType.mockResolvedValue({ id: 'st1', durationMinutes: 60 });
    repo.findAvailableBay.mockResolvedValue({ id: 'bay1' });
    repo.findAvailableTechnician.mockResolvedValue(null);
    await expect(svc.createAppointment(baseInput)).rejects.toThrow(ConflictError);
  });

  it('creates appointment when resources are free', async () => {
    repo.findVehicleByOwner.mockResolvedValue({ id: 'v1' });
    repo.findServiceType.mockResolvedValue({ id: 'st1', durationMinutes: 60 });
    repo.findAvailableBay.mockResolvedValue({ id: 'bay1' });
    repo.findAvailableTechnician.mockResolvedValue({ id: 'tech1' });
    repo.createAppointmentWithOutbox.mockResolvedValue({ id: 'appt1', status: 'CONFIRMED' });
    const result = await svc.createAppointment(baseInput);
    expect(result).toEqual({ id: 'appt1', status: 'CONFIRMED' });
  });
});

describe('rescheduleAppointment', () => {
  const existingAppt = {
    id: 'appt1', serviceTypeId: 'st1',
    serviceBay: { dealership: { id: 'd1' } },
  };
  const newStart = new Date('2026-05-02T10:00:00Z');

  it('throws NotFoundError when appointment not owned by customer', async () => {
    repo.findAppointmentByOwner.mockResolvedValue(null);
    await expect(svc.rescheduleAppointment('appt1', 'c1', newStart)).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when no bay available at new time', async () => {
    repo.findAppointmentByOwner.mockResolvedValue(existingAppt);
    repo.findServiceType.mockResolvedValue({ id: 'st1', durationMinutes: 60 });
    repo.findAvailableBay.mockResolvedValue(null);
    await expect(svc.rescheduleAppointment('appt1', 'c1', newStart)).rejects.toThrow(ConflictError);
  });

  it('passes selected bay and technician IDs to repo.rescheduleAppointment', async () => {
    repo.findAppointmentByOwner.mockResolvedValue(existingAppt);
    repo.findServiceType.mockResolvedValue({ id: 'st1', durationMinutes: 60 });
    repo.findAvailableBay.mockResolvedValue({ id: 'bay2' });
    repo.findAvailableTechnician.mockResolvedValue({ id: 'tech2' });
    repo.rescheduleAppointment.mockResolvedValue({ id: 'appt1', serviceBayId: 'bay2', technicianId: 'tech2' });
    await svc.rescheduleAppointment('appt1', 'c1', newStart);
    expect(repo.rescheduleAppointment).toHaveBeenCalledWith(
      'appt1', newStart, expect.any(Date), 'bay2', 'tech2'
    );
  });
});

describe('cancelAppointment', () => {
  it('throws NotFoundError when appointment not owned by customer', async () => {
    repo.findAppointmentByOwner.mockResolvedValue(null);
    await expect(svc.cancelAppointment('appt1', 'c1')).rejects.toThrow(NotFoundError);
  });

  it('cancels owned appointment', async () => {
    repo.findAppointmentByOwner.mockResolvedValue({ id: 'appt1', status: 'CONFIRMED' });
    repo.cancelAppointment.mockResolvedValue({ id: 'appt1', status: 'CANCELLED' });
    const result = await svc.cancelAppointment('appt1', 'c1');
    expect(result.status).toBe('CANCELLED');
  });
});
