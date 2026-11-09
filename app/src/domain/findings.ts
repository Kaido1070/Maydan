import { daysBetween, isDateKey } from './dates';
import { newId } from './records';
import type { Finding, FindingKind, FindingStatus, FindingUpdate, Photo, Technician, Workspace } from './types';

export const FINDING_NOUN: Record<FindingKind, string> = { observation: 'ملاحظة', violation: 'مخالفة' };
export const STATUS_LABEL: Record<FindingStatus, string> = { open: 'مفتوحة', progress: 'قيد المعالجة', closed: 'مقفلة' };

export type FindingInput = {
  kind: FindingKind;
  title: string;
  description: string;
  departmentId?: string;
  location: string;
  responsible: string;
  technicianIds?: string[];
  date: string;
  dueDate?: string;
  photos: Photo[];
  extra?: Record<string, string>;
};

export function validateFinding(input: FindingInput): string | null {
  if (!input.title.trim()) return 'اكتب عنوان ال' + FINDING_NOUN[input.kind];
  if (!isDateKey(input.date)) return 'التاريخ غير صحيح';
  if (input.dueDate && (!isDateKey(input.dueDate) || input.dueDate < input.date)) return 'موعد الإغلاق لازم يكون بعد تاريخ التسجيل';
  return null;
}

export function saveFinding(ws: Workspace, input: FindingInput, id?: string, stamp = new Date().toISOString()): { ws: Workspace; finding: Finding } {
  const error = validateFinding(input);
  if (error) throw new Error(error);
  const list = ws.findings ?? [];
  const existing = id ? list.find((item) => item.id === id) : undefined;
  const finding: Finding = {
    status: 'open',
    updates: [],
    ...existing,
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    location: input.location.trim(),
    responsible: input.responsible.trim(),
    technicianIds: input.technicianIds?.length ? [...new Set(input.technicianIds)] : undefined,
    id: existing?.id ?? newId('f'),
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };
  return { ws: { ...ws, findings: existing ? list.map((item) => (item.id === finding.id ? finding : item)) : [...list, finding] }, finding };
}

/** تحديث متابعة: ملاحظة، أو سبب تأخير، أو إغلاق، أو إعادة فتح. */
export function addFindingUpdate(ws: Workspace, id: string, update: Omit<FindingUpdate, 'id'>, stamp = new Date().toISOString()): Workspace {
  if ((update.kind === 'note' || update.kind === 'delay') && !update.text.trim()) throw new Error(update.kind === 'delay' ? 'اكتب سبب التأخير' : 'اكتب التحديث');
  return {
    ...ws,
    findings: (ws.findings ?? []).map((item) => {
      if (item.id !== id) return item;
      const status: FindingStatus =
        update.kind === 'close' ? 'closed' : update.kind === 'reopen' ? 'open' : item.status === 'open' ? 'progress' : item.status;
      return {
        ...item,
        status,
        closedAt: update.kind === 'close' ? update.date : update.kind === 'reopen' ? undefined : item.closedAt,
        updates: [...item.updates, { ...update, text: update.text.trim(), id: newId('u') }],
        updatedAt: stamp,
      };
    }),
  };
}

export const deleteFinding = (ws: Workspace, id: string): Workspace => ({ ...ws, findings: (ws.findings ?? []).filter((item) => item.id !== id) });

/** كم يوم لها مفتوحة (أو كم أخذت لين انقفلت). */
export const findingAge = (finding: Finding, today: string) => daysBetween(finding.date, finding.closedAt ?? today);

export const isOverdue = (finding: Finding, today: string) => finding.status !== 'closed' && !!finding.dueDate && finding.dueDate < today;

/** آخر سبب تأخير مسجل. */
export const lastDelayReason = (finding: Finding) => [...finding.updates].reverse().find((update) => update.kind === 'delay')?.text;

/** المفتوح أولًا (المتأخر ثم الأقدم)، ثم المقفل الأحدث. */
export function findingsOf(ws: Workspace, kind: FindingKind, today: string): Finding[] {
  return (ws.findings ?? [])
    .filter((item) => item.kind === kind)
    .sort(
      (a, b) =>
        Number(a.status === 'closed') - Number(b.status === 'closed') ||
        Number(isOverdue(b, today)) - Number(isOverdue(a, today)) ||
        (a.status === 'closed' ? (b.closedAt ?? '').localeCompare(a.closedAt ?? '') : a.date.localeCompare(b.date)),
    );
}

