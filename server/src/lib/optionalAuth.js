import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret');
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

/** Устанавливает req.user, если передан Bearer-токен; иначе продолжает без авторизации. */
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    /* невалидный токен — публичная заявка без привязки к аккаунту */
  }
  next();
}
