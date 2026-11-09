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
  /** نوع المهمة (صيانة، تمديد كابلات...). */
  workType?: string;
  /** موقع المهمة. */
  location?: string;
  /** رقم المهمة أو أمر العمل. */
  taskNumber?: string;
  /** وصف إضافي (وفي البيانات القديمة: الموقع أو الوصف). */
  site: string;
  technicianIds: string[];
  planItemId?: string;
  /** زيارة مستودع أو نقطة انطلاق (بدون فنيين). */
  placeId?: string;
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

/** مستودع أو نقطة انطلاق تُزار دوريًا. */
export type PlaceKind = 'warehouse' | 'staging';
export type Place = { id: string; kind: PlaceKind; name: string; departmentId?: string };

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

/** دوام المهندس نفسه: أيام وساعات العمل (جزء ميدان وجزء مكتب). */
export type WorkSchedule = { days: number[]; start: string; end: string };

export type FindingKind = 'observation' | 'violation';
export type FindingStatus = 'open' | 'progress' | 'closed';

/** تحديث على ملاحظة أو مخالفة: ملاحظة متابعة، أو سبب تأخير، أو إغلاق. */
export type FindingUpdate = { id: string; date: string; kind: 'note' | 'delay' | 'close' | 'reopen'; text: string };

/** ملاحظة سلامة أو مخالفة تُتابع لين تنقفل. */
export type Finding = {
  id: string;
  kind: FindingKind;
  title: string;
  description: string;
  departmentId?: string;
  location: string;
  /** المسؤول عن الإغلاق: فني أو مقاول أو جهة. */
  responsible: string;
  date: string;
  dueDate?: string;
  status: FindingStatus;
  closedAt?: string;
  photos: Photo[];
  updates: FindingUpdate[];
  /** خانات إضافية (نموذج المخالفات لاحقًا). */
  extra?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

/** عمل خارج الدوام. */
export type OvertimeEntry = { id: string; date: string; start: string; end: string; reason: string; createdAt: string };

export type Settings = {
  engineerName: string;
  dailyVisitGoal: number;
  /** هدف الزيارات الأسبوعي. الافتراضي = الهدف اليومي × أيام الدوام. */
  weeklyVisitGoal?: number;
  /** دوام المهندس. الافتراضي الأحد–الخميس 7:00–15:00. */
  workSchedule?: WorkSchedule;
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
  findings?: Finding[];
  places?: Place[];
  overtime?: OvertimeEntry[];
};

export type Mode = 'demo' | 'live';

export type AppState = { version: 1; mode: Mode; demo: Workspace; live: Workspace };

export type Now = { date: string; time: string };
