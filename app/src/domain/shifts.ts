import { addDays, daysBetween, minutesOf, mod, weekdayOf } from './dates';
import type { Department, EntryKind, Now, PeriodDef, Shift, SlotOverride, Technician, Workspace } from './types';

export const OFF = 'off';

export const isOvernight = (period: PeriodDef) => minutesOf(period.end) <= minutesOf(period.start);

export const periodRange = (period: PeriodDef) =>
  '\u2066' + period.start + ' – ' + period.end + '\u2069' + (isOvernight(period) ? ' (اليوم التالي)' : '');

/** الفترة التي يعمل فيها الشفت رقم shiftIndex في التاريخ المحدد، أو null إذا كان راحة. */
export function shiftPeriodOn(department: Department, shiftIndex: number, date: string): string | null {
  const rotation = department.rotation;
  if (rotation.kind === 'weekly') {
    if (!rotation.workDays.includes(weekdayOf(date)) || !department.periods.length) return null;
    return department.periods[shiftIndex % department.periods.length].id;
  }
  if (!rotation.pattern.length) return null;
  const position = mod(daysBetween(rotation.anchorDate, date) + shiftIndex * rotation.staggerDays, rotation.pattern.length);
  const value = rotation.pattern[position];
  return value === OFF ? null : value;
}

export function defaultShift(department: Department, date: string, periodId: string): Shift | undefined {
  return department.shifts.find((_, index) => shiftPeriodOn(department, index, date) === periodId);
}

export const slotKey = (date: string, departmentId: string, periodId: string) => [date, departmentId, periodId].join('|');

export const activeTechnicians = (ws: Workspace) => ws.technicians.filter((tech) => tech.active !== false);

export function crewForShift(ws: Workspace, departmentId: string, shiftId: string): Technician[] {
  return activeTechnicians(ws).filter((tech) => tech.departmentId === departmentId && tech.baseShiftId === shiftId);
}

export type Slot = {
  key: string;
  date: string;
  department: Department;
  period: PeriodDef;
  shift?: Shift;
  crew: Technician[];
  /** الشفت مبدّل عن الدورة لهذا اليوم. */
  shiftChanged: boolean;
  /** قائمة الفنيين لهذا اليوم مخصصة (تكليف ليوم واحد). */
  dayAssigned: boolean;
};

export function getSlot(ws: Workspace, department: Department, date: string, periodId: string): Slot {
  const key = slotKey(date, department.id, periodId);
  const period = department.periods.find((item) => item.id === periodId) ?? department.periods[0];
  const override: SlotOverride | undefined = ws.overrides[key];
  const shiftChanged = !!override && override.shiftId !== undefined;
  const shift = shiftChanged
    ? department.shifts.find((item) => item.id === override!.shiftId)
    : defaultShift(department, date, periodId);
  const byId = new Map(ws.technicians.map((tech) => [tech.id, tech]));
  const dayAssigned = !!shift && !!override?.people;
  const crew = !shift
    ? []
    : override?.people
      ? override.people.map((id) => byId.get(id)).filter((tech): tech is Technician => !!tech)
      : crewForShift(ws, department.id, shift.id);
  return { key, date, department, period, shift, crew, shiftChanged, dayAssigned };
}

/** الشفت الذي يغطي وقتًا معيّنًا (يأخذ في الحسبان الشفت المسائي الممتد من اليوم السابق). */
export function slotAt(ws: Workspace, department: Department, date: string, time: string): Slot | null {
  const minute = minutesOf(time);
  for (const period of department.periods) {
    const start = minutesOf(period.start);
    const end = minutesOf(period.end);
    let slotDate: string | null = null;
    if (isOvernight(period)) {
      if (minute >= start) slotDate = date;
      else if (minute < end) slotDate = addDays(date, -1);
    } else if (minute >= start && minute < end) {
      slotDate = date;
    }
    if (!slotDate) continue;
    const slot = getSlot(ws, department, slotDate, period.id);
    if (slot.shift) return slot;
  }
  return null;
}

export const currentSlot = (ws: Workspace, department: Department, now: Now) => slotAt(ws, department, now.date, now.time);

export function shiftLabel(slot: Slot | null | undefined): string {
  if (!slot?.shift) return 'لا يوجد شفت نشط';
  return slot.department.periods.length > 1 ? slot.shift.name + ' · ' + slot.period.name : slot.shift.name;
}

