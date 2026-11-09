import React, { useState } from 'react';
import { Image, Modal, View } from 'react-native';
import type { Photo } from '../domain/types';
import { photoSrc, pickPhotos } from '../photos';
import { Button, C, Chip, Icon, Row, Spread, Sub, T } from './kit';
import { Touch } from './touch';

/** حقل صور: كاميرا أو من الصور، مع معاينة وحذف. */
export function PhotoField({
  title,
  photos,
  onChange,
  onError,
  testID,
}: {
  title: string;
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
  onError: (message: string) => void;
  testID?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<Photo | null>(null);

  const add = async (source: 'camera' | 'library') => {
    setBusy(true);
    try {
      const picked = await pickPhotos(source);
      if (picked.length) onChange([...photos, ...picked]);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 10 }}>
      <Spread>
        <T style={{ fontWeight: '700' }}>{title}</T>
        <Chip tone={photos.length ? 'purple' : 'neutral'} label={photos.length + ' صورة'} />
      </Spread>
      {photos.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {photos.map((photo) => (
            <View key={photo.id} style={{ width: '31%' }}>
              <Touch accessibilityRole="imagebutton" accessibilityLabel="عرض الصورة" onPress={() => setViewer(photo)}>
                <Image source={{ uri: photoSrc(photo) }} style={{ width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#eee' }} />
              </Touch>
              <Touch
                accessibilityRole="button"
                accessibilityLabel="حذف الصورة"
                hitSlop={8}
                onPress={() => onChange(photos.filter((item) => item.id !== photo.id))}
                style={{ position: 'absolute', top: 4, left: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="x" size={14} color="#fff" />
              </Touch>
            </View>
          ))}
        </View>
      ) : (
        <Sub style={{ marginTop: 4 }}>اختياري</Sub>
      )}
      <Row style={{ marginTop: 10 }}>
        <Button testID={testID ? testID + '-camera' : undefined} small style={{ flex: 1 }} variant="secondary" icon="camera" label="الكاميرا" disabled={busy} onPress={() => add('camera')} />
        <Button testID={testID ? testID + '-library' : undefined} small style={{ flex: 1 }} variant="secondary" icon="image" label="من الصور" disabled={busy} onPress={() => add('library')} />
      </Row>
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Touch accessibilityRole="button" accessibilityLabel="إغلاق الصورة" onPress={() => setViewer(null)} style={{ flex: 1, backgroundColor: '#000e', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          {viewer ? <Image source={{ uri: photoSrc(viewer) }} resizeMode="contain" style={{ width: '100%', height: '85%' }} /> : null}
        </Touch>
      </Modal>
    </View>
  );
}
