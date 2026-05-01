import prisma from '../../shared/db/client';

export const resourcesRepository = {
  createDealership: (data: { name: string; address: string }) =>
    prisma.dealership.create({ data }),

  listDealerships: () =>
    prisma.dealership.findMany({ orderBy: { createdAt: 'asc' } }),

  getDealership: (id: string) =>
    prisma.dealership.findUnique({ where: { id } }),

  createServiceType: (data: { name: string; durationMinutes: number }) =>
    prisma.serviceType.create({ data }),

  listServiceTypes: () =>
    prisma.serviceType.findMany({ orderBy: { name: 'asc' } }),

  getServiceType: (id: string) =>
    prisma.serviceType.findUnique({ where: { id } }),

  createServiceBay: (data: { dealershipId: string; name: string }) =>
    prisma.serviceBay.create({ data }),

  createTechnician: (data: { dealershipId: string; name: string; email: string }) =>
    prisma.technician.create({ data }),

  getTechnician: (id: string) =>
    prisma.technician.findUnique({ where: { id } }),

  addCertification: (technicianId: string, serviceTypeId: string) =>
    prisma.technicianCertification.create({ data: { technicianId, serviceTypeId } }),

  removeCertification: (technicianId: string, serviceTypeId: string) =>
    prisma.technicianCertification.delete({
      where: { technicianId_serviceTypeId: { technicianId, serviceTypeId } },
    }),
};
