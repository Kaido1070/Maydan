import React from 'react';
import { Pressable, View } from 'react-native';
import { currentSlot, shiftLabel } from '../domain/shifts';
import { useStore } from '../store';
import { C, IconBox, IconName, Sub, T } from '../ui/kit';

export function DepartmentPicker({ value, onChange, icon }: { value: string | null; onChange: (id: string) => void; icon: IconName }) {
  const { ws, now } = useStore();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      {ws.departments.map((department) => {
        const active = department.id === value;
        return (
          <Pressable
            key={department.id}
            testID={'dept-' + department.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(department.id)}
            style={{
              flexBasis: '47%',
              flexGrow: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 10,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: active ? '#9674ec' : C.line,
              backgroundColor: active ? '#f6f1ff' : C.white,
            }}
          >
            <IconBox name={icon} size={30} />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '800' }}>{department.name}</T>
              <Sub style={{ fontSize: 11 }} numberOfLines={1}>
                {shiftLabel(currentSlot(ws, department, now))}
              </Sub>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
