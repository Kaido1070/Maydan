import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { type Coords } from '../domain/geo';
import { C } from './theme';

const FIELD_REGION: Region = { latitude: 17.84, longitude: 42.19, latitudeDelta: 0.58, longitudeDelta: 0.58 };

function regionFor(coords?: Coords, span = 0.009): Region {
  return coords ? { latitude: coords.lat, longitude: coords.lng, latitudeDelta: span, longitudeDelta: span } : FIELD_REGION;
}

export function MapPreview({ coords, selected = coords, center, onInteract, onPick }: {
  coords?: Coords;
  selected?: Coords;
  center?: Coords;
  onInteract?: () => void;
  onPick?: (coords: Coords) => void;
}) {
  const map = useRef<MapView>(null);
  useEffect(() => {
    if (center ?? coords) map.current?.animateToRegion(regionFor(center ?? coords, center ? 0.035 : 0.009), 250);
  }, [center, coords]);

  return (
    <View onTouchStart={onInteract} style={{ height: onPick ? 260 : 170, borderRadius: 14, overflow: 'hidden', backgroundColor: C.track }}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={regionFor(center ?? coords, center ? 0.035 : 0.009)}
        scrollEnabled={!!onPick}
        zoomEnabled={!!onPick}
        rotateEnabled={false}
        pitchEnabled={false}
        showsPointsOfInterests={false}
        onPanDrag={onInteract}
        onPress={onPick ? ({ nativeEvent: { coordinate } }) => onPick({ lat: coordinate.latitude, lng: coordinate.longitude }) : undefined}
      >
        {center ? (
          <Marker coordinate={{ latitude: center.lat, longitude: center.lng }} anchor={{ x: 0.5, y: 0.5 }} title="موقعك التقريبي" tracksViewChanges={false}>
            <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: C.onAccent, backgroundColor: C.brand }} />
          </Marker>
        ) : null}
        {selected ? <Marker coordinate={{ latitude: selected.lat, longitude: selected.lng }} /> : null}
      </MapView>
    </View>
  );
}
