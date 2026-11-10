import { isDateKey, isTime } from './dates';
import type { Meeting, MeetingAttendance, Photo, Visit, Workspace } from './types';

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return prefix + '-' + Date.now().toString(36) + '-' + counter.toString(36) + Math.random().toString(36).slice(2, 6);
}

export type VisitInput = {
  departmentId: string;
  date: string;
  time: string;
  workType?: string;
  location?: string;
  taskNumber?: string;
  /** وصف إضافي (اختياري). */
  site: string;
  technicianIds: string[];
  planItemId?: string;
  placeId?: string;
  /** زيارة معدات التوزيع: ما تحتاج فنيين ولا قسم. */
  target?: 'equipment';
  /** صور قبل (زيارة المعدة). */
  before?: Photo[];
  coords?: { lat: number; lng: number };
  mapUrl?: string;
};

const clean = (value?: string) => value?.trim().replace(/\s+/g, ' ') || undefined;

/** الحقول المنظفة للزيارة: نوع المهمة، الموقع، الرقم، الوصف. */
function visitFields(input: VisitInput) {
  return {
    workType: clean(input.workType),
    location: clean(input.location),
    taskNumber: clean(input.taskNumber),
    site: input.site.trim(),
  };
}

/** عنوان الزيارة في القوائم: نوع المهمة، وإلا الموقع، وإلا الوصف. */
export const visitTitle = (visit: Pick<Visit, 'workType' | 'location' | 'site'>) => visit.workType || visit.location || visit.site || 'زيارة';

/** تفاصيل الزيارة تحت العنوان: الموقع ورقم المهمة والوصف (بدون تكرار العنوان). */
export function visitDetails(visit: Pick<Visit, 'workType' | 'location' | 'site' | 'taskNumber'>): string {
  const title = visitTitle(visit);
  return [visit.location !== title ? visit.location : '', visit.taskNumber ? 'رقم ' + visit.taskNumber : '', visit.site && visit.site !== title ? visit.site : '']
    .filter(Boolean)
    .join(' · ');
}

export const EQUIPMENT_WORK_TYPE = 'زيارة معدات التوزيع';
/** أنواع معدات التوزيع الشائعة كاقتراحات سريعة. */
export const EQUIPMENT_KINDS = ['محطة توزيع', 'محول', 'لوحة توزيع', 'كابينة', 'قاطع', 'خط هوائي', 'كابل أرضي'];

export const DEFAULT_WORK_TYPES = ['صيانة', 'تمديد كابلات', 'توصيلات', 'طوارئ', 'فحص معدات', 'إنشاءات', 'تشغيل'];

/** اقتراحات نوع المهمة: آخر الأنواع المستخدمة ثم الافتراضية. */
export function workTypeSuggestions(ws: Workspace, limit = 8): string[] {
  const used = [...ws.visits].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).map((v) => v.workType).filter((v): v is string => !!v);
  return [...new Set([...used, ...DEFAULT_WORK_TYPES])].slice(0, limit);
}

export function validateVisit(ws: Workspace, input: VisitInput, today: string): string | null {
  const place = input.placeId ? (ws.places ?? []).find((item) => item.id === input.placeId) : undefined;
  if (input.placeId && !place) return 'المكان غير موجود';
  const free = !!place || input.target === 'equipment';
  if (!free && !ws.departments.some((item) => item.id === input.departmentId)) return 'اختر القسم';
  if (!isDateKey(input.date)) return 'التاريخ غير صحيح';
  if (input.date > today) return 'ما يمكن تسجيل زيارة بتاريخ قادم';
  if (!isTime(input.time)) return 'اكتب الوقت بصيغة 24 ساعة مثل 09:30';
  if (!clean(input.workType) && !clean(input.location) && !input.site.trim()) return 'اكتب نوع المهمة أو الموقع';
  if (input.target === 'equipment' && !clean(input.location)) return 'اكتب اسم المعدة أو موقعها';
  if (!free && !input.technicianIds.length) return 'حدد فنيًا واحدًا على الأقل';
  return null;
}

