import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { newId } from './domain/records';
import type { Photo } from './domain/types';

// الصور تنحفظ داخل مساحة التطبيق على الجهاز فقط، بحجم مضغوط.
const MAX_EDGE = Platform.OS === 'web' ? 1024 : 1600;
const QUALITY = Platform.OS === 'web' ? 0.6 : 0.74;
const TARGET_BYTES = 500 * 1024;

const DIR = 'maydan-photos';

function photoDir(): Directory {
  const dir = new Directory(Paths.document, DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * يلتقط صورة بالكاميرا أو يختار من الألبوم (أكثر من صورة)، ثم يصغّرها ويحفظها.
 * يرجع قائمة فاضية إذا ألغى المستخدم، ويرمي خطأ إذا رفض الصلاحية.
 */
export async function pickPhotos(source: 'camera' | 'library'): Promise<Photo[]> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('اسمح للتطبيق باستخدام الكاميرا من إعدادات الجوال');
  } else if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('اسمح للتطبيق بالوصول للصور من إعدادات الجوال');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsMultipleSelection: source === 'library', selectionLimit: 10 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return [];

  const photos: Photo[] = [];
  try {
    for (const asset of result.assets) {
      const context = ImageManipulator.manipulate(asset.uri);
      if (Math.max(asset.width, asset.height) > MAX_EDGE) {
        context.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
      }
      const image = await context.renderAsync();
      const id = newId('ph');
      try {
        const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: Platform.OS === 'web' });
        if (Platform.OS === 'web') {
          if (!saved.base64) throw new Error('تعذر حفظ الصورة.');
          photos.push({ id, uri: 'data:image/jpeg;base64,' + saved.base64, takenAt: new Date().toISOString() });
          continue;
        }
        const first = new File(saved.uri);
        let smaller: File | undefined;
        const target = new File(photoDir(), id + '.jpg');
        try {
          if (first.size > TARGET_BYTES) {
            const compressed = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.62 });
            smaller = new File(compressed.uri);
          }
          const selected = smaller && smaller.size < first.size ? smaller : first;
          await selected.move(target);
          // A relative path survives changes to the iOS app container after an update.
          photos.push({ id, uri: DIR + '/' + id + '.jpg', takenAt: new Date().toISOString() });
        } finally {
          for (const temporary of [first, smaller]) {
            if (temporary?.uri !== target.uri && temporary?.exists) {
              try { temporary.delete(); } catch { /* iOS can purge this cache later. */ }
            }
          }
        }
      } finally {
        image.release();
        context.release();
      }
    }
  } catch (error) {
    deletePhotoFiles(photos);
    throw error;
  }
  return photos;
}

/** رابط عرض الصورة: data URI كما هو، والمسار النسبي يُحوّل لمسار مجلد التطبيق الحالي. */
export function photoSrc(photo: Photo): string {
  if (/^(data:|file:|https?:|blob:)/.test(photo.uri)) return photo.uri;
  return new File(Paths.document, photo.uri).uri;
}

/** يحذف ملفات الصور من الجهاز (بعد حذفها من السجلات). */
export function deletePhotoFiles(photos: Photo[]) {
  if (Platform.OS === 'web') return;
  for (const photo of photos) {
    try {
      const file = new File(photoSrc(photo));
      if (file.exists) file.delete();
    } catch {
      // الملف محذوف مسبقًا
    }
  }
}
