import changelog from '../changelog.json';

export type Release = { version: string; date: string; title: string; changes: string[] };

/** سجل التحديثات، الأحدث أولًا. يُقرأ أيضًا في GitHub Actions لكتابة ملاحظات الإصدار. */
export const CHANGELOG: Release[] = changelog;

export const APP_VERSION = CHANGELOG[0].version;

/** رقم البناء يضعه GitHub Actions وقت البناء. في التطوير يكون فاضيًا. */
export const BUILD_NUMBER = process.env.EXPO_PUBLIC_BUILD_NUMBER ?? '';

export const versionLabel = () => APP_VERSION + (BUILD_NUMBER ? ' · بناء ' + BUILD_NUMBER : ' · نسخة تطوير');

/** الإصدارات الأحدث من آخر إصدار شافه المستخدم (لعرض «الجديد» بعد التحديث). */
export function releasesSince(seen: string | null): Release[] {
  if (!seen) return CHANGELOG.slice(0, 1);
  const index = CHANGELOG.findIndex((release) => release.version === seen);
  return index < 0 ? CHANGELOG.slice(0, 1) : CHANGELOG.slice(0, index);
}