/** كل زيارة سجل مستقل، فيمكن تسجيل أكثر من زيارة لنفس القسم في نفس اليوم. */
export function addVisit(ws: Workspace, input: VisitInput, today: string, stamp = new Date().toISOString()): { ws: Workspace; visit: Visit } {
  const error = validateVisit(ws, input, today);
  if (error) throw new Error(error);
  const visit: Visit = {
    id: newId('v'),
    departmentId: input.departmentId,
    date: input.date,
    time: input.time,
    ...visitFields(input),
    technicianIds: [...new Set(input.technicianIds)],
    ...(input.planItemId ? { planItemId: input.planItemId } : {}),
    ...(input.placeId ? { placeId: input.placeId } : {}),
    ...(input.target ? { target: input.target } : {}),
    ...(input.before?.length ? { before: input.before } : {}),
    ...(input.coords ? { coords: input.coords } : {}),
    ...(input.mapUrl ? { mapUrl: input.mapUrl } : {}),
    createdAt: stamp,
    updatedAt: stamp,
  };
  return { ws: { ...ws, visits: [...ws.visits, visit] }, visit };
}

export function updateVisit(ws: Workspace, id: string, input: VisitInput, today: string, stamp = new Date().toISOString()): Workspace {
  const error = validateVisit(ws, input, today);
  if (error) throw new Error(error);
  return {
    ...ws,
    visits: ws.visits.map((visit) =>
      visit.id === id
        ? { ...visit, ...input, ...visitFields(input), technicianIds: [...new Set(input.technicianIds)], updatedAt: stamp }
        : visit,
    ),
  };
}

export const deleteVisit = (ws: Workspace, id: string): Workspace => ({ ...ws, visits: ws.visits.filter((visit) => visit.id !== id) });

const normalizeTitle = (title: string) => title.trim().replace(/\s+/g, ' ');

export function addMeeting(ws: Workspace, title: string, year: number): { ws: Workspace; meeting: Meeting } {
  const clean = normalizeTitle(title);
  if (!clean) throw new Error('اكتب عنوان الاجتماع');
  if (ws.meetings.some((item) => item.year === year && item.title.toLowerCase() === clean.toLowerCase()))
    throw new Error('عنوان الاجتماع موجود بالفعل');
  const meeting: Meeting = { id: newId('m'), title: clean, year };
  return { ws: { ...ws, meetings: [...ws.meetings, meeting] }, meeting };
}

export function renameMeeting(ws: Workspace, id: string, title: string): Workspace {
  const clean = normalizeTitle(title);
  if (!clean) throw new Error('اكتب عنوان الاجتماع');
  return { ...ws, meetings: ws.meetings.map((item) => (item.id === id ? { ...item, title: clean } : item)) };
}

export const deleteMeeting = (ws: Workspace, id: string): Workspace => ({
  ...ws,
  meetings: ws.meetings.filter((item) => item.id !== id),
  attendance: ws.attendance.filter((item) => item.meetingId !== id),
  plan: ws.plan.filter((item) => item.meetingId !== id),
});

export const attendanceFor = (ws: Workspace, meetingId: string, departmentId: string, date: string) =>
  ws.attendance.find((item) => item.meetingId === meetingId && item.departmentId === departmentId && item.date === date);

/**
 * حفظ حضور أكثر من اجتماع دفعة واحدة.
 * entries: لكل اجتماع قائمة الفنيين الحاضرين. القائمة الفارغة تحذف سجل ذلك الاجتماع.
 */
export function saveAttendanceBatch(
  ws: Workspace,
  input: { departmentId: string; date: string; time?: string; entries: Record<string, string[]> },
  stamp = new Date().toISOString(),
): { ws: Workspace; created: number; updated: number; removed: number } {
  let attendance = [...ws.attendance];
  let created = 0;
  let updated = 0;
  let removed = 0;
  for (const [meetingId, people] of Object.entries(input.entries)) {
    if (!ws.meetings.some((item) => item.id === meetingId)) throw new Error('اجتماع غير معروف');
    const unique = [...new Set(people)];
    const index = attendance.findIndex(
      (item) => item.meetingId === meetingId && item.departmentId === input.departmentId && item.date === input.date,
    );
    if (!unique.length) {
      if (index >= 0) {
        attendance.splice(index, 1);
        removed++;
      }
      continue;
    }
    if (index >= 0) {
      attendance[index] = { ...attendance[index], technicianIds: unique, ...(input.time ? { time: input.time } : {}), updatedAt: stamp };
      updated++;
    } else {
      const record: MeetingAttendance = {
        id: newId('a'),
        meetingId,
        departmentId: input.departmentId,
        date: input.date,
        ...(input.time ? { time: input.time } : {}),
        technicianIds: unique,
        updatedAt: stamp,
      };
      attendance = [...attendance, record];
      created++;
    }
  }
  return { ws: { ...ws, attendance }, created, updated, removed };
}

