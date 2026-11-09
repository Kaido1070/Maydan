import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// نسخة iOS/Android. نسخة الويب في exporting.web.ts (Metro تختارها تلقائيًا).

/** يحفظ ملفًا نصيًا ثم يفتح نافذة المشاركة (حفظ في الملفات، بريد، واتساب...). */
export async function shareText(fileName: string, content: string, mimeType: string, uti: string) {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: fileName });
}

/** يحفظ ملفًا ثنائيًا (مثل Excel) ثم يفتح نافذة المشاركة. */
export async function shareBytes(fileName: string, bytes: Uint8Array, mimeType: string, uti: string) {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: fileName });
}

/** يحوّل HTML إلى PDF ويشاركه. */
export async function sharePdf(fileName: string, html: string) {
  const { uri } = await Print.printToFileAsync({ html });
  const target = new File(Paths.cache, fileName);
  if (target.exists) target.delete();
  await new File(uri).move(target);
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileName });
}
