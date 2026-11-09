import { weekdayOf } from './dates';
import { attendanceFor, newId } from './records';
import { slotAt, Slot } from './shifts';
import type { Department, PlanItem, Technician, Workspace } from './types';

export type DayTask = {
  item: PlanItem;
  department: Department;
  date: string;
  slot: Slot | null;
  done: boolean;
  xp: number;
};

/** أعمال اليوم المخططة من الخطة الأسبوعية، مع فنيي الشفت في وقت كل مهمة. */
export function tasksOn(ws: Workspace, date: string): DayTask[] {
  const weekday = weekdayOf(date);
  return ws.plan
    .filter((item) => item.weekday === weekday)
    .sort((a, b) => a.time.localeCompare(b.time))
    .flatMap((item) => {
      const department = ws.departments.find((dept) => dept.id === item.departmentId);
      if (!department) return [];
      const done =
        item.kind === 'visit'
          ? ws.visits.some((visit) => visit.planItemId === item.id && visit.date === date)
          : !!item.meetingId && !!attendanceFor(ws, item.meetingId, item.departmentId, date);
      return [
        {
          item,
          department,
          date,
          slot: slotAt(ws, department, date, item.time),
          done,
          xp: item.kind === 'visit' ? ws.settings.xpVisit : ws.settings.xpMeeting,
        },
      ];
    });
}

export const plannedVisit = (ws: Workspace, item: PlanItem, date: string) =>
  ws.visits.find((visit) => visit.planItemId === item.id && visit.date === date);

/* ───────────── إعداد بيانات العمل ───────────── */

export function upsertTechnician(ws: Workspace, tech: Omit<Technician, 'id'> & { id?: string }): Workspace {
  const name = tech.name.trim();
  const employeeNumber = tech.employeeNumber.trim();
  const team = tech.kind === 'team' || tech.kind === 'project';
  if (!name) throw new Error(tech.kind === 'project' ? 'اكتب اسم المشروع' : team ? 'اكتب اسم الفريق أو المقاول' : 'اكتب اسم الفني');
  if (!employeeNumber && !team) throw new Error('اكتب الرقم الوظيفي');
  if (employeeNumber && ws.technicians.some((item) => item.employeeNumber === employeeNumber && item.id !== tech.id))
    throw new Error('الرقم مستخدم لفني أو فريق آخر');
  const department = ws.departments.find((item) => item.id === tech.departmentId);
  if (!department?.shifts.some((shift) => shift.id === tech.baseShiftId)) throw new Error('اختر القسم والشفت الأساسي');
  const clean = { ...tech, name, employeeNumber, contractor: team ? tech.contractor?.trim() || undefined : undefined };
  if (tech.id && ws.technicians.some((item) => item.id === tech.id))
    return { ...ws, technicians: ws.technicians.map((item) => (item.id === tech.id ? ({ ...item, ...clean } as Technician) : item)) };
  return { ...ws, technicians: [...ws.technicians, { ...clean, id: newId('t') } as Technician] };
}

/** حذف الفني من القوائم. إذا كان له سجلات يُعطَّل بدل الحذف للمحافظة على التقارير. */
export function removeTechnician(ws: Workspace, id: string): Workspace {
  const used = ws.visits.some((visit) => visit.technicianIds.includes(id)) || ws.attendance.some((item) => item.technicianIds.includes(id));
  return used
    ? { ...ws, technicians: ws.technicians.map((item) => (item.id === id ? { ...item, active: false } : item)) }
    : { ...ws, technicians: ws.technicians.filter((item) => item.id !== id) };
}

export function updateDepartment(ws: Workspace, department: Department): Workspace {
  if (!department.name.trim()) throw new Error('اكتب اسم القسم');
  if (!department.shifts.length) throw new Error('القسم يحتاج شفتًا واحدًا على الأقل');
  if (!department.periods.length) throw new Error('القسم يحتاج فترة دوام واحدة على الأقل');
  return { ...ws, departments: ws.departments.map((item) => (item.id === department.id ? department : item)) };
}

export function addPlanItem(ws: Workspace, item: Omit<PlanItem, 'id'>): Workspace {
  if (!item.title.trim()) throw new Error('اكتب عنوان المهمة');
  if (item.kind === 'meeting' && !item.meetingId) throw new Error('اختر الاجتماع');
  return { ...ws, plan: [...ws.plan, { ...item, title: item.title.trim(), id: newId('p') }] };
}

export const removePlanItem = (ws: Workspace, id: string): Workspace => ({ ...ws, plan: ws.plan.filter((item) => item.id !== id) });
