import { fetch } from 'expo/fetch';
import { BACKUP_LIMIT } from '../domain/backup';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FORMAT = "appProperties has { key='maydanFormat' and value='backup-v1' }";
const ZIP = 'application/zip';
const FIELDS = 'id,name,size,modifiedTime,parents,appProperties';
const FOLDER = 'application/vnd.google-apps.folder';
const ARCHIVE = "appProperties has { key='maydanFormat' and value='archive-v1' }";

export type DriveFile = { id: string; name: string; size: string; modifiedTime: string; parents?: string[]; appProperties?: Record<string, string> };
type Metadata = { name: string; mimeType: string; appProperties: Record<string, string>; parents?: string[] };

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
export async function uploadDriveBackup(token: string, device: string, archive: Uint8Array, folder?: string): Promise<DriveFile> {
  if (!archive.length || archive.length > BACKUP_LIMIT) throw new Error('حجم النسخة غير مدعوم.');
  const [current] = await list(token, device);
  return upload(token, { name: `Maydan-Backup-${device.slice(0, 8)}.zip`, mimeType: ZIP, appProperties: { maydanFormat: 'backup-v1', maydanDevice: device } }, archive, current, folder);
}

function destination(params: URLSearchParams, current?: DriveFile, folder?: string) {
  if (!current || !folder || current.parents?.includes(folder)) return;
  params.set('addParents', folder);
  if (current.parents?.length) params.set('removeParents', current.parents.join(','));
}

async function upload(token: string, metadata: Metadata, archive: Uint8Array, current?: DriveFile, folder?: string): Promise<DriveFile> {
  const path = current ? '/' + encodeURIComponent(current.id) : '';
  const params = new URLSearchParams({ uploadType: 'resumable', fields: FIELDS });
  destination(params, current, folder);
  const target = await request(`${UPLOAD}${path}?${params}`, {
    method: current ? 'PATCH' : 'POST',
    headers: { ...headers(token), 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': metadata.mimeType, 'X-Upload-Content-Length': String(archive.length) },
    body: JSON.stringify({ ...metadata, parents: !current && folder ? [folder] : undefined }),
  }, 30_000, async (response) => response.headers.get('Location'));
  if (!target || !/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files(?:\/[^/?]+)?\?/.test(target)) throw new Error('رابط رفع النسخة من Google Drive غير صالح.');
  const buffer = archive.buffer;
  const body = buffer instanceof ArrayBuffer && archive.byteOffset === 0 && archive.byteLength === buffer.byteLength ? buffer : Uint8Array.from(archive).buffer;
  return request(target, { method: 'PUT', headers: { ...headers(token), 'Content-Type': metadata.mimeType }, body }, 120_000, async (response) => await response.json() as DriveFile);
}

export async function listDriveArchive(token: string, rootOnly = false) {
  const catalog = new Map<string, DriveFile>();
  let pageToken: string | undefined;
  do {
    const q = `trashed = false and ${ARCHIVE}${rootOnly ? " and appProperties has { key='maydanKey' and value='root' }" : ''}`;
    const params = new URLSearchParams({ q, fields: `nextPageToken,files(${FIELDS})`, orderBy: 'createdTime', pageSize: rootOnly ? '1' : '100' });
    if (pageToken) params.set('pageToken', pageToken);
    const page = await request(`${FILES}?${params}`, { headers: headers(token) }, 30_000, async (response) => await response.json() as { nextPageToken?: string; files?: DriveFile[] });
    for (const file of page.files ?? []) {
      const key = file.appProperties?.maydanKey;
      if (key && !catalog.has(key)) catalog.set(key, file);
    }
    pageToken = rootOnly && catalog.size ? undefined : page.nextPageToken;
  } while (pageToken);
  return catalog;
}

export async function saveDriveArchiveItem(token: string, item: { key: string; name: string; folder?: string; content?: { mimeType: string; digest: string; read: () => Promise<Uint8Array> } }, current?: DriveFile): Promise<DriveFile> {
  const { key, name, folder, content } = item;
  const sameLocation = current?.name === name && (!folder || current.parents?.includes(folder));
  const sameContent = !content || current?.appProperties?.maydanDigest === content.digest;
  if (current && sameLocation && sameContent) return current;
  const metadata = { name, mimeType: content?.mimeType ?? FOLDER, appProperties: { maydanFormat: 'archive-v1', maydanKey: key, ...(content ? { maydanDigest: content.digest } : {}) } };
  if (content && !sameContent) return upload(token, metadata, await content.read(), current, folder);

  const params = new URLSearchParams({ fields: FIELDS });
  destination(params, current, folder);
  return request(`${FILES}${current ? '/' + encodeURIComponent(current.id) : ''}?${params}`, {
    method: current ? 'PATCH' : 'POST',
    headers: { ...headers(token), 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ ...metadata, parents: !current && folder ? [folder] : undefined }),
  }, 30_000, async (response) => await response.json() as DriveFile);
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
