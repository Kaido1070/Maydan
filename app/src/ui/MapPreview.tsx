import React from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { type Coords, mapsEmbed } from '../domain/geo';
import { C } from './theme';

/** معاينة الموقع على خريطة قوقل داخل التطبيق (للتأكد فقط، بدون تفاعل يسحب الصفحة). */
export function MapPreview({ coords }: { coords: Coords }) {
  return (
    <View style={{ height: 170, borderRadius: 14, overflow: 'hidden', backgroundColor: C.track }}>
      <WebView source={{ uri: mapsEmbed(coords) }} style={{ flex: 1, backgroundColor: 'transparent' }} scrollEnabled={false} originWhitelist={['https://*']} setSupportMultipleWindows={false} />
    </View>
  );
}
