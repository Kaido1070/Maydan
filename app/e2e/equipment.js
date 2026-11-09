/*
 * اختبار معدات التوزيع (صور قبل وبعد) وزر الشعار على نسخة الويب:
 *   npx expo export -p web && npx serve -s dist -l 8089 &  ثم  node e2e/equipment.js
 */
const { chromium, devices } = require('playwright');
const assert = require('assert');
const URL = process.env.MAYDAN_URL || 'http://localhost:8089';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 14'], deviceScaleFactor: 1, viewport: { width: 390, height: 1800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // صورة اختبار مولّدة
  const scratch = await (await browser.newPage()).screenshot({ type: 'png', clip: { x: 0, y: 0, width: 300, height: 200 } });

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const id = (t) => page.locator(`[data-testid="${t}"]`);
  await id('whats-new-ok').click();

  await id('tab-equipment').click();
  await id('add-equipment').click();
  await id('equipment-name').fill('محول اختبار 1');
  await id('equipment-location').fill('موقع اختبار');
  for (const side of ['before', 'after']) {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), id(side + '-library').click()]);
    await chooser.setFiles({ name: side + '.png', mimeType: 'image/png', buffer: scratch });
    await page.waitForFunction((s) => document.querySelectorAll('img').length >= (s === 'before' ? 1 : 2), side, { timeout: 15000 });
  }
  await id('equipment-save').click();
  await page.waitForTimeout(300);
  let body = await page.locator('body').innerText();
  assert(body.includes('محول اختبار 1') && body.includes('قبل 1') && body.includes('بعد 1'), 'المعدة محفوظة بصورة قبل وصورة بعد');

  // الحفظ بعد إعادة التحميل، والصور تظهر
  await page.reload();
  await id('tab-equipment').click();
  body = await page.locator('body').innerText();
  assert(body.includes('محول اختبار 1'), 'المعدة باقية بعد إعادة التشغيل');
  assert((await page.locator('img[src^="data:image/jpeg"]').count()) >= 2, 'الصور تظهر في البطاقة');

  // تعديل: حذف صورة البعد ثم الحفظ
  await page.locator('[data-testid^="equipment-eq-"]').first().click();
  await page.getByRole('button', { name: 'حذف الصورة' }).last().click();
  await id('equipment-save').click();
  await page.waitForTimeout(300);
  assert((await page.locator('body').innerText()).includes('بعد 0'), 'حذف صورة');

  // الشعار يرجع لمهام اليوم
  await id('tab-reports').click();
  await id('brand-home').click();
  assert((await page.locator('body').innerText()).includes('تحدي اليوم'), 'الشعار يرجع لصفحة اليوم');

  assert.deepStrictEqual(errors, []);
  console.log('✓ معدات التوزيع وزر الشعار نجحوا');
  await browser.close();
})().catch((error) => {
  console.error('✗', error.message);
  process.exit(1);
});