export const shiftName = (ws: Workspace, tech: Technician) =>
  ws.departments.find((item) => item.id === tech.departmentId)?.shifts.find((shift) => shift.id === tech.baseShiftId)?.name ?? '—';

export const isTeam = (tech: Technician) => tech.kind === 'team';
export const isProject = (tech: Technician) => tech.kind === 'project';

export const ENTRY_NOUN: Record<EntryKind, string> = { person: 'فني', team: 'فريق', project: 'مشروع' };

/** نوع السجلات الافتراضي للقسم (الإنشاءات = مشاريع). */
export const deptEntryKind = (department: Department | undefined): 'person' | 'project' => department?.entryKind ?? 'person';

/** وصف قصير يعرّف الفني أو الفريق أو المشروع: الرقم الوظيفي، أو «مشروع · مقاول ...». */
export function techTag(tech: Technician, long = false): string {
  if (!tech.kind || tech.kind === 'person') return (long ? 'الرقم الوظيفي ' : '') + tech.employeeNumber;
  return [ENTRY_NOUN[tech.kind], tech.contractor ? 'مقاول ' + tech.contractor : '', tech.employeeNumber ? 'رقم ' + tech.employeeNumber : ''].filter(Boolean).join(' · ');
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')) || '؟';
}

/* ───────────── تعديلات الجدول ───────────── */

/** نقل الفني إلى شفت أساسي جديد (دائم). التكليفات اليومية المحفوظة تبقى كما هي. */
export function moveTechnician(ws: Workspace, technicianId: string, shiftId: string): Workspace {
  const tech = ws.technicians.find((item) => item.id === technicianId);
  const department = ws.departments.find((item) => item.shifts.some((shift) => shift.id === shiftId));
  if (!tech || !department) throw new Error('الشفت أو الفني غير موجود');
  return {
    ...ws,
    technicians: ws.technicians.map((item) =>
      item.id === technicianId ? { ...item, baseShiftId: shiftId, departmentId: department.id } : item,
    ),
  };
}

function cleanOverride(ws: Workspace, key: string, override: SlotOverride): Record<string, SlotOverride> {
  const overrides = { ...ws.overrides };
  if (override.shiftId === undefined && !override.people) delete overrides[key];
  else overrides[key] = override;
  return overrides;
}

/** تبديل شفت يوم واحد في الجدول (null = بدون شفت). */
export function setSlotShift(ws: Workspace, departmentId: string, date: string, periodId: string, shiftId: string | null): Workspace {
  const department = ws.departments.find((item) => item.id === departmentId)!;
  const key = slotKey(date, departmentId, periodId);
  const fallback = defaultShift(department, date, periodId)?.id ?? null;
  return { ...ws, overrides: cleanOverride(ws, key, shiftId === fallback ? {} : { shiftId }) };
}

/** تكليف ليوم واحد: يحدد قائمة الفنيين لهذا التاريخ والفترة فقط. */
export function setDayCrew(ws: Workspace, departmentId: string, date: string, periodId: string, people: string[]): Workspace {
  const department = ws.departments.find((item) => item.id === departmentId)!;
  const slot = getSlot(ws, department, date, periodId);
  if (!slot.shift) throw new Error('لا يوجد شفت في هذه الفترة');
  const key = slot.key;
  const current = ws.overrides[key] ?? {};
  const base = crewForShift(ws, departmentId, slot.shift.id).map((tech) => tech.id);
  const unique = [...new Set(people)];
  const followsShift = unique.length === base.length && base.every((id) => unique.includes(id));
  return { ...ws, overrides: cleanOverride(ws, key, { shiftId: current.shiftId, people: followsShift ? undefined : unique }) };
}

export function assignForDay(
  ws: Workspace,
  technicianId: string,
  departmentId: string,
  date: string,
  periodId: string,
  assigned: boolean,
): Workspace {
  const department = ws.departments.find((item) => item.id === departmentId)!;
  const ids = getSlot(ws, department, date, periodId).crew.map((tech) => tech.id).filter((id) => id !== technicianId);
  return setDayCrew(ws, departmentId, date, periodId, assigned ? [...ids, technicianId] : ids);
}

export function resetSlot(ws: Workspace, departmentId: string, date: string, periodId: string): Workspace {
  const overrides = { ...ws.overrides };
  delete overrides[slotKey(date, departmentId, periodId)];
  return { ...ws, overrides };
}
