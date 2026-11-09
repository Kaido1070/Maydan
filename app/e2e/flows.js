/*
 * اختبار تدفقات الواجهة على نسخة الويب بمقاس آيفون:
 *   npx expo export -p web && npx serve -s dist -l 8089 &  ثم  node e2e/flows.js
 */
const { chromium, devices } = require('playwright');
const assert = require('assert');
const URL = process.env.MAYDAN_URL || 'http://localhost:8089';
const OUT = process.env.SHOTS || null;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 14'], deviceScaleFactor: 1, viewport: { width: 390, height: 2600 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // الإثنين 9 نوفمبر 2026 الساعة 10:00 بتوقيت السعودية → طوارئ أ في الشفت الصباحي
  await page.clock.setFixedTime(new Date('2026-11-09T07:00:00Z'));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid="tab-day"]');
  const id = (testId) => page.locator(`[data-testid="${testId}"]`);

  // نافذة «الجديد» تظهر أول مرة، ثم ما تظهر بعد إعادة التحميل
  const version = require('../changelog.json')[0].version;
  await page.waitForSelector('text=الجديد في هذا التحديث');
  assert((await page.locator('body').innerText()).includes(version), 'رقم الإصدار في نافذة الجديد');
  await id('whats-new-ok').click();
  await page.reload();
  await page.waitForSelector('[data-testid="tab-day"]');
  await page.waitForTimeout(500);
  assert(!(await page.locator('body').innerText()).includes('الجديد في هذا التحديث'), 'النافذة ما تتكرر');
  await id('open-settings').click();
  assert((await id('app-version').innerText()).includes(version), 'رقم الإصدار في الإعدادات');
  await id('open-changelog').click();
  const log = await page.locator('body').innerText();
  for (const release of require('../changelog.json')) assert(log.includes(release.title), 'سجل التحديثات: ' + release.version);
  await id('sheet-close').click();
  const shot = async (name) => OUT && page.screenshot({ path: `${OUT}/${name}.png` });
  const text = async (testId) => (await id(testId).innerText()).replace(/\s+/g, ' ');
  const kpi = async (testId) => Number((await text(testId)).match(/\d+/)[0]);

  // التقرير قبل التسجيل
  await id('tab-reports').click();
  const visitsBefore = await kpi('kpi-visits');
  const meetingsBefore = await kpi('kpi-meetings');

  // 1) زيارتان لنفس القسم في نفس اليوم
  await id('tab-visits').click();
  await id('dept-b').click();
  for (const [site, people] of [['موقع الاختبار الأول', ['b1', 'b2', 'b3']], ['موقع الاختبار الثاني', ['b1']]]) {
    await id('add-visit').click();
    await id('visit-site').fill(site);
    for (const p of people) await id('visit-tech-' + p).click();
    await shot('visit-sheet');
    await id('visit-save').click();
    await page.waitForTimeout(150);
  }
  let body = await page.locator('body').innerText();
  assert(body.includes('موقع الاختبار الأول') && body.includes('موقع الاختبار الثاني'), 'الزيارتان تظهران في السجل');
  assert(/\d+ زيارة مسجلة · 2 اليوم/.test(body), 'عداد زيارات اليوم = 2');
  await shot('visits');

  // تعديل الزيارة الثانية بشكل مستقل
  const editButtons = page.locator('[data-testid^="edit-visit-v-"]');
  assert.strictEqual(await editButtons.count(), 2, 'سجلان مستقلان');
  await editButtons.first().click(); // الأحدث أولًا = الثانية
  await id('visit-site').fill('موقع الاختبار الثاني - معدل');
  await id('visit-save').click();
  body = await page.locator('body').innerText();
  assert(body.includes('موقع الاختبار الثاني - معدل') && body.includes('موقع الاختبار الأول'), 'التعديل لم يمس الزيارة الأولى');

  // 2) حضور أكثر من اجتماع دفعة واحدة
  await id('tab-meetings').click();
  await id('meeting-title-input').fill('مراجعة خطة الطوارئ');
  await id('meeting-title-add').click();
  await id('dept-b').click();
  const newMeeting = (await page.locator('[data-testid^="pick-meeting-m-"]').getAttribute('data-testid')).replace('pick-meeting-', '');
  for (const [meeting, tech] of [['demo-m2', 'b1'], [newMeeting, 'b1'], [newMeeting, 'b2']]) await id(`att-${meeting}-${tech}`).click();
  await shot('meetings');
  await id('attendance-save').click();
  body = await page.locator('body').innerText();
  assert(body.includes('تم حفظ حضور 2 اجتماع'), 'حفظ دفعة واحدة لاجتماعين');
  assert(body.includes('مراجعة خطة الطوارئ\n2 حاضر') || /مراجعة خطة الطوارئ[\s\S]{0,40}2 حاضر/.test(body), 'سجل الحضور يظهر');

  // حضور اجتماع بتاريخ أمس ووقت محدد
  await page.getByRole('button', { name: 'السابق' }).first().click();
  await id('meeting-time').fill('13:45');
  // يوم 8 نوفمبر الصباحي = طوارئ ب، فالقائمة تتبع شفت ذاك اليوم
  assert(!(await id('att-demo-m2-b2').count()), 'فنيو طوارئ أ ما يظهرون في شفت أمس');
  await page.locator('[data-testid^="att-demo-m2-b"]').first().click();
  await id('attendance-save').click();
  body = await page.locator('body').innerText();
  assert(/الأحد 8 نوفمبر 2026 · 13:45/.test(body), 'سجل الحضور فيه التاريخ والوقت المحددين');

  // 3) نقل فني بين الشفتات
  await id('tab-day').click();
  await id('open-roster').click();
  await page.getByText('الشفت الأساسي للفنيين').click();
  await id('roster-move-b11').click();
  await page.getByRole('button', { name: 'طوارئ ب' }).first().click();
  await id('move-save').click();
  await id('sheet-close').click();
  await page.getByText('توزيع اليوم').click();
  const morning = await page.locator('text=طوارئ · صباحي').locator('xpath=ancestor::div[3]').innerText();
  assert(!morning.includes('وليد علي'), 'وليد علي لم يعد في شفت طوارئ أ');
  await shot('roster');
  await id('tab-visits').click();
  await id('dept-b').click();
  await page.getByText('كل فنيي القسم').click();
  body = await page.locator('body').innerText();
  assert(/وليد علي[\s\S]{0,40}طوارئ ب/.test(body), 'الشفت الأساسي الجديد يظهر بجانب الاسم');
  assert(/حسن يحيى[\s\S]{0,40}طوارئ أ/.test(body), 'الشفت الأساسي يظهر بجانب الاسم');

  // 4) أرقام التقرير
  await id('tab-reports').click();
  assert.strictEqual(await kpi('kpi-visits'), visitsBefore + 2, 'الزيارة الجماعية تُحسب مرة: +2 زيارة');
  for (const chart of ['chart-period', 'chart-visit-status', 'chart-dept-visits']) assert(await id(chart).isVisible(), 'الرسم البياني ظاهر: ' + chart);
  assert((await id('chart-visit-status').innerText()).includes('بدون زيارة'), 'الرسم فيه تسميات الحالة');
  assert.strictEqual(await kpi('kpi-meetings'), meetingsBefore + 3, '+3 تسجيلات اجتماع (اجتماعان اليوم وواحد أمس)');
  await id('employee-search').fill('١٢٠١');
  await id('employee-search-go').click();
  body = await page.locator('body').innerText();
  assert(body.includes('حسن يحيى') && body.includes('الرقم الوظيفي 1201'), 'البحث بالرقم الوظيفي (بأرقام عربية)');
  await shot('reports');

  // الحفظ بعد إعادة التحميل
  await page.reload();
  await id('tab-visits').click();
  await id('dept-b').click();
  assert((await page.locator('body').innerText()).includes('موقع الاختبار الأول'), 'البيانات محفوظة بعد إعادة التشغيل');

  // بطاقة اليوم: التقدم والسلسلة والمهمة التالية
  await id('tab-day').click();
  assert(/\d+ \/ \d+/.test(await id('hero-progress').innerText()), 'تقدم مهام اليوم ظاهر');
  assert((await id('hero-streak').innerText()).includes('🔥'), 'سلسلة الإنجاز ظاهرة');
  assert(await id('next-task').isVisible(), 'المهمة التالية ظاهرة');

  // مهام اليوم: تذكير زيارة → تفاصيل الفني → تسجيل زيارة له → تصير منجزة
  await id('tab-day').click();
  const dailyTask = page.locator('[data-testid^="daily-visit-"]').first();
  const techId = (await dailyTask.getAttribute('data-testid')).replace('daily-visit-', '');
  assert((await id('next-task').innerText()).includes('ما نزلت عليه زيارة'), 'سبب المهمة ظاهر في المهمة التالية');
  await dailyTask.click();
  await page.waitForSelector('text=الزيارات · آخر 6 أشهر');
  await id('person-visit').click();
  assert(await id('visit-tech-' + techId).getAttribute('aria-checked') === 'true', 'الفني محدد مسبقًا في الزيارة');
  await id('visit-site').fill('زيارة من مهام اليوم');
  await id('visit-save').click();
  await page.waitForTimeout(200);
  assert((await page.locator('body').innerText()).includes('انسجلت له زيارة اليوم'), 'المهمة صارت منجزة');

  // وضع العمل منفصل عن وضع التجربة
  await id('open-settings').click();
  await page.getByText('بيانات العمل').first().click();
  await id('tab-visits').click();
  await id('dept-b').click();
  assert(!(await page.locator('body').innerText()).includes('موقع الاختبار الأول'), 'وضع العمل لا يرى بيانات التجربة');

  assert.deepStrictEqual(errors, []);
  console.log('✓ كل تدفقات الواجهة نجحت');
  await browser.close();
})().catch((error) => {
  console.error('✗', error.message);
  process.exit(1);
});
