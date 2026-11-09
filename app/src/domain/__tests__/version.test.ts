import appJson from '../../../app.json';
import { APP_VERSION, CHANGELOG, releasesSince } from '../../version';

describe('الإصدار وسجل التحديثات', () => {
  test('رقم الإصدار في app.json يطابق أحدث إصدار في السجل', () => {
    expect(appJson.expo.version).toBe(APP_VERSION);
  });

  test('السجل مرتب من الأحدث، والأرقام بصيغة x.y.z وغير مكررة', () => {
    const parse = (v: string) => v.split('.').map(Number);
    for (const release of CHANGELOG) {
      expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(release.changes.length).toBeGreaterThan(0);
    }
    for (let i = 1; i < CHANGELOG.length; i++) {
      const [a, b] = [parse(CHANGELOG[i - 1].version), parse(CHANGELOG[i].version)];
      const newer = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
      expect(newer).toBeGreaterThan(0);
    }
  });

  test('«الجديد» يعرض الإصدارات اللي بعد آخر إصدار شافه المستخدم', () => {
    expect(releasesSince(APP_VERSION)).toEqual([]);
    expect(releasesSince(CHANGELOG[CHANGELOG.length - 1].version)).toHaveLength(CHANGELOG.length - 1);
    expect(releasesSince(null)).toEqual([CHANGELOG[0]]);
    expect(releasesSince('0.0.1')).toEqual([CHANGELOG[0]]);
  });
});
