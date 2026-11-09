/** فترة دوام داخل اليوم. إذا كان end <= start فالفترة تمتد لليوم التالي. */
export type PeriodDef = { id: string; name: string; start: string; end: string };

/**
 * دورة الشفتات:
 * - cycle: نمط يتكرر بدءًا من anchorDate. كل عنصر في pattern هو معرّف فترة أو "off".
 *   الشفت رقم i يبدأ النمط متأخرًا i * staggerDays يوم.
 * - weekly: الشفتات تعمل في أيام الأسبوع المحددة (0 = الأحد).
 */
export type Rotation =
  | { kind: 'cycle'; anchorDate: string; pattern: string[]; staggerDays: number }
  | { kind: 'weekly'; workDays: number[] };

export type Shift = { id: string; name: string };

export type EntryKind = 'person' | 'team' | 'project';

export type Department = {
  id: string;
  name: string;
  /** نوع السجلات الافتراضي في القسم: فنيون، أو مشاريع (مثل الإنشاءات). */
  entryKind?: 'person' | 'project';
  shifts: Shift[];
  periods: PeriodDef[];
  rotation: Rotation;
};

export type Technician = {
  id: string;
  /** للفريق: رقم الفريق أو العقد، وللمشروع: رقم المشروع (اختياري لهما). */
  employeeNumber: string;
  /** فني باسمه، أو فريق/مقاول، أو مشروع (الإنشاءات). الافتراضي فني. */
  kind?: EntryKind;
  /** اسم المقاول للفرق. */
  contractor?: string;
  name: string;
  departmentId: string;
  /** الشفت الأساسي الذي يتبعه الفني في الدورة. */
  baseShiftId: string;
  active?: boolean;
};

/** تعديل على شفت يوم معيّن: تبديل الشفت أو تكليف قائمة فنيين لهذا اليوم فقط. */
export type SlotOverride = { shiftId?: string | null; people?: string[] };

export type Visit = {
  id: string;
  departmentId: string;
  date: string; // YYYY-MM-DD بتوقيت السعودية
  time: string; // HH:MM
  site: string;
  technicianIds: string[];
  planItemId?: string;
  /** سجل من بيانات التجربة الأولية (لا يُحتسب في نقاط XP). */
  seed?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Meeting = { id: string; title: string; year: number };

/** سجل حضور اجتماع واحد لقسم واحد في تاريخ واحد. */
export type MeetingAttendance = {
  id: string;
  meetingId: string;
  departmentId: string;
  date: string;
  /** وقت الاجتماع HH:MM (اختياري للبيانات القديمة). */
  time?: string;
  technicianIds: string[];
  seed?: boolean;
  updatedAt: string;
};

export type PlanItem = {
  id: string;
  weekday: number; // 0 = الأحد
  departmentId: string;
  time: string;
  title: string;
  kind: 'visit' | 'meeting';
  meetingId?: string;
};

/** صورة محفوظة على الجهاز (أو data URI في نسخة الويب). */
export type Photo = { id: string; uri: string; takenAt: string };

/** سجل معدة توزيع: صور قبل وبعد، تُستخدم لاحقًا في التقرير. */
export type EquipmentRecord = {
  id: string;
  /** اسم المعدة أو رقمها (مثل محول، لوحة توزيع، رقم الأصل). */
  name: string;
  location: string;
  notes: string;
  date: string;
  before: Photo[];
  after: Photo[];
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  engineerName: string;
  dailyVisitGoal: number;
  visitTarget: number;
  visitWindowMonths: number;
  xpVisit: number;
  xpMeeting: number;
};

export type Workspace = {
  departments: Department[];
  technicians: Technician[];
  meetings: Meeting[];
  plan: PlanItem[];
  settings: Settings;
  overrides: Record<string, SlotOverride>;
  visits: Visit[];
  attendance: MeetingAttendance[];
  /** سجلات معدات التوزيع (اختياري للبيانات القديمة). */
  equipment?: EquipmentRecord[];
};

export type Mode = 'demo' | 'live';

export type AppState = { version: 1; mode: Mode; demo: Workspace; live: Workspace };

export type Now = { date: string; time: string };
