import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tone } from '../domain/stats';

export const C = {
  bg: '#f6f5f9',
  white: '#ffffff',
  ink: '#201c31',
  muted: '#68647a',
  line: '#eae7f0',
  purple: '#5636c6',
  purpleDark: '#4525ad',
  soft: '#eee9ff',
  night: '#19172c',
  green: '#17664b',
  greenBg: '#e5f6ed',
  amber: '#815300',
  amberBg: '#fff1d4',
  red: '#a12c48',
  redBg: '#fce9ee',
};

export type IconName = React.ComponentProps<typeof Feather>['name'];

export function Icon({ name, size = 18, color = C.purple }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

export function T({ style, children, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text {...props} style={[s.text, style]}>
      {children}
    </Text>
  );
}

export const Sub = ({ children, style, ...props }: React.ComponentProps<typeof Text>) => (
  <T {...props} style={[s.sub, style]}>
    {children}
  </T>
);

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({ children, style, gap = 8 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Spread({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, style]}>{children}</View>;
}

const toneColors: Record<Tone, [string, string]> = {
  green: [C.green, C.greenBg],
  amber: [C.amber, C.amberBg],
  red: [C.red, C.redBg],
};

export function Chip({ tone, label, icon }: { tone: Tone | 'neutral' | 'purple'; label: string; icon?: IconName }) {
  const [fg, bg] = tone === 'neutral' ? [C.muted, '#f0edf3'] : tone === 'purple' ? [C.purple, '#f2eefc'] : toneColors[tone];
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={11} color={fg} /> : <View style={[s.dot, { backgroundColor: fg }]} />}
      <Text style={[s.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** نص يحتوي أرقامًا بصيغة "1 / 2" بترتيب ثابت من اليسار. */
export const ratio = (value: number, max: number) => '⁦' + value + ' / ' + max + '⁩';

type ButtonVariant = 'primary' | 'secondary' | 'done' | 'danger' | 'ghost';
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  small,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const colors: Record<ButtonVariant, [string, string]> = {
    primary: [C.white, C.purple],
    secondary: ['#5133a5', '#f2edff'],
    done: [C.green, C.greenBg],
    danger: [C.red, C.redBg],
    ghost: [C.purple, 'transparent'],
  };
  const [fg, bg] = colors[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        small && s.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 13 : 15} color={fg} /> : null}
      <Text style={[s.buttonText, small && { fontSize: 12 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Avatar({ text, size = 34 }: { text: string; size?: number }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 3 }]}>
      <Text style={{ color: '#5335ae', fontWeight: '700', fontSize: size * 0.36 }}>{text}</Text>
    </View>
  );
}

export function IconBox({ name, tone = 'purple', size = 38 }: { name: IconName; tone?: 'purple' | 'green' | 'amber'; size?: number }) {
  const [fg, bg] = tone === 'green' ? ['#24754e', '#e9f7ef'] : tone === 'amber' ? ['#855200', '#fff1d8'] : [C.purple, C.soft];
  return (
    <View style={[s.iconBox, { width: size, height: size, borderRadius: size / 3.2, backgroundColor: bg }]}>
      <Icon name={name} size={size * 0.48} color={fg} />
    </View>
  );
}

export function Progress({ value, max, color = '#7653e2', track = '#eeeaf6', height = 7 }: { value: number; max: number; color?: string; track?: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (100 * value) / max) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
      style={{ height, backgroundColor: track, borderRadius: 99, overflow: 'hidden', marginVertical: 6 }}
    >
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 99 }} />
    </View>
  );
}

export function Checkbox({ checked, onChange, label, disabled, testID }: { checked: boolean; onChange: (value: boolean) => void; label?: string; disabled?: boolean; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      hitSlop={6}
      style={[s.checkbox, checked && s.checkboxOn, disabled && { opacity: 0.4 }]}
    >
      {checked ? <Icon name="check" size={15} color={C.white} /> : null}
    </Pressable>
  );
}

