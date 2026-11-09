import { addDays, dateOf, formatDate, MONTHS_AR } from './dates';
import { coverageByDepartment, DepartmentCoverage, followUpList, FollowUp, yearMeetings } from './stats';
import type { Workspace } from './types';

export type ReportMode = 'month' | 'quarter' | 'year';
export type ReportParams = { mode: ReportMode; year: number; month: number; quarter: number; departmentId: string | 'all' };

export const REPORT_MODES: Record<ReportMode, string> = { month: 'شهري', quarter: 'ربع سنوي', year: 'سنوي' };

export type Counts = {
  /** عدد سجلات الزيارة. الزيارة التي تشمل 3 فنيين = زيارة واحدة. */
  visits: number;
  /** مجموع زيارات الفنيين (الزيارة لـ 3 فنيين = 3). */
  technicianVisits: number;
  /** عدد الفنيين المختلفين الذين تمت زيارتهم. */
  techniciansVisited: number;
  /** عدد سجلات حضور الاجتماعات (اجتماع × قسم × تاريخ). */
  meetingSessions: number;
  /** عدد الاجتماعات المختلفة التي عُقدت. */
  meetingsHeld: number;
  /** مجموع مرات الحضور. */
  attendance: number;
};

export type Bucket = Counts & { label: string; start: string; end: string };

export type Report = {
  params: ReportParams;
  label: string;
  scopeLabel: string;
  start: string;
  /** آخر يوم في الفترة (شامل). */
  last: string;
  asOf: string;
  totals: Counts;
  buckets: Bucket[];
  sections: (Counts & { departmentId: string; name: string })[];
  coverage: DepartmentCoverage[];
  pending: FollowUp[];
  meetingTitles: string[];
};

export function reportPeriod(params: ReportParams) {
  const startMonth = params.mode === 'year' ? 0 : params.mode === 'quarter' ? params.quarter * 3 : params.month;
  const length = params.mode === 'year' ? 12 : params.mode === 'quarter' ? 3 : 1;
  const start = dateOf(params.year, startMonth);
  const end = dateOf(params.year, startMonth + length);
  const label =
    params.mode === 'year'
      ? 'سنة ' + params.year
      : params.mode === 'quarter'
        ? 'الربع ' + (params.quarter + 1) + ' · ' + params.year
        : MONTHS_AR[startMonth] + ' ' + params.year;
  const buckets: { label: string; start: string; end: string }[] = [];
  if (params.mode === 'month') {
    const days = Number(addDays(end, -1).slice(8));
    for (let first = 1; first <= days; first += 7) {
      const last = Math.min(first + 6, days);
      buckets.push({ label: first + '–' + last, start: dateOf(params.year, startMonth, first), end: dateOf(params.year, startMonth, last + 1) });
    }
  } else {
    for (let month = startMonth; month < startMonth + length; month++) {
      buckets.push({ label: MONTHS_AR[month], start: dateOf(params.year, month), end: dateOf(params.year, month + 1) });
    }
  }
  return { start, end, label, buckets };
}

function countEvents(ws: Workspace, start: string, end: string, departmentId: string | 'all', today: string): Counts {
  const inRange = (date: string, dept: string) =>
    date >= start && date < end && date <= today && (departmentId === 'all' || dept === departmentId);
  const visits = ws.visits.filter((visit) => inRange(visit.date, visit.departmentId));
  const attendance = ws.attendance.filter((item) => inRange(item.date, item.departmentId));
  const visited = new Set(visits.flatMap((visit) => visit.technicianIds));
  return {
    visits: visits.length,
    technicianVisits: visits.reduce((sum, visit) => sum + visit.technicianIds.length, 0),
    techniciansVisited: visited.size,
    meetingSessions: attendance.length,
    meetingsHeld: new Set(attendance.map((item) => item.meetingId)).size,
    attendance: attendance.reduce((sum, item) => sum + item.technicianIds.length, 0),
  };
}

export function buildReport(ws: Workspace, params: ReportParams, today: string): Report {
  const period = reportPeriod(params);
  const last = addDays(period.end, -1);
  const asOf = last < today ? last : today;
  const scope = ws.departments.filter((item) => params.departmentId === 'all' || item.id === params.departmentId);
  return {
    params,
    label: period.label,
    scopeLabel: params.departmentId === 'all' ? 'كل الأقسام' : scope[0]?.name ?? '—',
    start: period.start,
    last,
    asOf,
    totals: countEvents(ws, period.start, period.end, params.departmentId, today),
    buckets: period.buckets.map((bucket) => ({ ...bucket, ...countEvents(ws, bucket.start, bucket.end, params.departmentId, today) })),
    sections: scope.map((department) => ({
      departmentId: department.id,
      name: department.name,
      ...countEvents(ws, period.start, period.end, department.id, today),
    })),
    coverage: coverageByDepartment(ws, asOf, params.departmentId),
    pending: followUpList(ws, asOf, params.departmentId),
    meetingTitles: yearMeetings(ws, Number(asOf.slice(0, 4))).map((item) => item.title),
  };
}

const COUNT_HEADINGS = ['زيارات', 'زيارات الفنيين', 'فنيون تمت زيارتهم', 'تسجيلات اجتماعات', 'مرات حضور'];
const countValues = (row: Counts) => [row.visits, row.technicianVisits, row.techniciansVisited, row.meetingSessions, row.attendance];

