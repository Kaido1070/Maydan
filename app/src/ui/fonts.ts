import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';

/** خط التطبيق: IBM Plex Sans Arabic، واضح على الشاشات ومضمّن داخل التطبيق. */
export const FONTS = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
};

/** الخطوط المخصصة ما تتأثر بـ fontWeight على iOS، فنختار الملف المناسب لكل وزن. */
export function fontFor(weight: unknown): string {
  const value = String(weight ?? '400');
  if (value === 'bold' || Number(value) >= 700) return FONTS.bold;
  if (Number(value) >= 600) return FONTS.semibold;
  if (Number(value) >= 500) return FONTS.medium;
  return FONTS.regular;
}

/** أصغر حجم خط مسموح، حتى يبقى النص مقروءًا. */
export const MIN_FONT_SIZE = 11;

export function useAppFonts() {
  const [loaded, error] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  // إذا تعذر تحميل الخط نكمل بخط النظام بدل ما يتعلق التطبيق.
  return loaded || !!error;
}
