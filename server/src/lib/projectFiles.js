import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const UPLOAD_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads/projects');
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
]);

const ALLOWED_EXT = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.txt',
  '.doc', '.docx', '.xls', '.xlsx', '.zip',
]);

export async function saveProjectAttachment(projectId, file, uploadedById) {
  if (!file?.data || !file?.originalName) {
    throw new Error('Некорректный файл');
  }

  const originalName = String(file.originalName).slice(0, 200);
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`Тип файла «${ext || 'без расширения'}» не разрешён`);
  }

  const mimeType = (file.mimeType || 'application/octet-stream').toLowerCase();
  if (mimeType !== 'application/octet-stream' && !ALLOWED_MIME.has(mimeType)) {
    throw new Error(`MIME-тип «${mimeType}» не разрешён`);
  }

  const buffer = Buffer.from(file.data, 'base64');
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(`Файл «${originalName}» слишком большой (макс. 15 МБ)`);
  }
  if (buffer.length === 0) {
    throw new Error('Пустой файл');
  }

  const safeProjectId = String(projectId).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeProjectId) throw new Error('Некорректный проект');

  const dir = path.join(UPLOAD_ROOT, safeProjectId);
  await fs.mkdir(dir, { recursive: true });

  const safeName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storagePath = path.posix.join(safeProjectId, safeName);
  await fs.writeFile(path.join(dir, safeName), buffer);

  return {
    fileName: safeName,
    originalName,
    mimeType: ALLOWED_MIME.has(mimeType) ? mimeType : 'application/octet-stream',
    size: buffer.length,
    storagePath,
    uploadedById: uploadedById || null,
  };
}

export function attachmentFullPath(storagePath) {
  const normalized = path.normalize(storagePath.replace(/\\/g, '/'));
  if (normalized.includes('..') || path.isAbsolute(normalized)) {
    throw new Error('Некорректный путь файла');
  }
  const full = path.join(UPLOAD_ROOT, normalized.replace(/\//g, path.sep));
  if (!full.startsWith(UPLOAD_ROOT)) {
    throw new Error('Некорректный путь файла');
  }
  return full;
}

export async function readProjectAttachment(storagePath) {
  return fs.readFile(attachmentFullPath(storagePath));
}
