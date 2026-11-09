import { monthsBefore } from './dates';
import { activeTechnicians, crewForShift, shiftName } from './shifts';
import type { Department, Meeting, Shift, Technician, Visit, Workspace } from './types';

export type Tone = 'green' | 'amber' | 'red';
/** صفر أحمر، أقل من الهدف أصفر، الهدف أو أكثر أخضر. */
export const tone = (value: number, target: number): Tone => (value >= target && target > 0 ? 'green' : value > 0 ? 'amber' : target > 0 ? 'red' : 'green');

export const visitWindowStart = (ws: Workspace, asOf: string) => monthsBefore(asOf, ws.settings.visitWindowMonths);

/** زيارات الفني خلال نافذة آخر 6 أشهر (افتراضيًا). الزيارة الجماعية تُحسب زيارة لكل فني شملته. */
export function technicianVisits(ws: Workspace, technicianId: string, asOf: string): Visit[] {
  const start = visitWindowStart(ws, asOf);
  return ws.visits
    .filter((visit) => visit.technicianIds.includes(technicianId) && visit.date >= start && visit.date <= asOf)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

export const yearMeetings = (ws: Workspace, year: number): Meeting[] => ws.meetings.filter((item) => item.year === year);

/** الاجتماعات (من قائمة السنة) التي حضرها الفني. */
export function attendedMeetings(ws: Workspace, technicianId: string, year: number, asOf?: string): Set<string> {
  const ids = new Set(yearMeetings(ws, year).map((item) => item.id));
  return new Set(
    ws.attendance
      .filter((item) => ids.has(item.meetingId) && item.technicianIds.includes(technicianId) && (!asOf || item.date <= asOf))
      .map((item) => item.meetingId),
  );
}

export type TechProgress = {
  technician: Technician;
  visits: Visit[];
  visitCount: number;
  visitRemaining: number;
  attended: Set<string>;
  meetingTarget: number;
  meetingRemaining: number;
  missingMeetings: Meeting[];
};

export function techProgress(ws: Workspace, technician: Technician, asOf: string): TechProgress {
  const year = Number(asOf.slice(0, 4));
  const visits = technicianVisits(ws, technician.id, asOf);
  const meetings = yearMeetings(ws, year);
  const attended = attendedMeetings(ws, technician.id, year, asOf);
  const missingMeetings = meetings.filter((item) => !attended.has(item.id));
  return {
    technician,
    visits,
    visitCount: visits.length,
    visitRemaining: Math.max(0, ws.settings.visitTarget - visits.length),
    attended,
    meetingTarget: meetings.length,
    meetingRemaining: missingMeetings.length,
    missingMeetings,
  };
}

export type Coverage = {
  people: number;
  visitRemaining: number;
  attendanceRemaining: number;
  visitComplete: number;
  meetingComplete: number;
  complete: number;
  /** عدد الغائبين عن كل اجتماع بنفس ترتيب meetings */
  missingByMeeting: number[];
};

export function coverageOf(ws: Workspace, techs: Technician[], asOf: string): { coverage: Coverage; pending: TechProgress[] } {
  const meetings = yearMeetings(ws, Number(asOf.slice(0, 4)));
  const coverage: Coverage = {
    people: techs.length,
    visitRemaining: 0,
    attendanceRemaining: 0,
    visitComplete: 0,
    meetingComplete: 0,
    complete: 0,
    missingByMeeting: meetings.map(() => 0),
  };
  const pending: TechProgress[] = [];
  for (const tech of techs) {
    const progress = techProgress(ws, tech, asOf);
    coverage.visitRemaining += progress.visitRemaining;
    coverage.attendanceRemaining += progress.meetingRemaining;
    coverage.visitComplete += Number(!progress.visitRemaining);
    coverage.meetingComplete += Number(!progress.meetingRemaining);
    coverage.complete += Number(!progress.visitRemaining && !progress.meetingRemaining);
    meetings.forEach((meeting, index) => {
      if (!progress.attended.has(meeting.id)) coverage.missingByMeeting[index]++;
    });
    if (progress.visitRemaining || progress.meetingRemaining) pending.push(progress);
  }
  return { coverage, pending };
}

export type ShiftCoverage = { shift: Shift; coverage: Coverage; people: Technician[] };
export type DepartmentCoverage = { department: Department; shifts: ShiftCoverage[]; coverage: Coverage };

/** المتبقي لكل قسم ولكل شفت (حسب الشفت الأساسي للفني). */
export function coverageByDepartment(ws: Workspace, asOf: string, departmentId: string | 'all' = 'all'): DepartmentCoverage[] {
  return ws.departments
    .filter((department) => departmentId === 'all' || department.id === departmentId)
    .map((department) => {
      const shifts = department.shifts.map((shift) => {
        const people = crewForShift(ws, department.id, shift.id);
        return { shift, people, coverage: coverageOf(ws, people, asOf).coverage };
      });
      const all = activeTechnicians(ws).filter((tech) => tech.departmentId === department.id);
      return { department, shifts, coverage: coverageOf(ws, all, asOf).coverage };
    });
}

export type FollowUp = TechProgress & { departmentName: string; shiftName: string };

/** قائمة أولوية المتابعة: الأكثر احتياجًا للزيارات ثم الحضور. */
export function followUpList(ws: Workspace, asOf: string, departmentId: string | 'all' = 'all'): FollowUp[] {
  const techs = activeTechnicians(ws).filter((tech) => departmentId === 'all' || tech.departmentId === departmentId);
  return coverageOf(ws, techs, asOf)
    .pending.map((progress) => ({
      ...progress,
      departmentName: ws.departments.find((item) => item.id === progress.technician.departmentId)?.name ?? '—',
      shiftName: shiftName(ws, progress.technician),
    }))
    .sort(
      (a, b) =>
        b.visitRemaining - a.visitRemaining ||
        b.meetingRemaining - a.meetingRemaining ||
        a.technician.name.localeCompare(b.technician.name, 'ar'),
    );
}

/** نقاط الخبرة من السجلات التي سجلها المستخدم (سجلات التجربة الأولية لا تُحتسب). */
export function xpSummary(ws: Workspace) {
  const xp =
    ws.visits.filter((visit) => !visit.seed).length * ws.settings.xpVisit +
    ws.attendance.filter((item) => !item.seed).length * ws.settings.xpMeeting;
  return { xp, level: Math.floor(xp / 100) + 1, levelXp: xp % 100 };
}

export function dayProgress(ws: Workspace, date: string) {
  return {
    visits: ws.visits.filter((visit) => visit.date === date).length,
    goal: ws.settings.dailyVisitGoal,
    meetings: ws.attendance.filter((item) => item.date === date).length,
  };
}

export function findByEmployeeNumber(ws: Workspace, number: string): Technician | undefined {
  return ws.technicians.find((tech) => tech.employeeNumber === number.trim());
}