export type FindingStats = { open: number; overdue: number; closed: number; avgDaysToClose: number | null; oldestOpenDays: number };

export function findingStats(ws: Workspace, kind: FindingKind, today: string, range?: { start: string; end: string }): FindingStats {
  const list = (ws.findings ?? []).filter((item) => item.kind === kind && (!range || (item.date >= range.start && item.date < range.end)));
  const open = list.filter((item) => item.status !== 'closed');
  const closed = list.filter((item) => item.status === 'closed');
  return {
    open: open.length,
    overdue: open.filter((item) => isOverdue(item, today)).length,
    closed: closed.length,
    avgDaysToClose: closed.length ? Math.round((10 * closed.reduce((sum, item) => sum + findingAge(item, today), 0)) / closed.length) / 10 : null,
    oldestOpenDays: open.reduce((max, item) => Math.max(max, findingAge(item, today)), 0),
  };
}

/* ───────────── تفاصيل التقرير: حسب الفني، والمقفلة والباقية ───────────── */

export type FindingRow = {
  finding: Finding;
  /** أسماء الفنيين أو الفرق المعنيين. */
  names: string[];
  departmentName: string;
  /** أيام مفتوحة، أو كم أخذت لين انقفلت. */
  age: number;
  overdue: boolean;
};

export type KindCount = { open: number; closed: number };
export type TechnicianFindings = { technician: Technician; departmentName: string; observation: KindCount; violation: KindCount };

export type FindingsDetail = {
  byTechnician: TechnicianFindings[];
  /** الباقية: المتأخر أولًا ثم الأقدم. */
  open: FindingRow[];
  /** المقفلة: الأحدث إغلاقًا أولًا. */
  closed: FindingRow[];
  /** ملاحظات ومخالفات ما انربطت بفني. */
  unlinked: number;
};

/** الملاحظات والمخالفات المسجلة في الفترة، مع أسماء الفنيين، وفلتر القسم (قسم الملاحظة أو قسم أحد فنييها). */
export function findingsDetail(ws: Workspace, today: string, range?: { start: string; end: string }, departmentId: string | 'all' = 'all'): FindingsDetail {
  const byId = new Map(ws.technicians.map((tech) => [tech.id, tech]));
  const deptName = (id?: string) => ws.departments.find((item) => item.id === id)?.name ?? '';
  const list = (ws.findings ?? []).filter((item) => {
    if (range && (item.date < range.start || item.date >= range.end)) return false;
    if (departmentId === 'all') return true;
    return item.departmentId === departmentId || (item.technicianIds ?? []).some((id) => byId.get(id)?.departmentId === departmentId);
  });
  const row = (finding: Finding): FindingRow => {
    const people = (finding.technicianIds ?? []).map((id) => byId.get(id)).filter((tech): tech is Technician => !!tech);
    return {
      finding,
      names: people.map((tech) => tech.name),
      departmentName: deptName(finding.departmentId) || [...new Set(people.map((tech) => deptName(tech.departmentId)))].filter(Boolean).join('، '),
      age: findingAge(finding, today),
      overdue: isOverdue(finding, today),
    };
  };
  const rows = list.map(row);
  const people = new Map<string, TechnicianFindings>();
  for (const finding of list) {
    for (const id of new Set(finding.technicianIds ?? [])) {
      const tech = byId.get(id);
      if (!tech || (departmentId !== 'all' && tech.departmentId !== departmentId)) continue;
      const entry = people.get(id) ?? { technician: tech, departmentName: deptName(tech.departmentId), observation: { open: 0, closed: 0 }, violation: { open: 0, closed: 0 } };
      entry[finding.kind][finding.status === 'closed' ? 'closed' : 'open']++;
      people.set(id, entry);
    }
  }
  const openOf = (entry: TechnicianFindings) => entry.observation.open + entry.violation.open;
  const totalOf = (entry: TechnicianFindings) => openOf(entry) + entry.observation.closed + entry.violation.closed;
  return {
    byTechnician: [...people.values()].sort(
      (a, b) => openOf(b) - openOf(a) || totalOf(b) - totalOf(a) || a.technician.name.localeCompare(b.technician.name, 'ar'),
    ),
    open: rows
      .filter((item) => item.finding.status !== 'closed')
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.age - a.age),
    closed: rows
      .filter((item) => item.finding.status === 'closed')
      .sort((a, b) => (b.finding.closedAt ?? '').localeCompare(a.finding.closedAt ?? '')),
    unlinked: list.filter((item) => !(item.technicianIds ?? []).length).length,
  };
}
