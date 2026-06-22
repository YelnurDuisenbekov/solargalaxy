import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createUser({ login, password, fullName, role, phone, extraPerms = [] }) {
  return prisma.user.create({
    data: {
      login,
      email: `${login}@solargalaxy.kz`,
      passwordHash: await bcrypt.hash(password, 10),
      fullName,
      phone,
      role,
      permissions: extraPerms.length
        ? { create: extraPerms.map((key) => ({ key })) }
        : undefined,
    },
  });
}

async function main() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log('seed-prod: пользователи уже есть, пропуск');
    return;
  }

  await createUser({
    login: 'admin',
    password: 'admin123',
    fullName: 'Администратор системы',
    role: 'ADMIN',
    phone: '+7 700 000 0001',
    extraPerms: ['users.delete', 'users.permissions'],
  });

  await createUser({
    login: 'director',
    password: 'director123',
    fullName: 'Директор',
    role: 'DIRECTOR',
    phone: '+7 700 000 0002',
  });

  await createUser({
    login: 'menedzher1',
    password: 'menedzher123',
    fullName: 'Айгуль Сатпаева',
    role: 'MANAGER',
    phone: '+7 700 000 0010',
  });

  console.log('seed-prod OK: admin, director, menedzher1');
  console.log('Смените пароли после первого входа.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