/** إقفال ملاحظة المعدة بصور بعد. */
export function closeEquipmentVisit(ws: Workspace, id: string, input: { after: Photo[]; note: string; date: string }, stamp = new Date().toISOString()): Workspace {
  if (!input.after.length) throw new Error('أضف صورة بعد عشان تقفلها');
  if (!isDateKey(input.date)) throw new Error('التاريخ غير صحيح');
  return {
    ...ws,
    visits: ws.visits.map((visit) =>
      visit.id === id ? { ...visit, after: input.after, closedAt: input.date, closeNote: input.note.trim() || undefined, updatedAt: stamp } : visit,
    ),
  };
}

/** إعادة فتح ملاحظة المعدة (الصور تبقى). */
export const reopenEquipmentVisit = (ws: Workspace, id: string, stamp = new Date().toISOString()): Workspace => ({
  ...ws,
  visits: ws.visits.map((visit) => (visit.id === id ? { ...visit, closedAt: undefined, updatedAt: stamp } : visit)),
});

/**
 * تسجيل اجتماع: نفس الحاضرين لكل الاجتماعات المختارة، من أي قسم.
 * كل قسم له سجله (اجتماع × قسم × تاريخ)، والحاضرون ينضافون على المسجلين من قبل.
 */
export function recordAttendance(
  ws: Workspace,
  input: { meetingIds: string[]; date: string; time?: string; technicianIds: string[] },
  today: string,
  stamp = new Date().toISOString(),
): { ws: Workspace; created: number; people: number } {
  const meetingIds = [...new Set(input.meetingIds)];
  const people = [...new Set(input.technicianIds)];
  if (!meetingIds.length) throw new Error('اختر الاجتماع');
  if (meetingIds.some((id) => !ws.meetings.some((item) => item.id === id))) throw new Error('اجتماع غير معروف');
  if (!people.length) throw new Error('حدد حاضرًا واحدًا على الأقل');
  if (!isDateKey(input.date)) throw new Error('التاريخ غير صحيح');
  if (input.date > today) throw new Error('ما يمكن تسجيل اجتماع بتاريخ قادم');
  if (input.time && !isTime(input.time)) throw new Error('اكتب الوقت بصيغة 24 ساعة مثل 09:30');
  const byDepartment = new Map<string, string[]>();
  for (const id of people) {
    const tech = ws.technicians.find((item) => item.id === id);
    if (!tech) continue;
    byDepartment.set(tech.departmentId, [...(byDepartment.get(tech.departmentId) ?? []), id]);
  }
  const attendance = [...ws.attendance];
  let created = 0;
  for (const meetingId of meetingIds) {
    for (const [departmentId, ids] of byDepartment) {
      const index = attendance.findIndex((item) => item.meetingId === meetingId && item.departmentId === departmentId && item.date === input.date);
      if (index >= 0) {
        attendance[index] = { ...attendance[index], technicianIds: [...new Set([...attendance[index].technicianIds, ...ids])], ...(input.time ? { time: input.time } : {}), updatedAt: stamp };
      } else {
        attendance.push({ id: newId('a'), meetingId, departmentId, date: input.date, ...(input.time ? { time: input.time } : {}), technicianIds: ids, updatedAt: stamp });
        created++;
      }
    }
  }
  return { ws: { ...ws, attendance }, created, people: people.length };
}

/** تعديل سجل حضور محفوظ: الحاضرون والوقت. القائمة الفارغة تحذف السجل. */
export function updateAttendanceRecord(ws: Workspace, id: string, input: { technicianIds: string[]; time?: string }, stamp = new Date().toISOString()): Workspace {
  const people = [...new Set(input.technicianIds)];
  if (input.time && !isTime(input.time)) throw new Error('اكتب الوقت بصيغة 24 ساعة مثل 09:30');
  return {
    ...ws,
    attendance: people.length
      ? ws.attendance.map((item) => (item.id === id ? { ...item, technicianIds: people, ...(input.time ? { time: input.time } : {}), updatedAt: stamp } : item))
      : ws.attendance.filter((item) => item.id !== id),
  };
}
