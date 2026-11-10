/** ألوان التطبيق للوضعين. كل الشاشات تقرأ من C و KIND، فتبديل الوضع يبدّل القيم هنا فقط. */
export type ThemeMode = 'light' | 'dark';

const LIGHT = {
  /** خلفية ورقية دافئة بدل الأبيض الصريح: أريح للعين. */
  bg: '#f4f1e9',
  /** سطح البطاقات والحقول. */
  white: '#fcfaf5',
  ink: '#222e2d',
  muted: '#52605b',
  line: '#e1dcd1',
  /** البترولي للأزرار والتعبئة. */
  brand: '#285556',
  brandDark: '#203f41',
  /** نص وأيقونات بلون التمييز. */
  link: '#285556',
  soft: '#e1ebe5',
  softLine: '#bfcec3',
  /** خلفية محايدة خفيفة داخل البطاقات. */
  subtle: '#f6f3ec',
  /** مسار أشرطة التقدم وخلفية الأزرار المقسمة. */
  track: '#e8e5db',
  placeholder: '#66726c',
  /** نص وأيقونات فوق لون التمييز. */
  onAccent: '#fffdf8',
  night: '#182524',
  hero: '#285556',
  green: '#2f6b55',
  greenBg: '#e3efe8',
  greenLine: '#c9dfd3',
  amber: '#7a5a1c',
  amberBg: '#f6ecd6',
  amberLine: '#e6d5ae',
  red: '#9a3b4d',
  redBg: '#f6e4e7',
  redLine: '#e6bcc4',
};

const DARK: typeof LIGHT = {
  /** بترولي داكن وخلفيات هادئة مع نص فاتح. */
  bg: '#182524',
  white: '#21312e',
  ink: '#e9eeea',
  muted: '#b0c0b8',
  line: '#394a46',
  brand: '#3b6c67',
  brandDark: '#2e5b57',
  link: '#8dbbb4',
  soft: '#293e38',
  softLine: '#425c52',
  subtle: '#263733',
  track: '#30413b',
  placeholder: '#9eafa6',
  onAccent: '#fffdf8',
  night: '#14201f',
  hero: '#244743',
  green: '#86cfae',
  greenBg: '#1b3129',
  greenLine: '#27473b',
  amber: '#e3c07a',
  amberBg: '#342c18',
  amberLine: '#544623',
  red: '#f0a0ae',
  redBg: '#3a2026',
  redLine: '#5e2f3a',
};

const KIND_LIGHT = {
  visit: { fg: '#345978', bg: '#e4edf1', solid: '#3c6481' },
  meeting: { fg: '#894d35', bg: '#f4e9df', solid: '#8c4d32' },
};
const KIND_DARK: typeof KIND_LIGHT = {
  visit: { fg: '#a8c7dd', bg: '#253844', solid: '#3c6481' },
  meeting: { fg: '#ecc0a5', bg: '#392d26', solid: '#8c4d32' },
};

export const C = { ...LIGHT };

/**
 * لون ثابت لكل نوع عمل في كل التطبيق (المهام والرسوم): الزيارة أزرق، والاجتماع برتقالي.
 * البترولي للأزرار والتنقل، والأخضر/الأصفر/الأحمر لحالة الإنجاز فقط.
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

/** مقاسات موحدة للزوايا والمسافات في كل الشاشات. */
export const R = { card: 20, inner: 14, control: 13, small: 10, pill: 999 };
export const SPACE = { screen: 16, card: 16, gap: 12 };
