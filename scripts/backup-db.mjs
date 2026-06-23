#!/usr/bin/env node
/**
 * Бэкап PostgreSQL в формате custom (.dump) — пригоден для pg_restore
 * и для переезда на другой хостинг (например, ps.kz).
 *
 * Использование:
 *   DATABASE_URL=postgres://... node scripts/backup-db.mjs
 *   npm run db:backup
 *
 * Восстановление:
 *   pg_restore --no-owner --no-acl -d "<целевой DATABASE_URL>" backups/<файл>.dump
 *
 * Требуется установленный pg_dump (PostgreSQL client tools).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const url = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('✗ Не задан DATABASE_URL (или BACKUP_DATABASE_URL).');
  console.error('  Пример: DATABASE_URL="postgres://..." npm run db:backup');
  process.exit(1);
}

const dir = process.env.BACKUP_DIR || 'backups';
mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = path.join(dir, `solargalaxy-${stamp}.dump`);

try {
  execFileSync('pg_dump', ['--no-owner', '--no-acl', '-Fc', '-d', url, '-f', file], {
    stdio: 'inherit',
  });
  console.log(`✓ Бэкап сохранён: ${file}`);
} catch {
  console.error('✗ Не удалось сделать бэкап.');
  console.error('  Проверьте, что установлен pg_dump (PostgreSQL client) и доступна база.');
  process.exit(1);
}
