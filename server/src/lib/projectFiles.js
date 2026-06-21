import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const UPLOAD_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads/projects');
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function saveProjectAttachment(projectId, file, uploadedById) {
  if (!file?.data || !file?.originalName) {
    throw new Error('Некорректный файл');
  }
  const buffer = Buffer.from(file.data, 'base64');
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(`Файл «${file.originalName}» слишком большой (макс. 15 МБ)`);
  }

  const dir = path.join(UPLOAD_ROOT, projectId);
  await fs.mkdir(dir, { recursive: true });

  const safeName = `${Date.now()}-${file.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storagePath = path.posix.join(projectId, safeName);
  await fs.writeFile(path.join(UPLOAD_ROOT, projectId, safeName), buffer);

  return {
    fileName: safeName,
    originalName: file.originalName,
    mimeType: file.mimeType || 'application/octet-stream',
    size: buffer.length,
    storagePath,
    uploadedById: uploadedById || null,
  };
}

export function attachmentFullPath(storagePath) {
  return path.join(UPLOAD_ROOT, storagePath.replace(/\//g, path.sep));
}

export async function readProjectAttachment(storagePath) {
  return fs.readFile(attachmentFullPath(storagePath));
}
