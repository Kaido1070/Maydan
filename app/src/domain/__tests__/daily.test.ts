import { dailyTasks, taskReason } from '../daily';
import { addMeeting, addVisit, saveAttendanceBatch } from '../records';
import { emptyWorkspace } from '../seed';
import type { Workspace } from '../types';

const NOW = { date: '2026-11-09', time: '10:00' }; // طوارئ أ صباحي، طوارئ د مسائي (من أمس)

function fixture(): Workspace {
  let ws = emptyWorkspace('2026-11-09');
  ws.technicians = [
    { id: 'a', name: 'بدون زيارة', employeeNumber: '1', departmentId: 'b', baseShiftId: 'b-A' },
    { id: 'b', name: 'زيارة وحدة', employeeNumber: '2', departmentId: 'b', baseShiftId: 'b-A' },
    { id: 'c', name: 'مكتمل', employeeNumber: '3', departmentId: 'b', baseShiftId: 'b-A' },
    { id: 'd', name: 'إجازة اليوم', employeeNumber: '4', departmentId: 'b', baseShiftId: 'b-C' },
    { id: 'e', name: 'فريق', employeeNumber: '', kind: 'team', departmentId: 'c', baseShiftId: 'c-A' },
  ];
  const meeting = addMeeting(ws, 'اجتماع', 2026);
  ws = meeting.ws;
  ws = addVisit(ws, { departmentId: 'b', date: '2026-10-01', time: '09:00', site: 'س', technicianIds: ['b', 'c'] }, NOW.date).ws;
  ws = addVisit(ws, { departmentId: 'b', date: '2026-10-05', time: '09:00', site: 'س', technicianIds: ['c'] }, NOW.date).ws;
  ws = saveAttendanceBatch(ws, { departmentId: 'b', date: '2026-10-01', entries: { [meeting.meeting.id]: ['c'] } }).ws;
  return ws;
}

describe('مهام اليوم التلقائية', () => {
  test('تذكير فقط لمن ما نزلت عليه زيارة أو ما حضر أي اجتماع، بدون من في إجازة', () => {
    const tasks = dailyTasks(fixture(), NOW);
    const keys = tasks.map((t) => t.kind + ':' + t.technician.id);
    expect(keys).toEqual(expect.arrayContaining(['visit:a', 'meeting:a', 'meeting:b', 'visit:e', 'meeting:e']));
    expect(keys).not.toContain('visit:b'); // عنده زيارة وحدة: ما يحتاج تذكير
    expect(keys).not.toContain('visit:c');
    expect(keys).not.toContain('meeting:c'); // حضر اجتماع
    expect(keys.some((k) => k.endsWith(':d'))).toBe(false); // طوارئ ج ما يداوم اليوم
    // الأولوية: على رأس العمل، الزيارات قبل الاجتماعات، الأقل زيارات أولًا
    expect(keys[0]).toBe('visit:a');
  });

  test('المهمة تصير منجزة لما تنسجل زيارة أو حضور اليوم', () => {
    let ws = fixture();
    ws = addVisit(ws, { departmentId: 'b', date: NOW.date, time: '09:30', site: 'اليوم', technicianIds: ['a'] }, NOW.date).ws;
    const tasks = dailyTasks(ws, NOW);
    const visitA = tasks.find((t) => t.kind === 'visit' && t.technician.id === 'a')!;
    expect(visitA.done).toBe(true);
    expect(tasks[tasks.length - 1].done).toBe(true); // المنجز في الآخر
    expect(taskReason(visitA, ws.settings)).toBe('انسجلت له زيارة اليوم');
    const visitE = tasks.find((t) => t.kind === 'visit' && t.technician.id === 'e')!;
    expect(taskReason(visitE, ws.settings)).toBe('ما نزلت عليه زيارة خلال 6 أشهر');
    expect(taskReason(tasks.find((t) => t.kind === 'meeting' && t.technician.id === 'a')!, ws.settings)).toBe('ما سويت معه اجتماع هالسنة');
  });

  test('شفت الليل الممتد من أمس يدخل في مهام الصباح الباكر', () => {
    const ws = fixture();
    // طوارئ ج (الفني d) مسائي ليلة 8 نوفمبر، وراحة يوم 9 نوفمبر
    const early = dailyTasks(ws, { date: '2026-11-09', time: '03:00' });
    expect(early.some((t) => t.technician.id === 'd' && t.onShiftNow)).toBe(true);
    // بعد انتهاء المسائي الساعة 7 ما يبقى ضمن مهام اليوم
    expect(dailyTasks(ws, NOW).some((t) => t.technician.id === 'd')).toBe(false);
  });
});
