import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';
import * as Location from 'expo-location';
import { type Coords, formatCoords, isMapsLink, mapsLink, parseCoords } from '../domain/geo';
import { Button, C, Field, Progress, Row, Sub, T } from './kit';
import { MapPreview } from './MapPreview';
import { haptic } from './touch';

const SEARCH_MS = 15_000;
const TARGET_ACCURACY_M = 25;

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
  const [stage, setStage] = useState<'permission' | 'searching' | 'done' | null>(null);
  const [progress, setProgress] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [pin, setPin] = useState<Coords>();
  const search = useRef<(() => void) | null>(null);
  const requestId = useRef(0);
  const address = useRef(value);
  const automaticAddress = useRef<string | null>(null);
  useEffect(() => { address.current = value; }, [value]);
  const busy = stage === 'permission' || stage === 'searching';

  useEffect(() => () => {
    requestId.current += 1;
    search.current?.();
  }, []);

  const resetSearch = () => {
    requestId.current += 1;
    search.current?.();
    setStage(null);
    setNote(null);
  };
  const [note, setNote] = useState<string | null>(null);
  // خانة الإحداثي: تنكتب يدويًا «17.7264,42.2774»، أو ينلصق فيها رابط من خرائط قوقل، أو تتعبى من GPS.
  const [text, setText] = useState(coords ? formatCoords(coords) : '');
  const [shown, setShown] = useState(coords);
  if (shown !== coords) {
    setShown(coords);
    const typed = parseCoords(text);
    if (coords ? !typed || formatCoords(typed) !== formatCoords(coords) : !!typed) setText(coords ? formatCoords(coords) : '');
  }
  const updateAddress = (input: string) => {
    address.current = input;
    onChange(input);
  };
  const clearAutomaticAddress = () => {
    if (automaticAddress.current !== null && automaticAddress.current === address.current) updateAddress('');
    automaticAddress.current = null;
  };
  const selectCoords = (found: Coords, input = formatCoords(found)) => {
    clearAutomaticAddress();
    setText(input);
    setShown(found);
    onCoords(found);
    onMapUrl(undefined);
  };
  const typeCoords = (input: string) => {
    resetSearch();
    setPicking(false);
    const found = parseCoords(input);
    if (found) {
      selectCoords(found, /^https?:/i.test(input.trim()) ? formatCoords(found) : input);
      return;
    }
    setText(input);
    if (coords) {
      clearAutomaticAddress();
      setShown(undefined);
      onCoords(undefined);
    }
    if (isMapsLink(input)) {
      onMapUrl(input.trim());
      setNote('انحفظ الرابط. اكتب الإحداثي أو اختر نقطة من الخريطة إذا تبي تحددها بدقة.');
    } else {
      onMapUrl(undefined);
    }
  };
  const invalid = !!text.trim() && !parseCoords(text) && !isMapsLink(text);

  const locate = async () => {
    if (search.current) return;
    const id = ++requestId.current;
    let subscription: Location.LocationSubscription | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let best: Location.LocationObject | undefined;
    const stop = () => {
      clearInterval(timer);
      clearTimeout(timeout);
      subscription?.remove();
      search.current = null;
    };
    search.current = stop;
    const active = () => search.current === stop;
    const fail = (message: string) => {
      if (!active()) return;
      stop();
      setStage(null);
      setNote(message);
    };
    const finish = () => {
      if (!active()) return;
      if (!best) {
        fail('ما قدر الجهاز يحدد موقعك خلال المهلة. حاول مرة ثانية أو حدد الموقع يدويًا.');
        return;
      }
      const { latitude, longitude, accuracy: meters } = best.coords;
      stop();
      selectCoords({ lat: latitude, lng: longitude });
      setProgress(100);
      setAccuracy(meters);
      setStage('done');
      haptic.success();
      // جلب العنوان في الخلفية بعد تثبيت الإحداثي، مع الحفاظ على أي وصف يكتبه المستخدم.
      if (Platform.OS !== 'web' && !address.current.trim()) {
        void Location.reverseGeocodeAsync({ latitude, longitude }).then(([place]) => {
          if (!place || requestId.current !== id || address.current.trim()) return;
          const parts = [place.district || place.subregion, place.street || place.name, place.city].filter(Boolean);
          const label = [...new Set(parts)].join('، ');
          if (label) {
            automaticAddress.current = label;
            updateAddress(label);
          }
        }).catch(() => {});
      }
    };
    const receive = (position: Location.LocationObject) => {
      if (!active()) return;
      const meters = position.coords.accuracy;
      if (!best || (meters ?? Infinity) < (best.coords.accuracy ?? Infinity)) {
        best = position;
        setAccuracy(meters);
      }
      if (Platform.OS === 'web' || (meters !== null && meters <= TARGET_ACCURACY_M)) finish();
    };

    setStage('permission');
    setProgress(0);
    setAccuracy(null);
    setNote(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!active()) return;
      if (!permission.granted) {
        fail('صلاحية الموقع غير متاحة. تقدر تحدد الموقع يدويًا أو تفعّل الصلاحية من الإعدادات.');
        return;
      }
      setStage('searching');
      const started = Date.now();
      timer = setInterval(() => setProgress(Math.min(99, Math.floor(100 * (Date.now() - started) / SEARCH_MS))), 250);
      timeout = setTimeout(finish, SEARCH_MS);
      const options = { accuracy: Location.Accuracy.High, distanceInterval: 0 };
      if (Platform.OS === 'web') {
        receive(await Location.getCurrentPositionAsync(options));
      } else {
        subscription = await Location.watchPositionAsync(options, receive, () => {
          if (best) finish();
          else fail('تعذر تحديد موقعك. تأكد أن خدمات الموقع مفعّلة أو حدده يدويًا.');
        });
        if (!active()) subscription.remove();
      }
    } catch {
      fail('تعذر تحديد موقعك. تأكد أن خدمات الموقع مفعّلة أو حدده يدويًا.');
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
      <Field label={label} value={value} onChangeText={(input) => { automaticAddress.current = null; updateAddress(input); }} placeholder={placeholder} maxLength={200} testID="visit-site" />
      <Field
        label="الإحداثي"
        value={text}
        onChangeText={typeCoords}
        placeholder="17.7264,42.2774"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
        maxLength={400}
        testID="visit-coords"
        style={{ textAlign: 'left', writingDirection: 'ltr' }}
      />
      {invalid ? <T style={{ color: C.red, fontSize: 12, marginTop: -6, marginBottom: 6 }}>اكتب الإحداثي بهالشكل: 17.7264,42.2774</T> : null}
      <Row gap={8} style={{ marginTop: -4, flexWrap: 'wrap' }}>
        <Button testID="locate-me" small variant="secondary" icon="crosshair" label={busy ? 'جاري التحديد…' : coords ? 'حدّث من موقعي' : 'موقعي الحالي'} disabled={busy || picking} onPress={locate} />
        {Platform.OS === 'ios' && !picking ? (
          <Button testID="location-map-pick" small variant="secondary" icon="map-pin" label="حدد على الخريطة" onPress={() => {
            resetSearch();
            setPin(coords);
            setPicking(true);
          }} />
        ) : null}
        {busy ? <Button small variant="ghost" label="أوقف البحث" onPress={resetSearch} /> : null}
      </Row>
      {stage === 'permission' ? <Sub style={{ marginTop: 4 }}>بانتظار إذن الموقع من الجهاز…</Sub> : null}
      {stage === 'searching' || stage === 'done' ? (
        <View testID="location-progress" style={{ marginTop: 6 }}>
          <Sub accessibilityLiveRegion="polite">{stage === 'done'
            ? accuracy === null ? 'تم تحديد الموقع · الدقة غير متاحة' : `${accuracy > TARGET_ACCURACY_M ? 'تم تحديد موقع تقريبي' : 'تم تحديد الموقع'} · الدقة المقدّرة ±${Math.round(accuracy)} م`
            : accuracy === null ? 'جاري البحث عن الموقع…' : `جاري تحسين الدقة · الدقة الحالية ±${Math.round(accuracy)} م`}</Sub>
          <Progress value={progress} max={100} color={stage === 'done' ? C.green : C.brand} />
          {stage === 'searching' ? <Sub>انقضى {progress}% من مهلة البحث</Sub> : null}
        </View>
      ) : null}
      {!coords && !mapUrl && !picking ? <Sub style={{ marginTop: 4 }}>تقدر تكتب الإحداثي أو تلصق رابط خرائط قوقل بدون استخدام موقع الجهاز.</Sub> : null}
      {note ? <Sub style={{ marginTop: 4 }}>{note}</Sub> : null}
      {picking ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          <Sub>حرّك الخريطة أو كبّرها ثم اضغط على المكان المطلوب وثبّت النقطة.</Sub>
          <MapPreview coords={coords} selected={pin} onPick={setPin} />
          {pin ? <T style={{ textAlign: 'left', writingDirection: 'ltr' }}>{formatCoords(pin)}</T> : null}
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Button testID="location-map-confirm" small icon="check" label="ثبّت النقطة" disabled={!pin} onPress={() => {
              if (!pin) return;
              selectCoords(pin);
              setPicking(false);
              setNote('تم تثبيت النقطة على الخريطة.');
            }} />
            <Button small variant="ghost" label="إلغاء" onPress={() => setPicking(false)} />
          </Row>
        </View>
      ) : null}
      {link ? (
        <View testID="location-pin" style={{ marginTop: 8, backgroundColor: C.subtle, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 10, gap: 8 }}>
          {coords && !picking ? <MapPreview coords={coords} /> : null}
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
                resetSearch();
                setPicking(false);
                clearAutomaticAddress();
                setShown(undefined);
                setText('');
                onCoords(undefined);
                onMapUrl(undefined);
              }}
            />
          </Row>
        </View>
      ) : null}
    </View>
  );
}