export function reportRows(report: Report): (string | number)[][] {
  return [
    ['تقرير ميدان', report.label, report.scopeLabel],
    ['من', report.start, 'إلى', report.last, 'المتبقي محسوب حتى', report.asOf],
    [],
    ['إجمالي الفترة', ...COUNT_HEADINGS],
    ['الإجمالي', ...countValues(report.totals)],
    [],
    ['القسم', ...COUNT_HEADINGS],
    ...report.sections.map((row) => [row.name, ...countValues(row)]),
    [],
    ['الفترة', 'من', 'إلى', ...COUNT_HEADINGS],
    ...report.buckets.map((row) => [row.label, row.start, addDays(row.end, -1), ...countValues(row)]),
    [],
    ['المتبقي حسب القسم والشفت', 'الشفت', 'عدد الفنيين', 'زيارات متبقية', 'مرات حضور متبقية', 'أكملوا الزيارات', 'أكملوا الاجتماعات'],
    ...report.coverage.flatMap((dept) => [
      ...dept.shifts.map((row) => [
        dept.department.name,
        row.shift.name,
        row.coverage.people,
        row.coverage.visitRemaining,
        row.coverage.attendanceRemaining,
        row.coverage.visitComplete,
        row.coverage.meetingComplete,
      ]),
      [dept.department.name, 'الإجمالي', dept.coverage.people, dept.coverage.visitRemaining, dept.coverage.attendanceRemaining, dept.coverage.visitComplete, dept.coverage.meetingComplete],
    ]),
    [],
    ['الفنيون المتبقي عليهم', 'الرقم الوظيفي', 'القسم', 'الشفت', 'زيارات متبقية', 'اجتماعات متبقية', 'الاجتماعات الناقصة'],
    ...report.pending.map((row) => [
      row.technician.name,
      row.technician.employeeNumber,
      row.departmentName,
      row.shiftName,
      row.visitRemaining,
      row.meetingRemaining,
      row.missingMeetings.map((item) => item.title).join(' / '),
    ]),
  ];
}

export function reportCsv(report: Report): string {
  const cell = (value: string | number) => '"' + String(value).replace(/"/g, '""') + '"';
  return '﻿' + reportRows(report).map((row) => row.map(cell).join(',')).join('\r\n');
}

export const reportFileName = (report: Report, ext: 'csv' | 'pdf') =>
  'Maydan-Report-' + report.start + '-' + report.params.mode + '-' + report.params.departmentId + '.' + ext;

const esc = (value: string | number) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/** HTML بسيط بالعربية لتحويله إلى PDF عبر expo-print. */
export function reportHtml(report: Report, engineerName: string): string {
  const table = (head: (string | number)[], rows: (string | number)[][]) =>
    '<table><thead><tr>' + head.map((cell) => '<th>' + esc(cell) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map((row) => '<tr>' + row.map((cell) => '<td>' + esc(cell) + '</td>').join('') + '</tr>').join('') +
    '</tbody></table>';
  const kpi = (label: string, value: number) => '<div class="kpi"><small>' + label + '</small><strong>' + value + '</strong></div>';
  return (
    '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>' +
    'body{font-family:-apple-system,"SF Arabic","Geeza Pro",Tahoma,sans-serif;color:#201c31;padding:24px;font-size:12px}' +
    'h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px;color:#5636c6}p{margin:0;color:#68647a}' +
    '.kpis{display:flex;gap:8px;margin-top:12px}.kpi{flex:1;background:#f6f5f9;border-radius:10px;padding:8px}.kpi small{display:block;color:#68647a}.kpi strong{font-size:18px}' +
    'table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border-bottom:1px solid #eae7f0;padding:5px 4px;text-align:right}th{color:#68647a;font-size:11px}' +
    '.note{margin-top:14px;font-size:10px}</style></head><body>' +
    '<h1>تقرير ميدان · ' + esc(report.label) + '</h1>' +
    '<p>' + esc(report.scopeLabel) + ' · من ' + formatDate(report.start, { year: true }) + ' إلى ' + formatDate(report.last, { year: true }) +
    (engineerName ? ' · ' + esc(engineerName) : '') + '</p>' +
    '<div class="kpis">' + kpi('زيارات', report.totals.visits) + kpi('زيارات الفنيين', report.totals.technicianVisits) +
    kpi('تسجيلات اجتماعات', report.totals.meetingSessions) + kpi('مرات حضور', report.totals.attendance) + '</div>' +
    '<h2>التوزيع حسب القسم</h2>' + table(['القسم', ...COUNT_HEADINGS], report.sections.map((row) => [row.name, ...countValues(row)])) +
    '<h2>الإنجاز عبر الفترة</h2>' + table(['الفترة', ...COUNT_HEADINGS], report.buckets.map((row) => [row.label, ...countValues(row)])) +
    '<h2>المتبقي حسب القسم والشفت (حتى ' + formatDate(report.asOf, { year: true }) + ')</h2>' +
    table(
      ['القسم', 'الشفت', 'الفنيون', 'زيارات متبقية', 'حضور متبقٍ'],
      report.coverage.flatMap((dept) =>
        dept.shifts.map((row) => [dept.department.name, row.shift.name, row.coverage.people, row.coverage.visitRemaining, row.coverage.attendanceRemaining]),
      ),
    ) +
    '<h2>الفنيون المتبقي عليهم (' + report.pending.length + ')</h2>' +
    (report.pending.length
      ? table(
          ['الفني', 'الرقم الوظيفي', 'القسم · الشفت', 'زيارات متبقية', 'اجتماعات متبقية'],
          report.pending.map((row) => [row.technician.name, row.technician.employeeNumber, row.departmentName + ' · ' + row.shiftName, row.visitRemaining, row.meetingRemaining]),
        )
      : '<p>اكتملت تغطية جميع الفنيين.</p>') +
    '<p class="note">الزيارة تُحسب مرة واحدة في التقرير ولو شملت أكثر من فني، وتُحسب زيارة لكل فني في سجله. هدف كل فني زيارتان خلال آخر 6 أشهر وحضور كل اجتماعات السنة.</p>' +
    '</body></html>'
  );
}
