/*
 * اختبار المتابعة (الملاحظات، خارج الدوام) وفحص إن ما فيه نص طالع برا الشاشة:
 *   npx expo export -p web && npx serve -s dist -l 8089 &  ثم  node e2e/follow.js
 */
const { chromium, devices } = require('playwright');
const assert = require('assert');
const URL = process.env.MAYDAN_URL || 'http://localhost:8089';

/** عناصر تطلع برا عرض الشاشة (بدون الصفوف القابلة للسحب أفقيًا). */
async function overflow(page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scrollers = [...document.querySelectorAll('div')].filter((el) => {
      const style = getComputedStyle(el);
      return (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
    });
    const bad = [];
    for (const el of document.querySelectorAll('div[dir="auto"], button, input')) {
      if (scrollers.some((s) => s.contains(el))) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.left < -1 || r.right > width + 1) bad.push((el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40));
    }
    return [...new Set(bad)].slice(0, 10);
  });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // 1) المتابعة: ملاحظة → سبب تأخير → إغلاق، وتسجيل خارج الدوام
  {
    const context = await browser.newContext({ ...devices['iPhone 14'], deviceScaleFactor: 1, viewport: { width: 390, height: 1800 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    // الإثنين الساعة 18:00 بتوقيت السعودية = خارج الدوام
    await page.clock.setFixedTime(new Date('2026-11-09T15:00:00Z'));
    await page.goto(URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const id = (t) => page.locator(`[data-testid="${t}"]`);
    await id('whats-new-ok').click();

    assert(await id('outside-hours').isVisible(), 'تنبيه خارج الدوام يظهر الساعة 6 مساءً');
    await id('log-overtime').click();
    await id('overtime-start').fill('17:30');
    await id('overtime-end').fill('19:00');
    await id('overtime-reason').fill('بلاغ طوارئ');
    await id('overtime-save').click();
    await page.waitForTimeout(200);

    await id('tab-follow').click();
    await id('add-observation').click();
    await id('finding-title').fill('غطاء غرفة تفتيش مفتوح');
    await page.getByText('3 أيام', { exact: true }).click();
    await id('finding-save').click();
    await page.waitForTimeout(200);
    let body = await page.locator('body').innerText();
    assert(body.includes('غطاء غرفة تفتيش مفتوح') && body.includes('انسجلت اليوم'), 'الملاحظة ظاهرة مع عمرها');

    await page.locator('[data-testid^="finding-f-"]').first().click();
    await page.getByText('سبب تأخير', { exact: true }).click();
    await id('finding-update-text').fill('بانتظار المقاول');
    await id('finding-add-update').click();
    await id('sheet-close').click();
    body = await page.locator('body').innerText();
    assert(body.includes('سبب التأخير: بانتظار المقاول') && body.includes('قيد المعالجة'), 'سبب التأخير يظهر في البطاقة');

    await page.locator('[data-testid^="finding-f-"]').first().click();
    await id('finding-close').click();
    await page.waitForTimeout(200);
    body = await page.locator('body').innerText();
    assert(body.includes('المقفلة · 1') && body.includes('المفتوحة · 0'), 'الملاحظة انقفلت');

    await page.getByText('خارج الدوام', { exact: true }).first().click();
    body = await page.locator('body').innerText();
    assert(body.includes('بلاغ طوارئ') && body.includes('ساعة و30 دقيقة'), 'تسجيل خارج الدوام مع المدة');

    await id('tab-reports').click();
    assert((await id('report-follow').innerText()).includes('ملاحظات'), 'التقرير فيه الملاحظات وخارج الدوام');
    await context.close();
  }

  // 2) ما فيه شي طالع برا الشاشة على أصغر آيفون (320 نقطة)
  for (const width of [320, 390]) {
    const context = await browser.newContext({ ...devices['iPhone SE'], viewport: { width, height: 2400 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-11-09T07:00:00Z'));
    await page.goto(URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const id = (t) => page.locator(`[data-testid="${t}"]`);
    await id('whats-new-ok').click();
    const screens = [
      ['اليوم', async () => id('tab-day').click()],
      ['الزيارات', async () => (await id('tab-visits').click(), await id('dept-b').click())],
      ['الاجتماعات', async () => (await id('tab-meetings').click(), await id('dept-b').click())],
      ['المتابعة', async () => id('tab-follow').click()],
      ['التقارير', async () => id('tab-reports').click()],
      ['الإعدادات', async () => id('open-settings').click()],
      ['الشفتات', async () => (await id('tab-day').click(), await id('open-roster').click())],
    ];
    for (const [name, open] of screens) {
      await open();
      await page.waitForTimeout(150);
      const bad = await overflow(page);
      assert.deepStrictEqual(bad, [], `عرض ${width}: عناصر طالعة برا الشاشة في ${name}: ${bad.join(' | ')}`);
    }
    const sheets = [
      ['نافذة الزيارة', async () => (await id('tab-visits').click(), await id('add-visit').click())],
      ['نافذة الملاحظة', async () => (await id('tab-follow').click(), await id('add-observation').click())],
      ['تفاصيل الفني', async () => (await id('tab-day').click(), await page.locator('[data-testid^="daily-"]').first().click())],
      ['خارج الدوام', async () => (await id('tab-follow').click(), await page.getByText('خارج الدوام', { exact: true }).first().click(), await id('add-overtime').click())],
    ];
    for (const [name, open] of sheets) {
      await open();
      await page.waitForTimeout(200);
      const bad = await overflow(page);
      assert.deepStrictEqual(bad, [], `عرض ${width}: عناصر طالعة برا الشاشة في ${name}: ${bad.join(' | ')}`);
      await id('sheet-close').click();
      await page.waitForTimeout(100);
    }
    await context.close();
  }

  assert.deepStrictEqual(errors, []);
  console.log('✓ المتابعة وخارج الدوام وفحص حدود الشاشة نجحوا');
  await browser.close();
})().catch((error) => {
  console.error('✗', error.message);
  process.exit(1);
});
