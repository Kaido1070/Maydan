import { dailyTasks } from '../daily';
import { applyTechnicianImport, previewTechnicianImport } from '../importer';
import { addMeeting } from '../records';
import { buildReport } from '../reports';
import { emptyWorkspace } from '../seed';
import { coverageOf, meetingRemaining, techProgress } from '../stats';
import { visitPlan, PlannedVisit } from '../visitPlan';

const NOW = { date: '2026-11-09', time: '09:00' };

function fixture() {
  let ws = emptyWorkspace('2026-11-09');
  ws.technicians = [
    { id: 'f', name: 'ميداني', employeeNumber: '1', departmentId: 'c', baseShiftId: 'c-A' },
    { id: 'o', name: 'مكتبي', employeeNumber: '2', departmentId: 'c', baseShiftId: 'c-A', workplace: 'office' },
  ];
  ws = addMeeting(ws, 'اجتماع السلامة', 2026).ws;
  return ws;
}

describe('الموظف المكتبي: اجتماعات بدون زيارات', () => {
  test('ما عليه هدف زيارات، وعليه الاجتماعات', () => {
    const ws = fixture();
    const office = techProgress(ws, ws.technicians[1], NOW.date);
    expect(office).toMatchObject({ field: false, visitRemaining: 0, meetingRemaining: 1 });
    const { coverage, pending } = coverageOf(ws, ws.technicians, NOW.date);
    expect(coverage).toMatchObject({ people: 2, fieldPeople: 1, visitRemaining: 2, visitComplete: 0, attendanceRemaining: 2 });
    expect(pending.map((p) => p.technician.id)).toEqual(['f', 'o']);
  });

  test('تذكير الاجتماع له بدون تذكير زيارة، وخطة الزيارات ما تشمله لكن الاجتماع المقترح يشمله', () => {
    const ws = fixture();
    const keys = dailyTasks(ws, NOW).map((t) => t.kind + ':' + t.technician.id);
    expect(keys).toEqual(expect.arrayContaining(['visit:f', 'meeting:f', 'meeting:o']));
    expect(keys).not.toContain('visit:o');
    const crew = visitPlan(ws, NOW)[0].visits.find((v): v is PlannedVisit => v.kind === 'crew')!;
    expect(crew.technicians.map((t) => t.id)).toEqual(['f']);
    expect(crew.meeting!.people.map((t) => t.id).sort()).toEqual(['f', 'o']);
    expect(meetingRemaining(ws, ws.meetings[0].id).remaining).toHaveLength(2);
  });

  test('التقرير: توزيع الزيارات للميدانيين فقط', () => {
    const report = buildReport(fixture(), { mode: 'month', year: 2026, month: 10, quarter: 3, departmentId: 'all' }, NOW.date);
    expect(report.statusMix.visits).toEqual({ none: 1, partial: 0, complete: 0 });
    expect(report.statusMix.meetings).toEqual({ none: 2, partial: 0, complete: 0 });
  });

  test('استيراد Excel بعمود طبيعة العمل', () => {
    const ws = emptyWorkspace('2026-11-09');
    const preview = previewTechnicianImport(ws, [
      ['الاسم', 'الرقم الوظيفي', 'القسم', 'طبيعة العمل'],
      ['موظف مكتب', 77, 'التشغيل', 'مكتبي'],
      ['فني', 78, 'التشغيل', ''],
    ]);
    expect(preview).toMatchObject({ added: 2, errors: 0 });
    const next = applyTechnicianImport(ws, preview);
    expect(next.technicians.map((t) => t.workplace)).toEqual(['office', undefined]);
  });
});
