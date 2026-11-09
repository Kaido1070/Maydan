import { addDays } from './dates';
import { activeTechnicians, currentSlot, getSlot } from './shifts';
import { techProgress, TechProgress } from './stats';
import type { Department, Now, Settings, Technician, Workspace } from './types';

export type DailyTask = {
  kind: 'visit' | 'meeting';
  technician: Technician;
  department: Department;
  /** على رأس العمل الآن (وليس فقط ضمن دوام اليوم). */
  onShiftNow: boolean;
  /** انسجلت له زيارة/حضور اليوم. */
  done: boolean;
  progress: TechProgress;
};

/**
 * الفنيون اللي يداومون اليوم: كل فترات اليوم، ومعها الشفت المسائي الممتد من أمس إذا كان شغالًا الآن.
 * يرجع لكل فني قسمه وهل هو على رأس العمل الآن.
 */
export function workingToday(ws: Workspace, now: Now): Map<string, { technician: Technician; department: Department; onShiftNow: boolean }> {
  const result = new Map<string, { technician: Technician; department: Department; onShiftNow: boolean }>();
  const active = new Set(activeTechnicians(ws).map((tech) => tech.id));
  for (const department of ws.departments) {
    const nowIds = new Set((currentSlot(ws, department, now)?.crew ?? []).map((tech) => tech.id));
    const slots = department.periods.map((period) => getSlot(ws, department, now.date, period.id));
    const current = currentSlot(ws, department, now);
    if (current && current.date === addDays(now.date, -1)) slots.push(current);
    for (const slot of slots) {
      for (const technician of slot.crew) {
        if (!active.has(technician.id)) continue;
        const previous = result.get(technician.id);
        result.set(technician.id, {
          technician,
          department,
          onShiftNow: (previous?.onShiftNow ?? false) || nowIds.has(technician.id),
        });
      }
    }
  }
  return result;
}

/**
 * مهام اليوم: تذكير بزيارة لكل فني يداوم اليوم ولم يكمل هدف الزيارات،
 * وتذكير باجتماع لكل فني باقي عليه اجتماعات. المهمة تصير منجزة إذا انسجل له شي اليوم.
 */
export function dailyTasks(ws: Workspace, now: Now): DailyTask[] {
  const tasks: DailyTask[] = [];
  for (const { technician, department, onShiftNow } of workingToday(ws, now).values()) {
    const progress = techProgress(ws, technician, now.date);
    const visitedToday = ws.visits.some((visit) => visit.date === now.date && visit.technicianIds.includes(technician.id));
    const metToday = ws.attendance.some((item) => item.date === now.date && item.technicianIds.includes(technician.id));
    if (progress.visitRemaining > 0 || visitedToday)
      tasks.push({ kind: 'visit', technician, department, onShiftNow, done: visitedToday, progress });
    if (progress.meetingRemaining > 0 || metToday)
      tasks.push({ kind: 'meeting', technician, department, onShiftNow, done: metToday, progress });
  }
  const need = (task: DailyTask) => (task.kind === 'visit' ? task.progress.visitCount : task.progress.attended.size);
  return tasks.sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      Number(b.onShiftNow) - Number(a.onShiftNow) ||
      (a.kind === b.kind ? 0 : a.kind === 'visit' ? -1 : 1) ||
      need(a) - need(b) ||
      a.technician.name.localeCompare(b.technician.name, 'ar'),
  );
}

/** نص قصير لحالة المهمة. */
export function taskReason(task: DailyTask, settings: Settings): string {
  if (task.kind === 'visit') {
    if (task.done) return 'انسجلت له زيارة اليوم';
    return task.progress.visitCount
      ? task.progress.visitCount + ' من ' + settings.visitTarget + ' زيارات خلال ' + settings.visitWindowMonths + ' أشهر'
      : 'ما طلعت عليه زيارة';
  }
  if (task.done) return 'حضر اجتماع اليوم';
  return task.progress.attended.size ? 'باقي عليه ' + task.progress.meetingRemaining + ' اجتماع' : 'ما سويت معه اجتماع';
}
