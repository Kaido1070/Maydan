import { previewTechnicianImport, applyTechnicianImport } from '../importer';
import { demoWorkspace, emptyWorkspace } from '../seed';
import { techTag } from '../shifts';
import { dailyTasks } from '../daily';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { migrate } = require('../../store');

describe('الإنشاءات = مشاريع', () => {
  test('النوع الفاضي في الإنشاءات يصير مشروع، وفي باقي الأقسام فني', () => {
    const ws = emptyWorkspace('2026-11-09');
    const preview = previewTechnicianImport(ws, [
      ['الاسم', 'النوع', 'الرقم الوظيفي', 'المقاول', 'القسم'],
      ['مشروع شبكة اختبار', '', 'P-1', 'مقاول', 'الإنشاءات'],
      ['مشروع بدون رقم', '', '', '', 'الإنشاءات'],
      ['فني', '', '77', '', 'مساح'],
      ['فريق في الإنشاءات', 'فريق', '', 'مقاول', 'الإنشاءات'],
    ]);
    expect(preview.errors).toBe(0);
    expect(preview.rows.map((r) => r.kind)).toEqual(['project', 'project', 'person', 'team']);
    const next = applyTechnicianImport(ws, preview);
    const project = next.technicians.find((t) => t.name === 'مشروع شبكة اختبار')!;
    expect(techTag(project)).toBe('مشروع · مقاول مقاول · رقم P-1');
  });

  test('بيانات التجربة: مشاريع الإنشاءات تطلع في تذكيرات اليوم بأسماء مشاريع', () => {
    const ws = demoWorkspace('2026-11-09');
    const e = ws.technicians.filter((t) => t.departmentId === 'e');
    expect(e.every((t) => t.kind === 'project' && t.name.startsWith('مشروع'))).toBe(true);
    const tasks = dailyTasks(ws, { date: '2026-11-09', time: '10:00' }).filter((t) => t.department.id === 'e');
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.technician.name.startsWith('مشروع'))).toBe(true);
  });

  test('ترقية البيانات القديمة: نوع قسم الإنشاءات في بيانات العمل، وتجديد بيانات التجربة', () => {
    const old = (ws: ReturnType<typeof emptyWorkspace>) => ({ ...ws, departments: ws.departments.map(({ entryKind, ...d }) => d) });
    const live = old(emptyWorkspace('2026-11-09'));
    live.technicians = [{ id: 'x', name: 'فني حقيقي', employeeNumber: '5', departmentId: 'e', baseShiftId: 'e-A' }];
    const state = migrate({ version: 1, mode: 'live', demo: old(demoWorkspace('2026-11-09')), live });
    expect(state.live.departments.find((d: { id: string }) => d.id === 'e').entryKind).toBe('project');
    expect(state.live.technicians).toEqual(live.technicians); // بيانات العمل ما تتغير
    expect(state.demo.technicians.find((t: { id: string }) => t.id === 'e1').kind).toBe('project');
  });
});
