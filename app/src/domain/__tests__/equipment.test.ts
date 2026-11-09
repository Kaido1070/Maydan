import { deleteEquipment, equipmentOf, orphanPhotos, saveEquipment } from '../equipment';
import { emptyWorkspace } from '../seed';

const photo = (id: string) => ({ id, uri: 'file:///photos/' + id + '.jpg', takenAt: '2026-11-09T10:00:00Z' });

describe('معدات التوزيع', () => {
  test('إضافة سجل بصور قبل وبعد، ثم تعديله بدون تكرار', () => {
    const ws = emptyWorkspace('2026-11-09');
    const first = saveEquipment(ws, { name: ' محول 12 ', location: 'حي الروضة', notes: '', date: '2026-11-09', before: [photo('b1')], after: [] }, undefined, 'T1');
    expect(first.record).toMatchObject({ name: 'محول 12', before: [photo('b1')], after: [] });
    const second = saveEquipment(first.ws, { ...first.record, after: [photo('a1'), photo('a2')] }, first.record.id, 'T2');
    expect(second.ws.equipment).toHaveLength(1);
    expect(second.record).toMatchObject({ createdAt: 'T1', updatedAt: 'T2' });
    expect(second.record.after).toHaveLength(2);
  });

  test('لازم اسم وصورة واحدة على الأقل', () => {
    const ws = emptyWorkspace('2026-11-09');
    expect(() => saveEquipment(ws, { name: '', location: '', notes: '', date: '2026-11-09', before: [photo('x')], after: [] })).toThrow('اسم');
    expect(() => saveEquipment(ws, { name: 'لوحة', location: '', notes: '', date: '2026-11-09', before: [], after: [] })).toThrow('صورة');
  });

  test('الأحدث أولًا، والحذف يحدد الصور اللي تنحذف ملفاتها', () => {
    let ws = emptyWorkspace('2026-11-09');
    ws = saveEquipment(ws, { name: 'قديم', location: '', notes: '', date: '2026-11-01', before: [photo('o')], after: [] }).ws;
    const latest = saveEquipment(ws, { name: 'جديد', location: '', notes: '', date: '2026-11-09', before: [photo('n1')], after: [photo('n2')] });
    ws = latest.ws;
    expect(equipmentOf(ws).map((e) => e.name)).toEqual(['جديد', 'قديم']);
    const after = deleteEquipment(ws, latest.record.id);
    expect(orphanPhotos(ws, after).map((p) => p.id)).toEqual(['n1', 'n2']);
    expect(equipmentOf(emptyWorkspace('2026-11-09'))).toEqual([]); // بيانات قديمة بدون equipment
  });
});
