import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import * as Location from 'expo-location';
import { type Coords, formatCoords, isMapsLink, mapsLink, parseCoords } from '../domain/geo';
import { Button, C, Field, Icon, Row, Sub, T } from './kit';
import { MapPreview } from './MapPreview';
import { haptic } from './touch';

/**
 * موقع الزيارة: نص يدوي، وزر «موقعي الحالي» يحدده من GPS ويكتب العنوان،
 * أو تلصق رابط/إحداثيات من خرائط قوقل. ومعاينة على خريطة قوقل للتأكد.
 */
export function LocationField({
  label,
  placeholder,
  value,
  onChange,
  coords,
  onCoords,
  mapUrl,
  onMapUrl,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  coords?: Coords;
  onCoords: (coords: Coords | undefined) => void;
  mapUrl?: string;
  onMapUrl: (url: string | undefined) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // لصق رابط أو إحداثيات من خرائط قوقل في الخانة: تتحول لموقع على الخريطة.
  const typed = (text: string) => {
    const found = parseCoords(text);
    if (found) {
      onCoords(found);
      onMapUrl(undefined);
      // الرابط نفسه ما ينكتب في الخانة: يبقى الوصف اللي كان مكتوب.
      onChange(value);
      setNote('انضاف الموقع من خرائط قوقل. اكتب وصف المكان إذا تبي.');
      return;
    }
    if (isMapsLink(text)) {
      onMapUrl(text.trim());
      onChange(value);
      setNote('انحفظ رابط خرائط قوقل. الرابط المختصر ما فيه إحداثيات، فالمعاينة تفتح في خرائط قوقل.');
      return;
    }
    onChange(text);
  };

  const locate = async () => {
    setBusy(true);
    setNote(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setNote('ما فيه صلاحية للموقع. فعّلها من إعدادات الجهاز، أو الصق رابط الموقع من خرائط قوقل.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const found = { lat: position.coords.latitude, lng: position.coords.longitude };
      onCoords(found);
      onMapUrl(undefined);
      haptic.success();
      // العنوان التقريبي من الجهاز. لو ما طلع، تبقى الإحداثيات وتكتب الوصف بنفسك.
      if (!value.trim()) {
        try {
          const [place] = await Location.reverseGeocodeAsync({ latitude: found.lat, longitude: found.lng });
          const text = place ? [place.district || place.subregion, place.street || place.name, place.city].filter(Boolean).filter((part, index, all) => all.indexOf(part) === index).join('، ') : '';
          if (text) onChange(text);
        } catch {
          // بدون عنوان
        }
      }
      setNote('تحدد موقعك (دقة ' + Math.round(position.coords.accuracy ?? 0) + ' م). تأكد منه في المعاينة.');
    } catch (error) {
      setNote('تعذر تحديد الموقع: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  };

  const link = coords ? mapsLink(coords) : mapUrl;
  return (
    <View style={{ marginBottom: 12 }}>
      <Field label={label} value={value} onChangeText={typed} placeholder={placeholder} maxLength={300} testID="visit-site" />
      <Row gap={8} style={{ marginTop: -4, flexWrap: 'wrap' }}>
        <Button testID="locate-me" small variant="secondary" icon="crosshair" label={busy ? 'جاري التحديد…' : coords ? 'حدّث موقعي' : 'موقعي الحالي'} disabled={busy} onPress={locate} />
        {link ? <Button testID="open-maps" small variant="ghost" icon="external-link" label="فتح في خرائط قوقل" onPress={() => Linking.openURL(link).catch(() => setNote('تعذر فتح خرائط قوقل'))} /> : null}
      </Row>
      {!coords && !mapUrl ? <Sub style={{ marginTop: 4 }}>أو الصق في الخانة رابط الموقع أو إحداثياته من خرائط قوقل.</Sub> : null}
      {note ? <Sub style={{ marginTop: 4 }}>{note}</Sub> : null}
      {coords || mapUrl ? (
        <View testID="location-pin" style={{ marginTop: 8, backgroundColor: C.subtle, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 8, gap: 8 }}>
          {coords ? <MapPreview coords={coords} /> : null}
          <Row gap={8}>
            <Icon name="map-pin" size={15} color={C.green} />
            <T style={{ flex: 1, fontSize: 13 }} numberOfLines={1}>{coords ? '⁦' + formatCoords(coords) + '⁩' : 'رابط خرائط قوقل محفوظ'}</T>
            <Button
              testID="location-clear"
              small
              variant="ghost"
              label="إزالة"
              onPress={() => {
                onCoords(undefined);
                onMapUrl(undefined);
                setNote(null);
              }}
            />
          </Row>
        </View>
      ) : null}
    </View>
  );
}
