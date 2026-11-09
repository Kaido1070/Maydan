import { addVisit, updateVisit, visitDetails, visitTitle, workTypeSuggestions } from '../records';
import { emptyWorkspace } from '../seed';

const TODAY = '2026-11-09';
function ws0() {
  const ws = emptyWorkspace(TODAY);
  ws.technicians = [{ id: 't', name: 'فني', employeeNumber: '1', departmentId: 'b', baseShiftId: 'b-A' }];
  return ws;
}
const base = { departmentId: 'b', date: TODAY, time: '09:00', technicianIds: ['t'] };

describe('نوع المهمة والموقع ورقم المهمة في الزيارة', () => {
  test('تنحفظ منظفة، والعنوان نوع المهمة والتفاصيل الموقع والرقم', () => {
    const { ws, visit } = addVisit(ws0(), { ...base, workType: ' تمديد  كابلات ', location: 'حي الروضة', taskNumber: ' 4471 ', site: '' }, TODAY);
    expect(visit).toMatchObject({ workType: 'تمديد كابلات', location: 'حي الروضة', taskNumber: '4471', site: '' });
    expect(visitTitle(visit)).toBe('تمديد كابلات');
    expect(visitDetails(visit)).toBe('حي الروضة · رقم 4471');
    const edited = updateVisit(ws, visit.id, { ...base, workType: 'صيانة', location: 'حي النخيل', taskNumber: '', site: 'تم' }, TODAY).visits[0];
    expect(visitDetails(edited)).toBe('حي النخيل · تم');
    expect(edited.taskNumber).toBeUndefined();
  });

  test('لازم نوع المهمة أو الموقع، والزيارات القديمة تعرض الوصف', () => {
    expect(() => addVisit(ws0(), { ...base, site: '' }, TODAY)).toThrow('نوع المهمة أو الموقع');
    expect(addVisit(ws0(), { ...base, location: 'موقع', site: '' }, TODAY).visit.location).toBe('موقع');
    expect(visitTitle({ site: 'متابعة موقع قديم' })).toBe('متابعة موقع قديم');
  });

  test('الاقتراحات: آخر الأنواع المستخدمة أولًا ثم الافتراضية', () => {
    let ws = ws0();
    ws = addVisit(ws, { ...base, time: '08:00', workType: 'نوع خاص', site: '' }, TODAY).ws;
    const list = workTypeSuggestions(ws);
    expect(list[0]).toBe('نوع خاص');
    expect(list).toContain('صيانة');
    expect(new Set(list).size).toBe(list.length);
  });
});
