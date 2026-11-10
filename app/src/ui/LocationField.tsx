import React, { useRef, useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';
import * as Location from 'expo-location';
import { type Coords, formatCoords, isMapsLink, mapsLink, parseCoords } from '../domain/geo';
import { Button, C, Field, Row, Sub, T } from './kit';
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
  // خانة الإحداثي: تنكتب يدويًا «17.7264,42.2774»، أو ينلصق فيها رابط من خرائط قوقل، أو تتعبى من GPS.
  const [text, setText] = useState(coords ? formatCoords(coords) : '');
  const shown = useRef(coords);
  if (shown.current !== coords) {
    shown.current = coords;
    const typed = parseCoords(text);
    if (coords ? !typed || formatCoords(typed) !== formatCoords(coords) : !!typed) setText(coords ? formatCoords(coords) : '');
  }
  const typeCoords = (input: string) => {
    const found = parseCoords(input);
    if (found) {
      // رابط كامل انلصق: نكتب مكانه الإحداثي نفسه
      setText(/^https?:/i.test(input.trim()) ? formatCoords(found) : input);
      shown.current = found;
      onCoords(found);
      onMapUrl(undefined);
      setNote(null);
      return;
    }
    setText(input);
    if (isMapsLink(input)) {
      onMapUrl(input.trim());
      setNote('الرابط المختصر ما فيه إحداثيات. انحفظ الرابط، واكتب الإحداثي إذا تبي المعاينة.');
      return;
    }
    if (coords) {
      shown.current = undefined;
      onCoords(undefined);
    }
    if (!input.trim()) onMapUrl(undefined);
  };
  const invalid = !!text.trim() && !parseCoords(text) && !isMapsLink(text);

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
  const copyLink = async () => {
    if (!link) return;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(link);
        setNote('انسخ الرابط');
      } else await Share.share({ message: link });
    } catch {
      setNote(link);
    }
  };
  return (
    <View style={{ marginBottom: 12 }}>
      <Field label={label} value={value} onChangeText={onChange} placeholder={placeholder} maxLength={200} testID="visit-site" />
      <Field
        label="الإحداثي"
        value={text}
        onChangeText={typeCoords}
        placeholder="17.7264,42.2774"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        maxLength={400}
        testID="visit-coords"
        style={{ textAlign: 'left', writingDirection: 'ltr' }}
      />
      {invalid ? <T style={{ color: C.red, fontSize: 12, marginTop: -6, marginBottom: 6 }}>اكتب الإحداثي بهالشكل: 17.7264,42.2774</T> : null}
      <Row gap={8} style={{ marginTop: -4, flexWrap: 'wrap' }}>
        <Button testID="locate-me" small variant="secondary" icon="crosshair" label={busy ? 'جاري التحديد…' : coords ? 'حدّث من موقعي' : 'موقعي الحالي'} disabled={busy} onPress={locate} />
      </Row>
      {!coords && !mapUrl ? <Sub style={{ marginTop: 4 }}>اضغط «موقعي الحالي»، أو اكتب الإحداثي، أو الصق رابط الموقع من خرائط قوقل.</Sub> : null}
      {note ? <Sub style={{ marginTop: 4 }}>{note}</Sub> : null}
      {link ? (
        <View testID="location-pin" style={{ marginTop: 8, backgroundColor: C.subtle, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 10, gap: 8 }}>
          {coords ? <MapPreview coords={coords} /> : null}
          <Sub style={{ fontWeight: '700' }}>رابط خرائط قوقل</Sub>
          <T testID="maps-link" selectable numberOfLines={2} style={{ fontSize: 13, color: C.link, textAlign: 'left', writingDirection: 'ltr' }}>{link}</T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Button testID="open-maps" small variant="secondary" icon="external-link" label="فتح" onPress={() => Linking.openURL(link).catch(() => setNote('تعذر فتح خرائط قوقل'))} />
            <Button testID="copy-maps" small variant="secondary" icon="copy" label="نسخ الرابط" onPress={copyLink} />
            <Button
              testID="location-clear"
              small
              variant="ghost"
              label="إزالة"
              onPress={() => {
                shown.current = undefined;
                setText('');
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
