import { resourcesRepository } from './resources.repository';
import { NotFoundError } from '../../shared/errors';

export const resourcesService = {
  createDealership: (data: { name: string; address: string }) =>
    resourcesRepository.createDealership(data),

  listDealerships: () => resourcesRepository.listDealerships(),

  createServiceType: (data: { name: string; durationMinutes: number }) =>
    resourcesRepository.createServiceType(data),

  listServiceTypes: () => resourcesRepository.listServiceTypes(),

  async createServiceBay(dealershipId: string, data: { name: string }) {
    if (!(await resourcesRepository.getDealership(dealershipId))) throw new NotFoundError('Dealership not found');
    return resourcesRepository.createServiceBay({ dealershipId, ...data });
  },

  async createTechnician(dealershipId: string, data: { name: string; email: string }) {
    if (!(await resourcesRepository.getDealership(dealershipId))) throw new NotFoundError('Dealership not found');
    return resourcesRepository.createTechnician({ dealershipId, ...data });
  },

  async addCertification(technicianId: string, serviceTypeId: string) {
    if (!(await resourcesRepository.getTechnician(technicianId))) throw new NotFoundError('Technician not found');
    if (!(await resourcesRepository.getServiceType(serviceTypeId))) throw new NotFoundError('Service type not found');
    return resourcesRepository.addCertification(technicianId, serviceTypeId);
  },

  removeCertification: (technicianId: string, serviceTypeId: string) =>
    resourcesRepository.removeCertification(technicianId, serviceTypeId),
};
