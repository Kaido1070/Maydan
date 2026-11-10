import { fromByteArray, toByteArray } from 'base64-js';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { applyBackupPhotoPaths, BACKUP_LIMIT, packBackup, unpackBackup } from './domain/backup';
import { newId } from './domain/records';
import type { Photo, Workspace } from './domain/types';
import { shareBytes } from './exporting';
import { photoSrc } from './photos';

const MIME = 'application/zip';
const DEVICE_PHOTOS = /^maydan-photos\/(?:[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_-]+\.(jpg|jpeg|png)$/i;

async function readPhoto(photo: Photo): Promise<Uint8Array> {
  if (/^data:image\/(jpeg|png);base64,/.test(photo.uri)) {
    const encoded = photo.uri.slice(photo.uri.indexOf(',') + 1);
    if (encoded.length > 16 * 1024 * 1024) throw new Error('إحدى الصور كبيرة جدًا لإضافتها للنسخة.');
    return toByteArray(encoded);
  }
  if (Platform.OS !== 'web') {
    const root = new Directory(Paths.document).uri.replace(/\/$/, '') + '/';
    const relative = photo.uri.startsWith(root) ? photo.uri.slice(root.length) : photo.uri;
    if (DEVICE_PHOTOS.test(relative)) {
      const file = new File(photoSrc({ ...photo, uri: relative }));
      if (file.exists) return file.bytes();
    }
  }
  throw new Error('فيه صورة مفقودة من سجلات العمل. تعذّر إنشاء نسخة مكتملة.');
}

export async function exportBackupZip(workspace: Workspace, date: string) {
  const bytes = await packBackup(workspace, readPhoto);
  await shareBytes(`Maydan-Backup-${date}.zip`, bytes, MIME, 'public.zip-archive');
}

export async function pickBackupZip(): Promise<ReturnType<typeof unpackBackup> | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: [MIME, 'application/x-zip-compressed', 'application/octet-stream'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const nativeFile = Platform.OS === 'web' ? undefined : new File(asset.uri);
  try {
    if ((asset.size ?? nativeFile?.size ?? 0) > BACKUP_LIMIT) throw new Error('حجم النسخة يتجاوز 96 ميغابايت.');
    if (nativeFile) return unpackBackup(await nativeFile.bytes());
    const source = asset.file ?? await (await fetch(asset.uri)).blob();
    if (source.size > BACKUP_LIMIT) throw new Error('حجم النسخة يتجاوز 96 ميغابايت.');
    return unpackBackup(new Uint8Array(await source.arrayBuffer()));
  } finally {
    const cache = nativeFile ? new Directory(Paths.cache).uri.replace(/\/$/, '') + '/' : '';
    if (nativeFile?.uri.startsWith(cache) && nativeFile.exists) nativeFile.delete();
  }
}

export async function restoreBackupPhotos({ workspace, photos }: ReturnType<typeof unpackBackup>, canCommit: () => boolean): Promise<Workspace> {
  const commit = (result: Workspace) => {
    if (!canCommit()) throw new Error('تغيّرت بيانات العمل أثناء الاستيراد. اختر النسخة مرة ثانية.');
    return result;
  };
  if (!photos.size) return commit(workspace);
  const paths = new Map<string, string>();
  if (Platform.OS === 'web') {
    // Browser storage uses inline images. Keep binary writes on native platforms.
    for (const [path, bytes] of photos) {
      paths.set(path, `data:image/${path.endsWith('.png') ? 'png' : 'jpeg'};base64,${fromByteArray(bytes)}`);
    }
    return commit(applyBackupPhotoPaths(workspace, paths));
  }
  const relative = `maydan-photos/${newId('restore')}`;
  const dir = new Directory(Paths.document, relative);
  dir.create({ intermediates: true });
  try {
    for (const [path, bytes] of photos) {
      const name = path.slice('photos/'.length);
      const file = new File(dir, name);
      file.create();
      await file.write(bytes);
      paths.set(path, `${relative}/${name}`);
    }
    return commit(applyBackupPhotoPaths(workspace, paths));
  } catch (error) {
    if (dir.exists) dir.delete();
    throw error;
  }
}
