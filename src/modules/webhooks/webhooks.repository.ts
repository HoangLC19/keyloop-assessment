import prisma from '../../shared/db/client';

export const webhooksRepository = {
  create: (data: { userId: string; url: string; secret: string; events: string[] }) =>
    prisma.webhookSubscription.create({ data }),

  listByUser: (userId: string) =>
    prisma.webhookSubscription.findMany({ where: { userId } }),

  deleteByOwner: async (id: string, userId: string) => {
    const sub = await prisma.webhookSubscription.findFirst({ where: { id, userId } });
    if (!sub) return null;
    return prisma.webhookSubscription.delete({ where: { id } });
  },

  findByEventForUser: (eventType: string, userId: string) =>
    prisma.webhookSubscription.findMany({ where: { events: { has: eventType }, userId } }),
};
