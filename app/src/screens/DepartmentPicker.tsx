import React from 'react';
import { ScrollView, View } from 'react-native';
import { currentSlot } from '../domain/shifts';
import { useStore } from '../store';
import { C, Icon, IconName, Sub, T } from '../ui/kit';
import { Touch } from '../ui/touch';

/** اختيار القسم: أزرار مدمجة في صف واحد قابل للتمرير، مع نقطة خضراء للقسم اللي فيه شفت شغال. */
export function DepartmentPicker({ value, onChange, icon }: { value: string | null; onChange: (id: string) => void; icon: IconName }) {
  const { ws, now } = useStore();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {ws.departments.map((department) => {
        const active = department.id === value;
        const slot = currentSlot(ws, department, now);
        return (
          <Touch
            key={department.id}
            testID={'dept-' + department.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={department.name + (slot ? '، شفت شغال: ' + slot.shift?.name : '، لا يوجد شفت الآن')}
            onPress={() => onChange(department.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              minHeight: 44,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? C.purple : C.line,
              backgroundColor: active ? C.purple : C.white,
            }}
          >
            <Icon name={icon} size={15} color={active ? C.white : C.purple} />
            <T style={{ fontWeight: '700', color: active ? C.white : C.ink }}>{department.name}</T>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: slot ? '#2fbf71' : '#c9c4d6' }} />
          </Touch>
        );
      })}
      <View style={{ justifyContent: 'center', paddingHorizontal: 4 }}>
        <Sub style={{ fontSize: 11 }}>● شفت شغال</Sub>
      </View>
    </ScrollView>
  );
}
