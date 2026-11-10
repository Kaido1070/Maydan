import { strToU8, zipSync } from 'fflate';
import { applyBackupPhotoPaths, packBackup, unpackBackup } from '../backup';
import { emptyWorkspace } from '../seed';
import type { Photo, Workspace } from '../types';

const today = '2026-11-10';
const bytes = new Uint8Array([255, 216, 255, 0, 255, 217]);
const photo: Photo = { id: 'photo-1', uri: 'maydan-photos/one.jpg', takenAt: `${today}T08:00:00Z` };

function sample(): Workspace {
  return {
    ...emptyWorkspace(today),
    equipment: [{ id: 'eq', name: 'محطة التوزيع', location: 'الدرب', notes: 'ملاحظة', date: today, before: [photo], after: [photo], createdAt: today, updatedAt: today }],
    findings: [{ id: 'finding', kind: 'observation', title: 'معاينة', description: 'تفاصيل', location: 'الشقيق', responsible: 'الفريق', date: today, status: 'open', photos: [photo], updates: [], createdAt: today, updatedAt: today }],
  };
}

test('النسخة تحفظ النص العربي والصور وتربط مساراتها بالجهاز الجديد', async () => {
  const read = jest.fn(async () => bytes);
  const unpacked = unpackBackup(await packBackup(sample(), read));
  expect(read).toHaveBeenCalledTimes(1);
  expect(unpacked.photos.get('photos/1.jpg')).toEqual(bytes);
  const restored = applyBackupPhotoPaths(unpacked.workspace, new Map([['photos/1.jpg', 'maydan-photos/restored/1.jpg']]));
  expect(restored.equipment?.[0].name).toBe('محطة التوزيع');
  expect(restored.equipment?.[0].after[0]).toEqual({ ...photo, uri: 'maydan-photos/restored/1.jpg' });
  expect(restored.findings?.[0].photos[0].uri).toBe('maydan-photos/restored/1.jpg');
});

test('الاستعادة ترفض الأرشيف المجهول ومسارات الصور الخارجية والمرفقات الناقصة', () => {
  expect(() => unpackBackup(zipSync({ '../x': bytes }))).toThrow();
  const workspace = sample();
  const manifest = () => strToU8(JSON.stringify({ format: 'maydan-backup', version: 1, workspace }));
  expect(() => unpackBackup(zipSync({ 'maydan.json': manifest() }))).toThrow();
  workspace.equipment![0].before = [{ ...photo, uri: 'photos/1.jpg' }];
  workspace.equipment![0].after = [];
  workspace.findings = [];
  expect(() => unpackBackup(zipSync({ 'maydan.json': manifest() }))).toThrow();
});
