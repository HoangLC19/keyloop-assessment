import prisma from '../../src/shared/db/client';
import { signToken } from '../../src/modules/auth/auth.service';

export async function clearAll() {
  await prisma.$transaction([
    prisma.outbox.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.technicianCertification.deleteMany(),
    prisma.technician.deleteMany(),
    prisma.serviceBay.deleteMany(),
    prisma.serviceType.deleteMany(),
    prisma.vehicle.deleteMany(),
    prisma.webhookSubscription.deleteMany(),
    prisma.user.deleteMany(),
    prisma.dealership.deleteMany(),
  ]);
}

export function makeToken(id: string, role: 'CUSTOMER' | 'ADMIN') {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
  return signToken({ id, role });
}
