import { addFindingUpdate, findingsDetail, saveFinding } from '../findings';
import { buildReport, reportCsv, reportHtml } from '../reports';
import { emptyWorkspace } from '../seed';
import type { Workspace } from '../types';

const TODAY = '2026-11-12';
const base = { kind: 'observation' as const, description: '', location: 'موقع', responsible: '', photos: [] };

function withPeople(): Workspace {
  const ws = emptyWorkspace('2026-11-01');
  const [a, b] = ws.departments;
  return {
    ...ws,
    technicians: [
      { id: 't1', name: 'أحمد', employeeNumber: '101', departmentId: a.id, baseShiftId: a.shifts[0].id },
      { id: 't2', name: 'سالم', employeeNumber: '102', departmentId: b.id, baseShiftId: b.shifts[0].id },
    ],
  };
}

describe('الملاحظات والمخالفات بالأسماء', () => {
  test('حسب الفني، والمقفلة والباقية، وفلتر القسم والفترة', () => {
    let ws = withPeople();
    const [a, b] = ws.departments;
    ws = saveFinding(ws, { ...base, title: 'خوذة', date: '2026-11-03', technicianIds: ['t1', 't2', 't1'] }).ws;
    const v = saveFinding(ws, { ...base, kind: 'violation', title: 'بدون عزل', date: '2026-11-04', dueDate: '2026-11-06', technicianIds: ['t1'] });
    ws = v.ws;
    const c = saveFinding(ws, { ...base, title: 'لوحة', date: '2026-11-05', technicianIds: ['t2'] });
    ws = addFindingUpdate(c.ws, c.finding.id, { date: '2026-11-09', kind: 'close', text: '' });
    ws = saveFinding(ws, { ...base, title: 'بدون فني', date: '2026-11-06' }).ws;
    ws = saveFinding(ws, { ...base, title: 'شهر سابق', date: '2026-10-20', technicianIds: ['t1'] }).ws;

    expect(ws.findings![0].technicianIds).toEqual(['t1', 't2']);
    const range = { start: '2026-11-01', end: '2026-12-01' };
    const all = findingsDetail(ws, TODAY, range);
    expect(all.byTechnician.map((row) => [row.technician.name, row.observation, row.violation])).toEqual([
      ['أحمد', { open: 1, closed: 0 }, { open: 1, closed: 0 }],
      ['سالم', { open: 1, closed: 1 }, { open: 0, closed: 0 }],
    ]);
    expect(all.open.map((row) => row.finding.title)).toEqual(['بدون عزل', 'خوذة', 'بدون فني']);
    expect(all.open[0]).toMatchObject({ overdue: true, names: ['أحمد'], age: 8 });
    expect(all.closed.map((row) => [row.finding.title, row.age])).toEqual([['لوحة', 4]]);
    expect(all.unlinked).toBe(1);

    const onlyB = findingsDetail(ws, TODAY, range, b.id);
    expect(onlyB.byTechnician.map((row) => row.technician.name)).toEqual(['سالم']);
    expect(onlyB.open.map((row) => row.finding.title)).toEqual(['خوذة']);
    expect(findingsDetail(ws, TODAY, range, a.id).closed).toEqual([]);
  });

  test('التقرير وملفات CSV وPDF فيها الأسماء', () => {
    let ws = withPeople();
    ws = saveFinding(ws, { ...base, kind: 'violation', title: 'بدون قفازات', date: '2026-11-03', technicianIds: ['t1'] }).ws;
    const report = buildReport(ws, { mode: 'month', year: 2026, month: 10, quarter: 3, departmentId: 'all' }, TODAY);
    expect(report.findingsDetail.open[0].names).toEqual(['أحمد']);
    const csv = reportCsv(report);
    expect(csv).toContain('الملاحظات والمخالفات حسب الفني');
    expect(csv).toContain('"بدون قفازات","أحمد"');
    expect(reportHtml(report, '')).toContain('الملاحظات والمخالفات الباقية (1)');
  });
});
