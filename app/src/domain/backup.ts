import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { Photo, Workspace } from './types';

export const BACKUP_LIMIT = 96 * 1024 * 1024;
const MANIFEST_LIMIT = 12 * 1024 * 1024;
const PHOTO_LIMIT = 12 * 1024 * 1024;
const PHOTO_COUNT_LIMIT = 5000;
const MANIFEST = 'maydan.json';
const PHOTO_PATH = /^photos\/[1-9]\d{0,3}\.(jpg|png)$/;
const INVALID = 'الملف ليس نسخة احتياطية صالحة من ميدان.';
const TOO_LARGE = 'حجم النسخة يتجاوز 96 ميغابايت.';

function mapPhotos(ws: Workspace, map: (photo: Photo) => Photo): Workspace {
  return {
    ...ws,
    visits: ws.visits.map((v) => ({ ...v, before: v.before?.map(map), after: v.after?.map(map) })),
    equipment: ws.equipment?.map((e) => ({ ...e, before: e.before.map(map), after: e.after.map(map) })),
    findings: ws.findings?.map((f) => ({ ...f, photos: f.photos.map(map) })),
  };
}

function extension(bytes: Uint8Array): 'jpg' | 'png' {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return 'png';
  throw new Error('إحدى الصور غير قابلة للقراءة.');
}

export async function packBackup(ws: Workspace, readPhoto: (photo: Photo) => Promise<Uint8Array>): Promise<Uint8Array> {
  const photos = new Map<string, Photo>();
  mapPhotos(ws, (photo) => { photos.set(photo.uri, photo); return photo; });
  if (photos.size > PHOTO_COUNT_LIMIT) throw new Error('عدد الصور في النسخة يتجاوز الحد المسموح.');
  const paths = new Map<string, string>();
  const files: Zippable = {};
  let total = 0;
  for (const [uri, photo] of photos) {
    const bytes = await readPhoto(photo);
    const path = `photos/${paths.size + 1}.${extension(bytes)}`;
    total += bytes.length;
    if (bytes.length > PHOTO_LIMIT || total > BACKUP_LIMIT) throw new Error(TOO_LARGE);
    paths.set(uri, path);
    // JPEG and PNG already compress their pixels. Store their bytes unchanged.
    files[path] = [bytes, { level: 0 }];
  }
  const workspace = mapPhotos(ws, (photo) => ({ ...photo, uri: paths.get(photo.uri)! }));
  const manifest = strToU8(JSON.stringify({ format: 'maydan-backup', version: 1, workspace }));
  if (manifest.length > MANIFEST_LIMIT || total + manifest.length > BACKUP_LIMIT) throw new Error(TOO_LARGE);
  const archive = zipSync({ [MANIFEST]: [manifest, { level: 6 }], ...files });
  if (archive.length > BACKUP_LIMIT) throw new Error(TOO_LARGE);
  return archive;
}

export function unpackBackup(archive: Uint8Array): { workspace: Workspace; photos: Map<string, Uint8Array> } {
  if (archive.length > BACKUP_LIMIT) throw new Error(TOO_LARGE);
  let total = 0;
  const names = new Set<string>();
  const files = unzipSync(archive, {
    filter: ({ name, originalSize }) => {
      if ((name !== MANIFEST && !PHOTO_PATH.test(name)) || names.has(name) || names.size > PHOTO_COUNT_LIMIT) throw new Error(INVALID);
      total += originalSize;
      if (originalSize > (name === MANIFEST ? MANIFEST_LIMIT : PHOTO_LIMIT) || total > BACKUP_LIMIT) throw new Error(TOO_LARGE);
      names.add(name);
      return true;
    },
  });
  if (!files[MANIFEST]) throw new Error(INVALID);
  const manifest = JSON.parse(strFromU8(files[MANIFEST]));
  const ws = manifest?.workspace as Workspace | undefined;
  if (manifest?.format !== 'maydan-backup' || manifest.version !== 1 || !ws || !ws.settings || typeof ws.settings !== 'object' ||
      !ws.overrides || typeof ws.overrides !== 'object' || ![ws.departments, ws.technicians, ws.meetings, ws.plan, ws.visits, ws.attendance].every(Array.isArray) ||
      [ws.equipment, ws.findings, ws.places, ws.overtime].some((value) => value !== undefined && !Array.isArray(value))) throw new Error(INVALID);
  const photos = new Map<string, Uint8Array>();
  mapPhotos(ws, (photo) => {
    if (!photo || typeof photo.id !== 'string' || typeof photo.takenAt !== 'string' || typeof photo.uri !== 'string' || !PHOTO_PATH.test(photo.uri)) throw new Error(INVALID);
    const bytes = files[photo.uri];
    if (!bytes || !photo.uri.endsWith('.' + extension(bytes))) throw new Error(INVALID);
    photos.set(photo.uri, bytes);
    return photo;
  });
  if (names.size !== photos.size + 1) throw new Error(INVALID);
  return { workspace: ws, photos };
}

export function applyBackupPhotoPaths(ws: Workspace, paths: Map<string, string>): Workspace {
  return mapPhotos(ws, (photo) => ({ ...photo, uri: paths.get(photo.uri)! }));
}
