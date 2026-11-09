import * as XLSX from 'xlsx';
import { buildTechnicianWorkbook, readTable, utf8 } from '../../excel';
import { applyTechnicianImport, previewTechnicianImport } from '../importer';
import { emptyWorkspace } from '../seed';

jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-file-system', () => ({ File: class {} }));

const HEAD = ['الاسم', 'الرقم الوظيفي', 'القسم', 'الشفت الأساسي', 'الحالة'];

function base() {
  const ws = emptyWorkspace('2026-11-09');
  ws.technicians = [{ id: 'x1', name: 'فني قديم', employeeNumber: '700', departmentId: 'b', baseShiftId: 'b-A' }];
  return ws;
}

describe('استيراد الفنيين من Excel', () => {
  test('يضيف الجديد ويحدّث الموجود بالرقم الوظيفي ويتجاهل الأخطاء', () => {
    const ws = base();
    const preview = previewTechnicianImport(ws, [
      HEAD,
      ['فني جديد', 801, 'طوارئ', 'طوارئ ب', ''],
      ['فني قديم معدل', '٧٠٠', 'طوارئ', 'طوارئ ج', ''], // أرقام عربية
      ['قسم غلط', 802, 'كهرباء', 'أ', ''],
      ['', 803, 'مساح', 'المسح الميداني', ''],
      ['مكرر', 801, 'مساح', 'المسح الميداني', ''],
      [],
      ['موقوف', '804.0', 'الانشاءات', 'الانشاءات الميدانية', 'غير نشط'], // بدون همزة
    ]);
    expect(preview.problem).toBeUndefined();
    expect(preview).toMatchObject({ added: 2, updated: 1, unchanged: 0, errors: 3 });
    expect(preview.rows.find((r) => r.line === 4)!.error).toContain('كهرباء');
    expect(preview.rows.find((r) => r.line === 6)!.error).toContain('مكرر');

    const next = applyTechnicianImport(ws, preview);
    expect(next.technicians).toHaveLength(3);
    expect(next.technicians.find((t) => t.employeeNumber === '700')).toMatchObject({ id: 'x1', name: 'فني قديم معدل', baseShiftId: 'b-C' });
    expect(next.technicians.find((t) => t.employeeNumber === '801')).toMatchObject({ departmentId: 'b', baseShiftId: 'b-B' });
    expect(next.technicians.find((t) => t.employeeNumber === '804')).toMatchObject({ departmentId: 'e', active: false });
  });

  test('الفرق والمقاولون: بدون رقم وظيفي، ويتعرّف عليهم بالاسم داخل القسم', () => {
    const ws = base();
    const head = ['الاسم', 'النوع', 'الرقم الوظيفي', 'المقاول', 'القسم', 'الشفت الأساسي'];
    const first = previewTechnicianImport(ws, [
      head,
      ['فريق الحفريات 1', 'فريق', '', 'مؤسسة البناء', 'الإنشاءات', ''], // الشفت اختياري لقسم بشفت واحد
      ['', '', '', 'مقاول الصيانة', 'صيانة', 'الصيانة الميدانية'], // اسم فاضي → خطأ
      ['فريق التمديدات', '', '', 'شركة النور', 'صيانة', ''], // بدون نوع + مقاول + بدون رقم → فريق
      ['فني بدون رقم', 'فني', '', '', 'صيانة', ''],
      ['فريق طوارئ', 'فريق', 'C-12', '', 'طوارئ', ''], // قسم بأكثر من شفت يحتاج الشفت
    ]);
    expect(first).toMatchObject({ added: 2, errors: 3 });
    expect(first.rows.find((r) => r.line === 5)!.error).toContain('الرقم الوظيفي');
    expect(first.rows.find((r) => r.line === 6)!.error).toContain('اكتب الشفت');
    const next = applyTechnicianImport(ws, first);
    expect(next.technicians.find((t) => t.name === 'فريق الحفريات 1')).toMatchObject({ kind: 'team', contractor: 'مؤسسة البناء', employeeNumber: '', departmentId: 'e', baseShiftId: 'e-A' });
    expect(next.technicians.find((t) => t.name === 'فريق التمديدات')).toMatchObject({ kind: 'team', departmentId: 'd' });

    // إعادة الاستيراد بتغيير المقاول تحدّث نفس الفريق بدل إضافة نسخة
    const again = previewTechnicianImport(next, [head, ['فريق الحفريات 1', 'فريق', '', 'مقاول جديد', 'الإنشاءات', '']]);
    expect(again).toMatchObject({ added: 0, updated: 1 });
    const after = applyTechnicianImport(next, again);
    expect(after.technicians.filter((t) => t.name === 'فريق الحفريات 1')).toHaveLength(1);
    expect(after.technicians.find((t) => t.name === 'فريق الحفريات 1')!.contractor).toBe('مقاول جديد');
  });

  test('يرفض الملف إذا كانت الأعمدة الأساسية ناقصة', () => {
    expect(previewTechnicianImport(base(), [['الاسم', 'الرقم الوظيفي']]).problem).toContain('القسم');
    expect(previewTechnicianImport(base(), []).problem).toBe('الملف فاضي');
  });

  test('ملف Excel الناتج من التطبيق يُقرأ ويُستورد بدون تغييرات', () => {
    const ws = base();
    const bytes = buildTechnicianWorkbook(ws);
    const book = XLSX.read(bytes, { type: 'array' });
    expect(book.SheetNames).toEqual(['الفنيين', 'تعليمات']);
    const preview = previewTechnicianImport(ws, readTable(bytes));
    expect(preview).toMatchObject({ added: 0, updated: 0, unchanged: 1, errors: 0 });
  });

  test('يقرأ ملف CSV كذلك', () => {
    const csv = 'الاسم,الرقم الوظيفي,القسم,الشفت\nفني CSV,900,عدادات,عدادات أ\n';
    const preview = previewTechnicianImport(base(), readTable(new TextEncoder().encode(csv)));
    expect(preview).toMatchObject({ added: 1, errors: 0 });
  });

  test('فك UTF-8 اليدوي يطابق TextDecoder', () => {
    const text = 'فني ١٢٣ ABC ✓ 😀';
    const original = globalThis.TextDecoder;
    // @ts-expect-error محاكاة بيئة بدون TextDecoder
    delete globalThis.TextDecoder;
    try {
      expect(utf8(new TextEncoder().encode(text))).toBe(text);
    } finally {
      globalThis.TextDecoder = original;
    }
  });
});
