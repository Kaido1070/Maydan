import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { type Coords } from '../domain/geo';
import { C } from './theme';

function regionFor(coords?: Coords): Region {
  return coords
    ? { latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.009, longitudeDelta: 0.009 }
    : { latitude: 23.9, longitude: 45.1, latitudeDelta: 18, longitudeDelta: 18 };
}

export function MapPreview({ coords, selected = coords, onPick }: {
  coords?: Coords;
  selected?: Coords;
  onPick?: (coords: Coords) => void;
}) {
  const map = useRef<MapView>(null);
  const lat = coords?.lat;
  const lng = coords?.lng;
  useEffect(() => {
    if (lat !== undefined && lng !== undefined) map.current?.animateToRegion(regionFor({ lat, lng }));
  }, [lat, lng]);

  return (
    <View style={{ height: onPick ? 260 : 170, borderRadius: 14, overflow: 'hidden', backgroundColor: C.track }}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={regionFor(coords)}
        scrollEnabled={!!onPick}
        zoomEnabled={!!onPick}
        rotateEnabled={false}
        pitchEnabled={false}
        showsPointsOfInterests={false}
        onPress={onPick ? ({ nativeEvent: { coordinate } }) => onPick({ lat: coordinate.latitude, lng: coordinate.longitude }) : undefined}
      >
        {selected ? <Marker coordinate={{ latitude: selected.lat, longitude: selected.lng }} /> : null}
      </MapView>
    </View>
  );
}
