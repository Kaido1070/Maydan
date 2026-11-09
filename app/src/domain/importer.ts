import { normalizeDigits } from './dates';
import { newId } from './records';
import { shiftName } from './shifts';
import type { Technician, Workspace } from './types';

/** أعمدة ملف الفنيين بالترتيب. */
export const TECH_COLUMNS = ['الاسم', 'النوع', 'الرقم الوظيفي', 'المقاول', 'القسم', 'الشفت الأساسي', 'الحالة'] as const;

const HEADER_ALIASES: Record<'name' | 'number' | 'department' | 'shift' | 'status' | 'kind' | 'contractor', string[]> = {
  name: ['الاسم', 'اسم الفني', 'اسم الموظف', 'الاسم الكامل', 'اسم الفني او الفريق', 'اسم الفريق', 'name', 'full name'],
  number: ['الرقم الوظيفي', 'رقم وظيفي', 'الرقم', 'رقم الموظف', 'رقم الفريق', 'رقم العقد', 'employee number', 'employee no', 'emp no', 'id'],
  kind: ['النوع', 'نوع', 'فني او فريق', 'type'],
  contractor: ['المقاول', 'اسم المقاول', 'الشركه', 'المؤسسه', 'contractor', 'company'],
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
  kind: 'person' | 'team';
  contractor: string;
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

const TEAM_WORDS = ['فريق', 'مقاول', 'فريق مقاول', 'شركه', 'team', 'contractor', 'crew'].map(normalizeKey);

/** مفتاح المطابقة: الرقم إن وجد، وإلا اسم الفريق داخل قسمه. */
const identity = (number: string, departmentId: string, name: string) =>
  number ? 'n:' + number : 'team:' + departmentId + ':' + normalizeKey(name);

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
  const missing = (['name', 'department'] as const).filter((key) => column[key] < 0);
  if (missing.length) {
    const names = { name: 'الاسم', department: 'القسم' };
    return { ...empty, problem: 'أعمدة ناقصة في أول صف: ' + missing.map((key) => names[key]).join('، ') };
  }

  const byKey = new Map(ws.technicians.map((tech) => [identity(tech.employeeNumber, tech.departmentId, tech.name), tech]));
  const seen = new Map<string, number>();
  const cell = (cells: unknown[], key: keyof typeof column) => (column[key] >= 0 ? cells[column[key]] : '');
  const rows: ImportRow[] = [];

  table.slice(headerIndex + 1).forEach((cells, offset) => {
    const line = headerIndex + offset + 2;
    if (!Array.isArray(cells) || !cells.some((cell) => cellText(cell))) return;
    const name = cellText(cell(cells, 'name'));
    const employeeNumber = employeeNumberOf(cell(cells, 'number'));
    const departmentName = cellText(cell(cells, 'department'));
    const shiftLabel = cellText(cell(cells, 'shift'));
    const contractor = cellText(cell(cells, 'contractor'));
    const kindText = normalizeKey(cell(cells, 'kind'));
    // النوع الفاضي: فريق إذا ما فيه رقم وفيه مقاول، وإلا فني.
    const kind: 'person' | 'team' = TEAM_WORDS.includes(kindText) || (!kindText && !employeeNumber && !!contractor) ? 'team' : 'person';
    const status = normalizeKey(cell(cells, 'status'));
    const row: ImportRow = { line, name, employeeNumber, kind, contractor: kind === 'team' ? contractor : '', departmentName, shiftName: shiftLabel, active: !INACTIVE.includes(status), action: 'add' };

    const department = ws.departments.find((item) => normalizeKey(item.name) === normalizeKey(departmentName));
    // الشفت اختياري إذا كان للقسم شفت واحد فقط.
    const shift = !shiftLabel && department?.shifts.length === 1 ? department.shifts[0] : department?.shifts.find((item) => normalizeKey(item.name) === normalizeKey(shiftLabel));
    if (shift && !shiftLabel) row.shiftName = shift.name;
    const key = department ? identity(employeeNumber, department.id, name) : '';
    if (!name) row.error = kind === 'team' ? 'اسم الفريق فاضي' : 'الاسم فاضي';
    else if (!employeeNumber && kind === 'person') row.error = 'الرقم الوظيفي فاضي (للفرق اكتب في النوع: فريق)';
    else if (!department) row.error = 'القسم «' + departmentName + '» غير موجود. الأقسام: ' + ws.departments.map((d) => d.name).join('، ');
    else if (!shift) row.error = (shiftLabel ? 'الشفت «' + shiftLabel + '» غير موجود في ' + department.name : 'اكتب الشفت الأساسي') + '. الشفتات: ' + department.shifts.map((s) => s.name).join('، ');
    else if (seen.has(key)) row.error = (employeeNumber ? 'الرقم مكرر' : 'الفريق مكرر') + ' مع السطر ' + seen.get(key);

    if (key && !seen.has(key)) seen.set(key, line);
    if (row.error) {
      row.action = 'error';
    } else {
      row.departmentId = department!.id;
      row.shiftId = shift!.id;
      const existing = byKey.get(key);
      if (existing) {
        const same =
          existing.name === name &&
          existing.departmentId === department!.id &&
          existing.baseShiftId === shift!.id &&
          (existing.kind ?? 'person') === kind &&
          (existing.contractor ?? '') === row.contractor &&
          (existing.active !== false) === row.active;
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
  const fields = (row: ImportRow) => ({
    name: row.name,
    employeeNumber: row.employeeNumber,
    kind: row.kind,
    contractor: row.contractor || undefined,
    departmentId: row.departmentId!,
    baseShiftId: row.shiftId!,
    active: row.active,
  });
  const updates = new Map(valid.filter((row) => row.action === 'update').map((row) => [identity(row.employeeNumber, row.departmentId!, row.name), row]));
  const technicians: Technician[] = ws.technicians.map((tech) => {
    const row = updates.get(identity(tech.employeeNumber, tech.departmentId, tech.name));
    return row ? { ...tech, ...fields(row) } : tech;
  });
  for (const row of valid.filter((item) => item.action === 'add')) technicians.push({ id: newId('t'), ...fields(row) });
  return { ...ws, technicians };
}

/** جدول قائمة الفنيين الحالية بنفس أعمدة الاستيراد (يستخدم كنموذج قابل للتعبئة). */
export function technicianTable(ws: Workspace): (string | number)[][] {
  return [
    [...TECH_COLUMNS],
    ...ws.technicians.map((tech) => [
      tech.name,
      tech.kind === 'team' ? 'فريق' : 'فني',
      tech.employeeNumber,
      tech.contractor ?? '',
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
    ['النوع: «فني» لموظف باسمه ورقمه الوظيفي، أو «فريق» للفرق والمقاولين (شائع في الإنشاءات والصيانة). الفارغ يعني فني.'],
    ['الفني يُعرف برقمه الوظيفي. الفريق يُعرف برقمه إن وُجد، وإلا باسمه داخل القسم. الموجود تتحدث بياناته والجديد ينضاف.'],
    ['الرقم الوظيفي إلزامي للفني واختياري للفريق (رقم الفريق أو العقد). المقاول اختياري.'],
    ['اكتب القسم والشفت الأساسي بنفس الأسماء الموجودة تحت. الشفت اختياري للأقسام اللي لها شفت واحد.'],
    ['الحالة اختيارية: اكتب «غير نشط» لإيقاف فني. الفارغ يعني نشط.'],
    [],
    ['القسم', 'الشفتات المقبولة'],
    ...ws.departments.map((department) => [department.name, department.shifts.map((shift) => shift.name).join('، ')]),
  ];
}
