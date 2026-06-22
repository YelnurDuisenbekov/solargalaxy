import { syncAllProjectReservations, getReservedTotalsByProduct } from '../src/lib/stockReservation.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  console.log('Running syncAllProjectReservations...');
  await syncAllProjectReservations();
  const reservations = await prisma.stockReservation.findMany();
  console.log('After sync, reservations:', reservations.length);
  const totals = await getReservedTotalsByProduct();
  console.log('Reserved by product:', [...totals.entries()]);
} catch (e) {
  console.error('SYNC FAILED:', e);
} finally {
  await prisma.$disconnect();
}
