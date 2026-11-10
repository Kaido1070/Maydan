import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import { readBackupPhoto } from '../backupFiles';
import { riyadhNow } from '../domain/dates';
import { buildReport, reportHtml } from '../domain/reports';
import type { Workspace } from '../domain/types';
import { listDriveArchive, saveDriveArchiveItem } from './api';
import { monthPath, recordHtml, recordName, WORK_FOLDERS, workRecords } from './archive';

const sha = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
const pdfBytes = async (html: string) => {
  const { uri } = await Print.printToFileAsync({ html });
  const file = new File(uri);
  try { return await file.bytes(); }
  finally { if (file.exists) file.delete(); }
};

export async function driveArchive(token: string) {
  const catalog = await listDriveArchive(token);
  const put = async (key: string, name: string, folder?: string, content?: { mimeType: string; digest: string; read: () => Promise<Uint8Array> }) => {
    const saved = await saveDriveArchiveItem(token, { key, name, folder, content }, catalog.get(key));
    catalog.set(key, saved);
    return saved.id;
  };
  const root = await put('root', 'ميدان - أعمالي');
  const backupFolder = await put('backups', 'نسخ الاستعادة', root);

  const sync = async (workspace: Workspace) => {
    const kinds = new Map<string, string>();
    for (const [kind, label] of Object.entries(WORK_FOLDERS)) kinds.set(kind, await put('kind:' + kind, label, root));
    const monthFolder = async (kind: keyof typeof WORK_FOLDERS, month: NonNullable<ReturnType<typeof monthPath>>) => {
      const yearKey = [kind, month.year].join(':');
      const year = await put(yearKey, month.year, kinds.get(kind));
      return put(yearKey + ':' + month.month, month.label, year);
    };
    const savePdf = async (key: string, name: string, folder: string, html: string) =>
      put(key, name + '.pdf', folder, { mimeType: 'application/pdf', digest: await sha(html), read: () => pdfBytes(html) });

    const months = new Set<string>();
    for (const record of workRecords(workspace)) {
      const month = monthPath(record.date);
      if (!month) continue;
      months.add(month.year + '-' + month.month);
      const key = 'record:' + await sha(record.kind + ':' + record.key);
      const folder = await put(key, recordName(record), await monthFolder(record.kind, month));
      await savePdf(key + ':pdf', recordName(record), folder, recordHtml(record));
      for (const { photo, group } of record.attachments) {
        const photoKey = 'photo:' + await sha(JSON.stringify([key, group, photo.id]));
        const previous = catalog.get(photoKey);
        const digest = await sha(JSON.stringify([photo.id, photo.takenAt, photo.uri]));
        const previousExtension = previous?.name.endsWith('.png') ? 'png' : 'jpg';
        const bytes = previous?.appProperties?.maydanDigest === digest ? undefined : await readBackupPhoto(photo);
        const ext = bytes ? (bytes[0] === 137 ? 'png' : 'jpg') : previousExtension;
        const stamp = Number.isFinite(Date.parse(photo.takenAt)) ? riyadhNow(new Date(photo.takenAt)) : null;
        const name = [stamp && stamp.date + '_' + stamp.time.replace(':', '-'), group, photoKey.slice(6, 14)].filter(Boolean).join(' - ');
        await put(photoKey, name + '.' + ext, folder, { mimeType: ext === 'png' ? 'image/png' : 'image/jpeg', digest, read: async () => bytes ?? readBackupPhoto(photo) });
      }
    }

    const today = riyadhNow().date;
    for (const date of months) {
      const month = monthPath(date)!;
      const index = Number(month.month) - 1;
      const report = buildReport(workspace, { mode: 'month', year: Number(month.year), month: index, quarter: Math.floor(index / 3), departmentId: 'all' }, today);
      const folder = await monthFolder('reports', month);
      await savePdf('report:' + date, date + ' - تقرير شهري - كل الأقسام', folder, reportHtml(report, workspace.settings.engineerName));
    }
  };

  return { backupFolder, sync };
}
