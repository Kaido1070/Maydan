import React from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { type Coords, mapsEmbed } from '../domain/geo';
import { C } from './theme';

// Metro loads the native Apple Maps picker from MapPreview.ios.tsx on iOS.
export function MapPreview({ coords }: {
  coords?: Coords;
  selected?: Coords;
  center?: Coords;
  onInteract?: () => void;
  onPick?: (coords: Coords) => void;
}) {
  if (!coords) return null;
  return (
    <View style={{ height: 170, borderRadius: 14, overflow: 'hidden', backgroundColor: C.track }}>
      <WebView source={{ uri: mapsEmbed(coords) }} style={{ flex: 1, backgroundColor: 'transparent' }} scrollEnabled={false} originWhitelist={['https://*']} setSupportMultipleWindows={false} />
    </View>
  );
}
