/*
 * اختبار استيراد الفنيين من Excel على نسخة الويب:
 *   npx expo export -p web && npx serve -s dist -l 8089 &  ثم  node e2e/excel.js
 */
const { chromium, devices } = require('playwright');
const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const URL = process.env.MAYDAN_URL || 'http://localhost:8089';

(async () => {
  // ملف اختبار بأسماء وهمية
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'maydan-')), 'technicians.xlsx');
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['الاسم', 'الرقم الوظيفي', 'القسم', 'الشفت الأساسي', 'الحالة'],
    ['فني تجربة أول', 9001, 'طوارئ', 'طوارئ أ', ''],
    ['فني تجربة ثاني', 9002, 'عدادات', 'عدادات ب', ''],
    ['سطر خاطئ', 9003, 'قسم غير موجود', 'أ', ''],
  ]), 'الفنيين');
  XLSX.writeFile(book, file);

  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 14'], deviceScaleFactor: 1, viewport: { width: 390, height: 2400 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const id = (t) => page.locator(`[data-testid="${t}"]`);
  await id('whats-new-ok').click();

  await id('open-settings').click();
  await page.getByText('بيانات العمل').first().click();

  // تنزيل النموذج الفاضي
  const [download] = await Promise.all([page.waitForEvent('download'), id('excel-template').click()]);
  const template = path.join(path.dirname(file), 'template.xlsx');
  await download.saveAs(template);
  const tpl = XLSX.readFile(template);
  assert.deepStrictEqual(tpl.SheetNames, ['الفنيين', 'تعليمات']);
  assert.deepStrictEqual(XLSX.utils.sheet_to_json(tpl.Sheets['الفنيين'], { header: 1 })[0], ['الاسم', 'النوع', 'الرقم الوظيفي', 'المقاول', 'القسم', 'الشفت الأساسي', 'الحالة']);

  // الاستيراد
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), id('excel-import').click()]);
  // اسم الملف بالعربي (نمرره كمحتوى لأن Playwright ما يتعامل مع المسارات العربية)
  await chooser.setFiles({ name: 'فنيين.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fs.readFileSync(file) });
  await page.waitForSelector('text=الاستيراد إلى بيانات العمل');
  let body = await page.locator('body').innerText();
  assert(/جديد 2/.test(body) && /أخطاء 1/.test(body), 'المعاينة: 2 جديد و 1 خطأ');
  assert(body.includes('قسم غير موجود'), 'سبب الخطأ ظاهر');
  await page.screenshot({ path: process.env.SHOT || path.join(path.dirname(file), 'import.png') });
  await id('import-apply').click();
  body = await page.locator('body').innerText();
  assert(body.includes('تم استيراد الفنيين: 2 جديد'), 'رسالة النجاح');
  assert(body.includes('2 فني نشط'), 'عدد الفنيين');

  // يظهرون في شاشة الزيارات بالقسم والشفت الصحيح
  await id('tab-visits').click();
  await id('dept-b').click();
  await page.getByRole('button', { name: 'كل فنيي القسم', exact: true }).click();
  body = await page.locator('body').innerText();
  assert(/فني تجربة أول[\s\S]{0,40}طوارئ أ/.test(body), 'الفني ظاهر بشفته');

  // وضع التجربة ما تأثر
  await id('open-settings').click();
  await page.getByText('وضع التجربة').first().click();
  await id('tab-visits').click();
  await id('dept-b').click();
  await page.getByRole('button', { name: 'كل فنيي القسم', exact: true }).click();
  assert(!(await page.locator('body').innerText()).includes('فني تجربة أول'), 'وضع التجربة منفصل');

  assert.deepStrictEqual(errors, []);
  console.log('✓ استيراد Excel نجح');
  await browser.close();
})().catch((error) => {
  console.error('✗', error.message);
  process.exit(1);
});
