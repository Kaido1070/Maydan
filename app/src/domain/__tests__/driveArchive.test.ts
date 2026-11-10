import { monthPath, recordHtml, recordName, workRecords } from '../../drive/archive';
import { emptyWorkspace } from '../seed';

test('uses the work date and local time, safely renders details, and keeps visit photos attached', () => {
  const ws = emptyWorkspace('2026-11-10');
  const photo = { id: 'before', uri: 'maydan-photos/photo.jpg', takenAt: '2026-11-10T05:54:00Z' };
  const visit = { id: 'visit', departmentId: 'f', date: '2026-11-10', time: '08:54', location: 'الدرب / الشقيق', site: '<script>وصف</script>', technicianIds: [], before: [photo], createdAt: photo.takenAt, updatedAt: photo.takenAt };
  const [record] = workRecords({ ...ws, visits: [visit, { ...visit, id: 'example', seed: true }] });
  expect(workRecords({ ...ws, visits: [visit, { ...visit, id: 'example', seed: true }] })).toHaveLength(1);
  expect(monthPath(record.date)).toEqual({ year: '2026', month: '11', label: '11 - نوفمبر' });
  expect(recordName(record)).toBe('2026-11-10_08-54 - زيارة - الدرب الشقيق');
  expect(record.attachments).toEqual([{ photo, group: 'قبل' }]);
  expect(recordHtml(record)).toContain('&lt;script&gt;وصف&lt;/script&gt;');
  expect(recordHtml(record)).not.toContain('<script>');
});

test('omits the time when older meeting attendance has no time', () => {
  const ws = emptyWorkspace('2026-11-10');
  ws.attendance = [{ id: 'meeting', meetingId: 'unknown', departmentId: 'f', date: '2026-11-10', technicianIds: [], updatedAt: '2026-11-10T06:00:00Z' }];
  expect(recordName(workRecords(ws)[0])).toBe('2026-11-10 - اجتماع - سجل حضور');
});
