import { fetch } from 'expo/fetch';
import { BACKUP_LIMIT } from '../domain/backup';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FORMAT = "appProperties has { key='maydanFormat' and value='backup-v1' }";
const ZIP = 'application/zip';
const FIELDS = 'id,name,size,modifiedTime';

export type DriveFile = { id: string; name: string; size: string; modifiedTime: string };

function headers(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(url: string, options: Parameters<typeof fetch>[1], timeout: number, read: (response: Awaited<ReturnType<typeof fetch>>) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await read(check(await fetch(url, { ...options, redirect: 'error', signal: controller.signal })));
  } finally {
    clearTimeout(timer);
  }
}

function check(response: Awaited<ReturnType<typeof fetch>>) {
  if (response.ok) return response;
  if (response.status === 401) throw new Error('انتهى إذن Google Drive. اربط حسابك من جديد.');
  if (response.status === 403) throw new Error('Google Drive رفض العملية. تأكد من الصلاحية ومساحة التخزين.');
  if (response.status === 429 || response.status >= 500) throw new Error('Google Drive غير متاح مؤقتًا. جرّب مرة ثانية.');
  throw new Error('تعذرت العملية في Google Drive.');
}

async function list(token: string, device?: string): Promise<DriveFile[]> {
  if (device && !/^[a-f0-9-]+$/i.test(device)) throw new Error('معرّف النسخة غير صالح.');
  const query = ['trashed = false', FORMAT];
  if (device) query.push(`appProperties has { key='maydanDevice' and value='${device}' }`);
  const url = `${FILES}?q=${encodeURIComponent(query.join(' and '))}&fields=${encodeURIComponent(`files(${FIELDS})`)}&orderBy=modifiedTime%20desc&pageSize=${device ? 1 : 20}`;
  return request(url, { headers: headers(token) }, 30_000, async (response) => (await response.json() as { files?: DriveFile[] }).files ?? []);
}

export function listDriveBackups(token: string) {
  return list(token);
}

/** One rolling file per installation. A new device never replaces the old device's file. */
export async function uploadDriveBackup(token: string, device: string, archive: Uint8Array): Promise<DriveFile> {
  if (!archive.length || archive.length > BACKUP_LIMIT) throw new Error('حجم النسخة غير مدعوم.');
  const [current] = await list(token, device);
  const path = current ? '/' + encodeURIComponent(current.id) : '';
  const target = await request(`${UPLOAD}${path}?uploadType=resumable&fields=${encodeURIComponent(FIELDS)}`, {
    method: current ? 'PATCH' : 'POST',
    headers: { ...headers(token), 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': ZIP, 'X-Upload-Content-Length': String(archive.length) },
    body: JSON.stringify({ name: `Maydan-Backup-${device.slice(0, 8)}.zip`, mimeType: ZIP, appProperties: { maydanFormat: 'backup-v1', maydanDevice: device } }),
  }, 30_000, async (response) => response.headers.get('Location'));
  if (!target || !/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files(?:\/[^/?]+)?\?/.test(target)) throw new Error('رابط رفع النسخة من Google Drive غير صالح.');
  const buffer = archive.buffer;
  const body = buffer instanceof ArrayBuffer && archive.byteOffset === 0 && archive.byteLength === buffer.byteLength ? buffer : Uint8Array.from(archive).buffer;
  return request(target, { method: 'PUT', headers: { ...headers(token), 'Content-Type': ZIP }, body }, 120_000, async (response) => await response.json() as DriveFile);
}

export async function downloadDriveBackup(token: string, file: DriveFile): Promise<Uint8Array> {
  const size = Number(file.size);
  if (!Number.isSafeInteger(size) || size <= 0 || size > BACKUP_LIMIT) throw new Error('حجم النسخة يتجاوز الحد المسموح.');
  return request(`${FILES}/${encodeURIComponent(file.id)}?alt=media`, { headers: headers(token) }, 120_000, async (response) => {
    if (Number(response.headers.get('content-length')) > BACKUP_LIMIT) throw new Error('حجم النسخة يتجاوز الحد المسموح.');
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.length > BACKUP_LIMIT) throw new Error('حجم النسخة يتجاوز الحد المسموح.');
    return data;
  });
}
