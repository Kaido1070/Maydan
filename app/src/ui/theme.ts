/** ألوان التطبيق للوضعين. كل الشاشات تقرأ من C و KIND، فتبديل الوضع يبدّل القيم هنا فقط. */
export type ThemeMode = 'light' | 'dark';

const LIGHT = {
  /** خلفية ورقية دافئة بدل الأبيض الصريح: أريح للعين. */
  bg: '#f2f0eb',
  /** سطح البطاقات والحقول. */
  white: '#fbfaf8',
  ink: '#2a2933',
  muted: '#6d6a76',
  line: '#e3dfd7',
  /** لون الأزرار والتعبئة: نيلي هادئ. */
  purple: '#56579c',
  purpleDark: '#48498a',
  /** نص وأيقونات بلون التمييز. */
  link: '#4b4c93',
  soft: '#e9e8f5',
  softLine: '#cfcde8',
  /** خلفية محايدة خفيفة داخل البطاقات. */
  subtle: '#f5f3ee',
  /** مسار أشرطة التقدم وخلفية الأزرار المقسمة. */
  track: '#e9e6df',
  placeholder: '#a3a0aa',
  /** نص وأيقونات فوق لون التمييز. */
  onAccent: '#ffffff',
  night: '#24232e',
  hero: '#4a4b8c',
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
  /** رمادي داكن دافئ بدل الأسود، ونص مطفي بدل الأبيض الصريح. */
  bg: '#17171c',
  white: '#202027',
  ink: '#e4e2e9',
  muted: '#9c99a8',
  line: '#30303a',
  purple: '#6465b0',
  purpleDark: '#5556a0',
  link: '#b0b0ea',
  soft: '#2b2b45',
  softLine: '#45456e',
  subtle: '#26262e',
  track: '#2d2d37',
  placeholder: '#72707e',
  onAccent: '#ffffff',
  night: '#121216',
  hero: '#35366e',
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
  visit: { fg: '#2f6298', bg: '#e4edf5', solid: '#3f7cba' },
  meeting: { fg: '#a2532e', bg: '#f6e8df', solid: '#cf6f43' },
};
const KIND_DARK: typeof KIND_LIGHT = {
  visit: { fg: '#93bce6', bg: '#1b2a3b', solid: '#3f7cba' },
  meeting: { fg: '#eeae8f', bg: '#39251c', solid: '#c96a40' },
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

/** مقاسات موحدة للزوايا والمسافات في كل الشاشات. */
export const R = { card: 20, inner: 14, control: 13, small: 10, pill: 999 };
export const SPACE = { screen: 16, card: 16, gap: 12 };