export function Segmented<V extends string | number>({ options, value, onChange, wrap }: { options: { value: V; label: string }[]; value: V; onChange: (value: V) => void; wrap?: boolean }) {
  return (
    <View style={[s.segmented, wrap && { flexWrap: 'wrap' }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[s.segment, wrap && { flexGrow: 0, flexBasis: 'auto' }, active && s.segmentOn]}
          >
            <Text style={[s.segmentText, active && { color: C.white }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label: string; style?: StyleProp<TextStyle> }) {
  return (
    <View style={{ gap: 4, marginBottom: 10 }}>
      <T style={s.label}>{label}</T>
      <TextInput placeholderTextColor="#a29db3" {...props} style={[s.input, style]} />
    </View>
  );
}

export function Stepper({ label, onPrev, onNext, prevDisabled, nextDisabled }: { label: string; onPrev: () => void; onNext: () => void; prevDisabled?: boolean; nextDisabled?: boolean }) {
  return (
    <Row gap={6}>
      <Pressable accessibilityLabel="السابق" accessibilityRole="button" disabled={prevDisabled} onPress={onPrev} style={[s.stepBtn, prevDisabled && { opacity: 0.4 }]}>
        <Icon name="chevron-right" size={16} color={C.ink} />
      </Pressable>
      <T style={{ fontSize: 13, minWidth: 70, textAlign: 'center' }}>{label}</T>
      <Pressable accessibilityLabel="التالي" accessibilityRole="button" disabled={nextDisabled} onPress={onNext} style={[s.stepBtn, nextDisabled && { opacity: 0.4 }]}>
        <Icon name="chevron-left" size={16} color={C.ink} />
      </Pressable>
    </Row>
  );
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <Spread style={{ marginTop: 18, marginBottom: 10, alignItems: 'flex-end' }}>
      <View style={{ flex: 1 }}>
        <T style={s.h2}>{title}</T>
        {sub ? <Sub>{sub}</Sub> : null}
      </View>
      {right}
    </Spread>
  );
}

export function Empty({ text }: { text: string }) {
  return <Sub style={{ textAlign: 'center', paddingVertical: 22 }}>{text}</Sub>;
}

/** نافذة منبثقة بشكل ورقة iOS. */
export function Sheet({ visible, title, sub, onClose, children, footer }: { visible: boolean; title: string; sub?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType={Platform.OS === 'web' ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={onClose} transparent={Platform.OS === 'web'}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[{ flex: 1 }, Platform.OS === 'web' && s.webBackdrop]}>
        <View style={[s.sheet, Platform.OS === 'web' && s.webSheet]}>
          <Spread style={s.sheetHead}>
            <View style={{ flex: 1 }}>
              <T style={s.h2}>{title}</T>
              {sub ? <Sub>{sub}</Sub> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={onClose} style={s.stepBtn} testID="sheet-close">
              <Icon name="x" size={18} color={C.ink} />
            </Pressable>
          </Spread>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={[s.sheetFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.line }} />;
}

export const s = StyleSheet.create({
  text: { color: C.ink, fontSize: 14 },
  sub: { color: C.muted, fontSize: 12, lineHeight: 18 },
  h2: { fontSize: 19, fontWeight: '800', color: C.ink },
  h3: { fontSize: 15, fontWeight: '700', color: C.ink },
  label: { fontSize: 12, fontWeight: '700', color: C.ink },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14, marginBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  chipText: { fontSize: 11, fontWeight: '700' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, paddingHorizontal: 14, minHeight: 44 },
  buttonSmall: { minHeight: 34, paddingHorizontal: 10, borderRadius: 9 },
  buttonText: { fontSize: 14, fontWeight: '700' },
  avatar: { backgroundColor: '#f1edff', alignItems: 'center', justifyContent: 'center' },
  iconBox: { alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: '#b8afd0', alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },
  checkboxOn: { backgroundColor: C.purple, borderColor: C.purple },
  segmented: { flexDirection: 'row', backgroundColor: '#ece8f5', borderRadius: 11, padding: 3, gap: 3 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingVertical: 7, paddingHorizontal: 10, minHeight: 34 },
  segmentOn: { backgroundColor: C.purple },
  segmentText: { fontSize: 13, fontWeight: '700', color: '#4a4160' },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.white, color: C.ink, paddingHorizontal: 10, minHeight: 44, fontSize: 16 },
  stepBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, backgroundColor: C.bg },
  sheetHead: { padding: 16, paddingBottom: 12, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.line },
  sheetFooter: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, gap: 8 },
  webBackdrop: { backgroundColor: '#1d123c89', justifyContent: 'flex-end' },
  webSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '92%', flex: 0, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
});
