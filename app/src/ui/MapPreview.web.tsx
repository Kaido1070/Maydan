import React from 'react';
import { View } from 'react-native';
import { type Coords, mapsEmbed } from '../domain/geo';
import { C } from './theme';

/** معاينة الموقع على خريطة قوقل (نسخة الويب). */
export function MapPreview({ coords }: { coords: Coords }) {
  return (
    <View style={{ height: 170, borderRadius: 14, overflow: 'hidden', backgroundColor: C.track }}>
      {React.createElement('iframe', { src: mapsEmbed(coords), title: 'خريطة الموقع', loading: 'lazy', style: { border: 0, width: '100%', height: '100%' } })}
    </View>
  );
}
