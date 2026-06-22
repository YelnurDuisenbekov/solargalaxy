import prisma from './prisma.js';

const userBrief = { id: true, fullName: true, role: true };

export async function notifyDirectors({ type, title, message, projectId, fromUserId, productId }) {
  const directors = await prisma.user.findMany({
    where: { role: { in: ['DIRECTOR', 'ADMIN'] }, isActive: true },
  });
  if (!directors.length) return;

  await prisma.notification.createMany({
    data: directors.map((u) => ({
      userId: u.id,
      fromUserId: fromUserId ?? null,
      type,
      title,
      message,
      projectId: projectId ?? null,
      productId: productId ?? null,
    })),
  });
}

export async function notifyUser({ userId, type, title, message, projectId, fromUserId, productId }) {
  if (!userId) return;
  await prisma.notification.create({
    data: {
      userId,
      fromUserId: fromUserId ?? null,
      type,
      title,
      message,
      projectId: projectId ?? null,
      productId: productId ?? null,
    },
  });
}

export async function notifyAdmins({ type, title, message, projectId, fromUserId, productId }) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  if (!admins.length) return;

  await prisma.notification.createMany({
    data: admins.map((u) => ({
      userId: u.id,
      fromUserId: fromUserId ?? null,
      type,
      title,
      message,
      projectId: projectId ?? null,
      productId: productId ?? null,
    })),
  });
}

export const notificationInclude = {
  user: { select: userBrief },
  fromUser: { select: userBrief },
};
