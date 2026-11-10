import { isTime, MONTHS_AR, riyadhNow } from '../domain/dates';
import { FINDING_NOUN, STATUS_LABEL } from '../domain/findings';
import type { Photo, Workspace } from '../domain/types';

export const WORK_FOLDERS = { visits: 'الزيارات', meetings: 'الاجتماعات', findings: 'المتابعات', equipment: 'المعدات', overtime: 'العمل خارج الدوام', reports: 'التقارير' };
type RecordKind = Exclude<keyof typeof WORK_FOLDERS, 'reports'>;
type Field = [label: string, value: string | undefined];
type Attachment = { photo: Photo; group: string };

export type WorkRecord = {
  key: string;
  kind: RecordKind;
  label: string;
  title: string;
  date: string;
  time: string;
  fields: Field[];
  attachments: Attachment[];
};

export function workRecords(ws: Workspace): WorkRecord[] {
  const departments = new Map(ws.departments.map((item) => [item.id, item.name]));
  const people = new Map(ws.technicians.map((item) => [item.id, item.name]));
  const meetings = new Map(ws.meetings.map((item) => [item.id, item.title]));
  const places = new Map(ws.places?.map((item) => [item.id, item.name]));
  const participants = (ids: string[] = []) => ids.map((id) => people.get(id)).filter(Boolean).join('، ');
  const stamp = (value?: string) => value && Number.isFinite(Date.parse(value)) ? riyadhNow(new Date(value)).time : '';
  const pictures = (photos: Photo[] = [], group: string) => photos.map((photo) => ({ photo, group }));
  return [
    ...ws.visits.filter((v) => !v.seed).map((v): WorkRecord => ({
      key: v.id, kind: 'visits', label: 'زيارة', title: v.location || places.get(v.placeId ?? '') || v.workType || 'ميدانية',
      date: v.date, time: v.time,
      fields: [['القسم', departments.get(v.departmentId)], ['المشاركون', participants(v.technicianIds)], ['نوع المهمة', v.workType], ['رقم المهمة', v.taskNumber], ['الموقع', v.location], ['الإحداثيات', v.coords && `${v.coords.lat}, ${v.coords.lng}`], ['رابط الخريطة', v.mapUrl], ['الوصف', v.site], ['تاريخ الإقفال', v.closedAt], ['ملاحظة الإقفال', v.closeNote]],
      attachments: [...pictures(v.before, 'قبل'), ...pictures(v.after, 'بعد')],
    })),
    ...ws.attendance.filter((a) => !a.seed).map((a): WorkRecord => ({
      key: a.id, kind: 'meetings', label: 'اجتماع', title: meetings.get(a.meetingId) || 'سجل حضور',
      date: a.date, time: a.time ?? '',
      fields: [['القسم', departments.get(a.departmentId)], ['الحضور', participants(a.technicianIds)]], attachments: [],
    })),
    ...(ws.findings ?? []).map((f): WorkRecord => ({
      key: f.id, kind: 'findings', label: FINDING_NOUN[f.kind] || 'متابعة', title: f.title,
      date: f.date, time: stamp(f.createdAt),
      fields: [['القسم', departments.get(f.departmentId ?? '')], ['الوصف', f.description], ['الموقع', f.location], ['المسؤول', f.responsible], ['الفنيون', participants(f.technicianIds)], ['الحالة', STATUS_LABEL[f.status]], ['الموعد', f.dueDate], ['الإقفال', f.closedAt], ...Object.entries(f.extra ?? {}), ['تحديثات المتابعة', f.updates.map((update) => update.date + ' · ' + update.text).join('\n')]],
      attachments: pictures(f.photos, 'مرفق'),
    })),
    ...(ws.equipment ?? []).map((e): WorkRecord => ({
      key: e.id, kind: 'equipment', label: 'معدة', title: e.name, date: e.date, time: stamp(e.createdAt),
      fields: [['الموقع', e.location], ['الملاحظات', e.notes]], attachments: [...pictures(e.before, 'قبل'), ...pictures(e.after, 'بعد')],
    })),
    ...(ws.overtime ?? []).map((o): WorkRecord => ({
      key: o.id, kind: 'overtime', label: 'عمل خارج الدوام', title: o.reason || 'سجل دوام', date: o.date, time: o.start,
      fields: [['البدء', o.start], ['الانتهاء', o.end], ['السبب', o.reason]], attachments: [],
    })),
  ];
}

export function monthPath(date: string) {
  const [year, month] = date.split('-');
  const label = MONTHS_AR[Number(month) - 1];
  return /^\d{4}$/.test(year) && /^\d{2}$/.test(month) && label ? { year, month, label: month + ' - ' + label } : null;
}

export function recordName(record: WorkRecord) {
  const title = record.title.replace(/[\u0000-\u001f/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  const time = isTime(record.time) ? '_' + record.time.replace(':', '-') : '';
  return [record.date + time, record.label, title].filter(Boolean).join(' - ');
}

const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function recordHtml(record: WorkRecord) {
  const time = isTime(record.time) ? ' · ' + record.time + ' بتوقيت السعودية' : '';
  const fields = record.fields.filter(([, value]) => value).map(([label, value]) =>
    '<tr><th>' + esc(label) + '</th><td>' + esc(value ?? '') + '</td></tr>').join('');
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>' +
    'body{font:15px -apple-system,Tahoma,sans-serif;color:#213c37;padding:28px}h1{font-size:23px}p{color:#526762}table{border-collapse:collapse;width:100%}th,td{padding:10px;border-bottom:1px solid #dee8e2;text-align:right;vertical-align:top}th{width:25%}td{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body>' +
    '<h1>' + esc(record.label + ' · ' + record.title) + '</h1><p>' + esc(record.date + time) + '</p>' +
    '<table>' + fields + '</table><p>المرفقات في مجلد السجل · ' + record.attachments.length + '</p></body></html>';
}
