import { normalizeDigits } from './dates';
import { newId } from './records';
import { shiftName } from './shifts';
import type { Technician, Workspace } from './types';

/** أعمدة ملف الفنيين بالترتيب. */
export const TECH_COLUMNS = ['الاسم', 'الرقم الوظيفي', 'القسم', 'الشفت الأساسي', 'الحالة'] as const;

const HEADER_ALIASES: Record<'name' | 'number' | 'department' | 'shift' | 'status', string[]> = {
  name: ['الاسم', 'اسم الفني', 'اسم الموظف', 'الاسم الكامل', 'name', 'full name'],
  number: ['الرقم الوظيفي', 'رقم وظيفي', 'الرقم', 'رقم الموظف', 'employee number', 'employee no', 'emp no', 'id'],
  department: ['القسم', 'الإدارة', 'department', 'section'],
  shift: ['الشفت الأساسي', 'الشفت', 'المناوبة', 'shift', 'base shift'],
  status: ['الحالة', 'status', 'active'],
};

/** توحيد النص للمقارنة: مسافات، أرقام عربية، همزات وتاء مربوطة. */
export function normalizeKey(value: unknown): string {
  return normalizeDigits(String(value ?? ''))
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

const cellText = (value: unknown) => normalizeDigits(String(value ?? '')).replace(/\s+/g, ' ').trim();

/** الرقم الوظيفي قد يأتي رقمًا من Excel (1101 أو 1101.0). */
function employeeNumberOf(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.round(value));
  return cellText(value).replace(/\.0+$/, '');
}

export type ImportRow = {
  line: number; // رقم السطر في الملف (يبدأ من 1)
  name: string;
  employeeNumber: string;
  departmentId?: string;
  departmentName: string;
  shiftId?: string;
  shiftName: string;
  active: boolean;
  action: 'add' | 'update' | 'same' | 'error';
  error?: string;
};

export type ImportPreview = {
  rows: ImportRow[];
  added: number;
  updated: number;
  unchanged: number;
  errors: number;
  /** رسالة عامة إذا تعذر فهم الملف كله */
  problem?: string;
};

const INACTIVE = ['غير نشط', 'موقوف', 'متوقف', 'لا', 'inactive', 'no', '0', 'false'].map(normalizeKey);

/** يحلل صفوف الجدول (أول صف فيه العناوين) ويطابقها مع الأقسام والشفتات الحالية. لا يغير شيئًا. */
export function previewTechnicianImport(ws: Workspace, table: unknown[][]): ImportPreview {
  const empty: ImportPreview = { rows: [], added: 0, updated: 0, unchanged: 0, errors: 0 };
  const headerIndex = table.findIndex((row) => Array.isArray(row) && row.some((cell) => cellText(cell)));
  if (headerIndex < 0) return { ...empty, problem: 'الملف فاضي' };

  const header = table[headerIndex].map(normalizeKey);
  const column = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([key, aliases]) => [key, header.findIndex((cell) => aliases.map(normalizeKey).includes(cell))]),
  ) as Record<keyof typeof HEADER_ALIASES, number>;
  const missing = (['name', 'number', 'department', 'shift'] as const).filter((key) => column[key] < 0);
  if (missing.length) {
    const names = { name: 'الاسم', number: 'الرقم الوظيفي', department: 'القسم', shift: 'الشفت الأساسي' };
    return { ...empty, problem: 'أعمدة ناقصة في أول صف: ' + missing.map((key) => names[key]).join('، ') };
  }

  const byNumber = new Map(ws.technicians.map((tech) => [tech.employeeNumber, tech]));
  const seen = new Map<string, number>();
  const rows: ImportRow[] = [];

  table.slice(headerIndex + 1).forEach((cells, offset) => {
    const line = headerIndex + offset + 2;
    if (!Array.isArray(cells) || !cells.some((cell) => cellText(cell))) return;
    const name = cellText(cells[column.name]);
    const employeeNumber = employeeNumberOf(cells[column.number]);
    const departmentName = cellText(cells[column.department]);
    const shiftLabel = cellText(cells[column.shift]);
    const status = column.status >= 0 ? normalizeKey(cells[column.status]) : '';
    const row: ImportRow = { line, name, employeeNumber, departmentName, shiftName: shiftLabel, active: !INACTIVE.includes(status), action: 'add' };

    const department = ws.departments.find((item) => normalizeKey(item.name) === normalizeKey(departmentName));
    const shift = department?.shifts.find((item) => normalizeKey(item.name) === normalizeKey(shiftLabel));
    if (!name) row.error = 'الاسم فاضي';
    else if (!employeeNumber) row.error = 'الرقم الوظيفي فاضي';
    else if (seen.has(employeeNumber)) row.error = 'الرقم الوظيفي مكرر مع السطر ' + seen.get(employeeNumber);
    else if (!department) row.error = 'القسم «' + departmentName + '» غير موجود. الأقسام: ' + ws.departments.map((d) => d.name).join('، ');
    else if (!shift) row.error = 'الشفت «' + shiftLabel + '» غير موجود في ' + department.name + '. الشفتات: ' + department.shifts.map((s) => s.name).join('، ');

    if (employeeNumber && !seen.has(employeeNumber)) seen.set(employeeNumber, line);
    if (row.error) {
      row.action = 'error';
    } else {
      row.departmentId = department!.id;
      row.shiftId = shift!.id;
      const existing = byNumber.get(employeeNumber);
      if (existing) {
        const same =
          existing.name === name && existing.departmentId === department!.id && existing.baseShiftId === shift!.id && (existing.active !== false) === row.active;
        row.action = same ? 'same' : 'update';
      }
    }
    rows.push(row);
  });

  if (!rows.length) return { ...empty, problem: 'ما فيه صفوف فنيين تحت العناوين' };
  return {
    rows,
    added: rows.filter((r) => r.action === 'add').length,
    updated: rows.filter((r) => r.action === 'update').length,
    unchanged: rows.filter((r) => r.action === 'same').length,
    errors: rows.filter((r) => r.action === 'error').length,
  };
}

