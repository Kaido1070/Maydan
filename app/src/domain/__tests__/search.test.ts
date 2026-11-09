import { emptyWorkspace } from '../seed';
import { searchTechnicians } from '../stats';

test('البحث بالرقم الوظيفي أو بجزء من الاسم (يتسامح في الهمزات)', () => {
  const ws = emptyWorkspace('2026-11-09');
  ws.technicians = [
    { id: 'a', name: 'أحمد عيسى', employeeNumber: '1101', departmentId: 'c', baseShiftId: 'c-A' },
    { id: 'b', name: 'عبدالله أحمد', employeeNumber: '1102', departmentId: 'c', baseShiftId: 'c-A' },
    { id: 'p', name: 'مشروع شبكة', employeeNumber: '', kind: 'project', contractor: 'مؤسسة البناء', departmentId: 'e', baseShiftId: 'e-A' },
  ];
  expect(searchTechnicians(ws, '1101').map((t) => t.id)).toEqual(['a']);
  expect(searchTechnicians(ws, 'احمد').map((t) => t.id).sort()).toEqual(['a', 'b']);
  expect(searchTechnicians(ws, 'البناء').map((t) => t.id)).toEqual(['p']);
  expect(searchTechnicians(ws, ' ')).toEqual([]);
});
