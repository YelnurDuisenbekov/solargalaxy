import jwt from 'jsonwebtoken';
import prisma from './prisma.js';
import { resolvePermissions, hasAnyPermission } from './permissions.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, login: user.login, email: user.email, role: user.role, fullName: user.fullName },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

export async function attachUser(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { permissions: true },
    });
    if (!user?.isActive) return res.status(401).json({ error: 'Аккаунт отключён' });
    req.dbUser = user;
    req.permissions = resolvePermissions(user);
    next();
  } catch {
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

export function requirePermission(...keys) {
  return (req, res, next) => {
    if (!hasAnyPermission(req.permissions, ...keys)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

export function sanitizeUser(user) {
  const { passwordHash, permissions: _perms, ...rest } = user;
  return {
    ...rest,
    permissions: [...resolvePermissions(user)],
  };
}
