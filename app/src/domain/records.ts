import { isDateKey, isTime } from './dates';
import type { Meeting, MeetingAttendance, Visit, Workspace } from './types';

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return prefix + '-' + Date.now().toString(36) + '-' + counter.toString(36) + Math.random().toString(36).slice(2, 6);
}

export type VisitInput = {
  departmentId: string;
  date: string;
  time: string;
  site: string;
  technicianIds: string[];
  planItemId?: string;
};

export function validateVisit(ws: Workspace, input: VisitInput, today: string): string | null {
  if (!ws.departments.some((item) => item.id === input.departmentId)) return 'اختر القسم';
  if (!isDateKey(input.date)) return 'التاريخ غير صحيح';
  if (input.date > today) return 'ما يمكن تسجيل زيارة بتاريخ قادم';
  if (!isTime(input.time)) return 'اكتب الوقت بصيغة 24 ساعة مثل 09:30';
  if (!input.site.trim()) return 'اكتب موقع الزيارة أو وصفها';
  if (!input.technicianIds.length) return 'حدد فنيًا واحدًا على الأقل';
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
    site: input.site.trim(),
    technicianIds: [...new Set(input.technicianIds)],
    ...(input.planItemId ? { planItemId: input.planItemId } : {}),
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
        ? { ...visit, ...input, site: input.site.trim(), technicianIds: [...new Set(input.technicianIds)], updatedAt: stamp }
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
  input: { departmentId: string; date: string; entries: Record<string, string[]> },
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
      attendance[index] = { ...attendance[index], technicianIds: unique, updatedAt: stamp };
      updated++;
    } else {
      const record: MeetingAttendance = {
        id: newId('a'),
        meetingId,
        departmentId: input.departmentId,
        date: input.date,
        technicianIds: unique,
        updatedAt: stamp,
      };
      attendance = [...attendance, record];
      created++;
    }
  }
  return { ws: { ...ws, attendance }, created, updated, removed };
}
