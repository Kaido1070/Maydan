/** ألوان التطبيق للوضعين. كل الشاشات تقرأ من C و KIND، فتبديل الوضع يبدّل القيم هنا فقط. */
export type ThemeMode = 'light' | 'dark';

const LIGHT = {
  bg: '#f4f3f8',
  /** سطح البطاقات والحقول. */
  white: '#ffffff',
  ink: '#1d1930',
  muted: '#676279',
  line: '#e7e3ef',
  /** لون الأزرار والتعبئة. */
  purple: '#5636c6',
  purpleDark: '#4525ad',
  /** نص وأيقونات بلون التمييز (على خلفية فاتحة أو داكنة). */
  link: '#5133b8',
  soft: '#eee9ff',
  softLine: '#cdbff3',
  /** خلفية محايدة خفيفة داخل البطاقات. */
  subtle: '#f6f4fb',
  /** مسار أشرطة التقدم وخلفية الأزرار المقسمة. */
  track: '#ebe7f4',
  placeholder: '#a29db3',
  /** نص وأيقونات فوق لون التمييز. */
  onAccent: '#ffffff',
  night: '#19172c',
  hero: '#4a2f9a',
  green: '#17664b',
  greenBg: '#e5f6ed',
  greenLine: '#cdebdb',
  amber: '#7d5100',
  amberBg: '#fff2d6',
  amberLine: '#f3dca6',
  red: '#a12c48',
  redBg: '#fce9ee',
  redLine: '#f3b7c4',
};

const DARK: typeof LIGHT = {
  bg: '#100e17',
  white: '#1c1927',
  ink: '#f2eff9',
  muted: '#a7a2ba',
  line: '#2f2a40',
  purple: '#6f52e0',
  purpleDark: '#5a3fcb',
  link: '#b9a6ff',
  soft: '#2a2347',
  softLine: '#46397a',
  subtle: '#231f31',
  track: '#2c2740',
  placeholder: '#77718d',
  onAccent: '#ffffff',
  night: '#0b0a11',
  hero: '#33217a',
  green: '#74d9ab',
  greenBg: '#14322a',
  greenLine: '#1f4a3c',
  amber: '#f2c366',
  amberBg: '#392d12',
  amberLine: '#5a4718',
  red: '#ff93a9',
  redBg: '#3c1a25',
  redLine: '#6a2a3b',
};

const KIND_LIGHT = {
  visit: { fg: '#1f66bd', bg: '#e6f0fb', solid: '#2a78d6' },
  meeting: { fg: '#b4471b', bg: '#fdece4', solid: '#eb6834' },
};
const KIND_DARK: typeof KIND_LIGHT = {
  visit: { fg: '#86b9f7', bg: '#15273d', solid: '#2a78d6' },
  meeting: { fg: '#f6a783', bg: '#3a2118', solid: '#e0602f' },
};

export const C = { ...LIGHT };

/**
 * لون ثابت لكل نوع عمل في كل التطبيق (المهام والرسوم): الزيارة أزرق، والاجتماع برتقالي.
 * البنفسجي للأزرار والتنقل فقط، والأخضر/الأصفر/الأحمر لحالة الإنجاز فقط.
 */
export const KIND = { visit: { ...KIND_LIGHT.visit }, meeting: { ...KIND_LIGHT.meeting } };

let current: ThemeMode = 'light';
let version = 0;

export const themeMode = () => current;

/** يبدّل قيم الألوان. يُستدعى قبل رسم الشاشة، والأنماط المبنية بـ themed تنحسب من جديد. */
export function applyTheme(mode: ThemeMode) {
  if (mode === current) return;
  current = mode;
  version++;
  Object.assign(C, mode === 'dark' ? DARK : LIGHT);
  Object.assign(KIND.visit, (mode === 'dark' ? KIND_DARK : KIND_LIGHT).visit);
  Object.assign(KIND.meeting, (mode === 'dark' ? KIND_DARK : KIND_LIGHT).meeting);
}

/** أنماط تعتمد على الألوان: تنحسب أول استخدام وبعد كل تبديل للوضع. */
export function themed<T extends object>(make: () => T): T {
  let built = -1;
  let cache = {} as T;
  return new Proxy({} as T, {
    get(_, key) {
      if (built !== version) {
        cache = make();
        built = version;
      }
      return cache[key as keyof T];
    },
  });
}

/** تفضيلات المظهر (محفوظة على الجهاز، مشتركة بين وضع التجربة وبيانات العمل). */
export type Prefs = {
  theme: 'light' | 'dark' | 'system';
  /** الشريط السفلي الزجاجي العائم. */
  glass: boolean;
  /** ضبابية الزجاج: 0 شفاف، 1 خفيف، 2 متوازن، 3 قوي. */
  blur: 0 | 1 | 2 | 3;
};
export const DEFAULT_PREFS: Prefs = { theme: 'light', glass: true, blur: 2 };
export const BLUR_LABELS = ['شفاف', 'خفيف', 'متوازن', 'قوي'];
/** شدة الضبابية ونسبة تعتيم السطح لكل درجة. */
export const BLUR_LEVELS = [
  { intensity: 6, tint: 0.08 },
  { intensity: 22, tint: 0.3 },
  { intensity: 45, tint: 0.55 },
  { intensity: 80, tint: 0.78 },
];

/** لون سداسي مع شفافية (0..1). */
export const alpha = (hex: string, opacity: number) => hex.slice(0, 7) + Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0');
