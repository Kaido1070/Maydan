import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { instructionsTable, technicianTable } from './domain/importer';
import type { Workspace } from './domain/types';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const XLSX_UTI = 'org.openxmlformats.spreadsheetml.sheet';

/** ملف Excel فيه ورقة «الفنيين» (القائمة الحالية أو فاضية) وورقة «تعليمات». */
export function buildTechnicianWorkbook(ws: Workspace): Uint8Array {
  const book = XLSX.utils.book_new();
  book.Workbook = { Views: [{ RTL: true }] };
  const techs = XLSX.utils.aoa_to_sheet(technicianTable(ws));
  techs['!cols'] = [{ wch: 28 }, { wch: 8 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 20 }, { wch: 10 }];
  const help = XLSX.utils.aoa_to_sheet(instructionsTable(ws));
  help['!cols'] = [{ wch: 18 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(book, techs, 'الفنيين');
  XLSX.utils.book_append_sheet(book, help, 'تعليمات');
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

/** فك ترميز UTF-8 بدون الاعتماد على TextDecoder (قد لا يتوفر في Hermes). */
export function utf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    let code = b;
    if (b >= 0xf0) code = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else if (b >= 0xe0) code = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else if (b >= 0xc0) code = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    out += String.fromCodePoint(code);
  }
  return out;
}

/** يقرأ أول ورقة اسمها «الفنيين» (أو أول ورقة في الملف) كجدول صفوف. يقبل xlsx و xls و csv. */
export function readTable(bytes: Uint8Array): unknown[][] {
  // xlsx = ملف zip (PK)، xls = OLE (D0 CF). غير كذا نعامله كنص CSV بترميز UTF-8.
  const binary = (bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0xd0 && bytes[1] === 0xcf);
  const book = binary
    ? XLSX.read(bytes, { type: 'array', cellDates: false })
    : XLSX.read(utf8(bytes).replace(/^\uFEFF/, ''), { type: 'string', raw: true });
  const sheetName = book.SheetNames.find((name) => name.trim().startsWith('الفنيين')) ?? book.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], { header: 1, raw: true, defval: '' });
}

/** يفتح منتقي الملفات ويرجع محتوى الملف المختار، أو null إذا ألغى المستخدم. الملف يُقرأ على الجهاز فقط. */
export async function pickSpreadsheet(): Promise<{ name: string; bytes: Uint8Array } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [XLSX_MIME, 'application/vnd.ms-excel', 'text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (Platform.OS === 'web') {
    const file: Blob = asset.file ?? (await fetch(asset.uri).then((r) => r.blob()));
    return { name: asset.name, bytes: new Uint8Array(await file.arrayBuffer()) };
  }
  return { name: asset.name, bytes: await new File(asset.uri).bytes() };
}
