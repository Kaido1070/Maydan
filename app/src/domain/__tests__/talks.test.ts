import { saveFinding } from '../findings';
import { addMeeting } from '../records';
import { emptyWorkspace } from '../seed';
import { suggestTalks, TALKS, talkText } from '../talks';

describe('اقتراح مواضيع الاجتماعات', () => {
  test('كل موضوع فيه نقاط مختصرة وسؤال، والمعرفات ما تتكرر', () => {
    expect(new Set(TALKS.map((t) => t.id)).size).toBe(TALKS.length);
    for (const talk of TALKS) {
      expect(talk.points.length).toBeGreaterThanOrEqual(3);
      expect(talk.points.length).toBeLessThanOrEqual(4);
      expect(talk.question.endsWith('؟')).toBe(true);
    }
  });

  test('المرتبط بالملاحظات المفتوحة أولًا، والمقال هالسنة ينزل، والحر في الصيف', () => {
    let ws = emptyWorkspace('2026-11-09');
    ws = saveFinding(ws, { kind: 'observation', title: 'حفرية بدون حواجز', description: '', location: '', responsible: '', date: '2026-11-08', photos: [] }).ws;
    const winter = suggestTalks(ws, '2026-11-09');
    expect(winter[0].talk.id).toBe('excavation');
    expect(winter[0].reasons[0]).toBe('مرتبط بـ 1 ملاحظة مفتوحة');
    ws = addMeeting(ws, 'الحفريات والكابلات المدفونة', 2026).ws;
    const after = suggestTalks(ws, '2026-11-09');
    expect(after[0].talk.id).not.toBe('excavation');
    expect(after.find((s) => s.talk.id === 'excavation')!.used).toBe(true);
    expect(suggestTalks(emptyWorkspace('2026-07-01'), '2026-07-01')[0].talk.id).toBe('heat');
  });

  test('نص المشاركة فيه العنوان والنقاط والسؤال', () => {
    const text = talkText(TALKS[0]);
    expect(text.split('\n')[0]).toBe('🦺 العزل والتأريض قبل العمل');
    expect(text).toContain('• ');
    expect(text).toContain('❓ ');
  });
});