/**
 * يطبق الاستيراد: يضيف الجديد ويحدّث الموجود حسب الرقم الوظيفي.
 * الصفوف اللي فيها أخطاء تُتجاهل. الفنيون غير الموجودين في الملف يبقون كما هم.
 */
export function applyTechnicianImport(ws: Workspace, preview: ImportPreview): Workspace {
  const valid = preview.rows.filter((row) => row.action === 'add' || row.action === 'update');
  const updates = new Map(valid.filter((row) => row.action === 'update').map((row) => [row.employeeNumber, row]));
  const technicians: Technician[] = ws.technicians.map((tech) => {
    const row = updates.get(tech.employeeNumber);
    return row ? { ...tech, name: row.name, departmentId: row.departmentId!, baseShiftId: row.shiftId!, active: row.active } : tech;
  });
  for (const row of valid.filter((item) => item.action === 'add')) {
    technicians.push({ id: newId('t'), name: row.name, employeeNumber: row.employeeNumber, departmentId: row.departmentId!, baseShiftId: row.shiftId!, active: row.active });
  }
  return { ...ws, technicians };
}

/** جدول قائمة الفنيين الحالية بنفس أعمدة الاستيراد (يستخدم كنموذج قابل للتعبئة). */
export function technicianTable(ws: Workspace): (string | number)[][] {
  return [
    [...TECH_COLUMNS],
    ...ws.technicians.map((tech) => [
      tech.name,
      tech.employeeNumber,
      ws.departments.find((d) => d.id === tech.departmentId)?.name ?? '',
      shiftName(ws, tech),
      tech.active === false ? 'غير نشط' : 'نشط',
    ]),
  ];
}

/** ورقة التعليمات: الأقسام والشفتات المقبولة كما هي مكتوبة في التطبيق. */
export function instructionsTable(ws: Workspace): string[][] {
  return [
    ['تعليمات الاستيراد'],
    ['عبّئ ورقة «الفنيين» بدون تغيير عناوين الأعمدة. كل صف فني واحد.'],
    ['الفني يُعرف برقمه الوظيفي: إذا كان موجودًا تتحدث بياناته، وإذا كان جديدًا ينضاف.'],
    ['اكتب القسم والشفت الأساسي بنفس الأسماء الموجودة تحت.'],
    ['الحالة اختيارية: اكتب «غير نشط» لإيقاف فني. الفارغ يعني نشط.'],
    [],
    ['القسم', 'الشفتات المقبولة'],
    ...ws.departments.map((department) => [department.name, department.shifts.map((shift) => shift.name).join('، ')]),
  ];
}
