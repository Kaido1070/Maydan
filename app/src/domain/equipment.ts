import { isDateKey } from './dates';
import { newId } from './records';
import type { EquipmentRecord, Photo, Workspace } from './types';

export const equipmentOf = (ws: Workspace): EquipmentRecord[] =>
  [...(ws.equipment ?? [])].sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt));

export type EquipmentInput = { name: string; location: string; notes: string; date: string; before: Photo[]; after: Photo[] };

export function validateEquipment(input: EquipmentInput): string | null {
  if (!input.name.trim()) return 'اكتب اسم المعدة أو رقمها';
  if (!isDateKey(input.date)) return 'التاريخ غير صحيح';
  if (!input.before.length && !input.after.length) return 'أضف صورة واحدة على الأقل (قبل أو بعد)';
  return null;
}

/** يضيف سجلًا جديدًا أو يحدّث سجلًا موجودًا. */
export function saveEquipment(ws: Workspace, input: EquipmentInput, id?: string, stamp = new Date().toISOString()): { ws: Workspace; record: EquipmentRecord } {
  const error = validateEquipment(input);
  if (error) throw new Error(error);
  const list = ws.equipment ?? [];
  const existing = id ? list.find((item) => item.id === id) : undefined;
  const record: EquipmentRecord = {
    id: existing?.id ?? newId('eq'),
    name: input.name.trim(),
    location: input.location.trim(),
    notes: input.notes.trim(),
    date: input.date,
    before: input.before,
    after: input.after,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };
  return {
    ws: { ...ws, equipment: existing ? list.map((item) => (item.id === record.id ? record : item)) : [...list, record] },
    record,
  };
}

export const deleteEquipment = (ws: Workspace, id: string): Workspace => ({ ...ws, equipment: (ws.equipment ?? []).filter((item) => item.id !== id) });

/** الصور اللي ما عاد يشير لها أي سجل (لحذف ملفاتها من الجهاز). */
export function orphanPhotos(before: Workspace, after: Workspace): Photo[] {
  const kept = new Set((after.equipment ?? []).flatMap((item) => [...item.before, ...item.after]).map((photo) => photo.uri));
  return (before.equipment ?? []).flatMap((item) => [...item.before, ...item.after]).filter((photo) => !kept.has(photo.uri));
}
