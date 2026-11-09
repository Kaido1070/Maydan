import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { FONTS, fontFor, MIN_FONT_SIZE } from './fonts';
import { Touch } from './touch';
import { C, KIND, themed } from './theme';

export { C, KIND };

export type IconName = React.ComponentProps<typeof Feather>['name'];

export function Icon({ name, size = 18, color = C.link }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

/** نص بخط التطبيق: يختار ملف الوزن المناسب، ويضمن حجمًا مقروءًا ومسافة أسطر مريحة. */
export function AppText({ style, children, ...props }: React.ComponentProps<typeof Text>) {
  const flat = StyleSheet.flatten(style) ?? {};
  const fontSize = Math.max(MIN_FONT_SIZE, flat.fontSize ?? 15);
  const resolved: TextStyle = {
    ...flat,
    fontSize,
    fontFamily: fontFor(flat.fontWeight),
    fontWeight: 'normal',
    lineHeight: flat.lineHeight ? Math.max(flat.lineHeight, Math.round(fontSize * 1.4)) : Math.round(fontSize * 1.55),
  };
  return (
    <Text {...props} style={resolved}>
      {children}
    </Text>
  );
}

export function T({ style, children, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <AppText {...props} style={[s.text, style]}>
      {children}
    </AppText>
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

const toneColors = (tone: Tone): [string, string] => (tone === 'green' ? [C.green, C.greenBg] : tone === 'amber' ? [C.amber, C.amberBg] : [C.red, C.redBg]);

export type ChipTone = Tone | 'neutral' | 'purple' | 'visit' | 'meeting';

export function Chip({ tone, label, icon }: { tone: ChipTone; label: string; icon?: IconName }) {
  const [fg, bg] =
    tone === 'neutral' ? [C.muted, C.track] : tone === 'purple' ? [C.link, C.soft] : tone === 'visit' || tone === 'meeting' ? [KIND[tone].fg, KIND[tone].bg] : toneColors(tone);
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={11} color={fg} /> : <View style={[s.dot, { backgroundColor: fg }]} />}
      <AppText style={[s.chipText, { color: fg }]}>{label}</AppText>
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
    primary: [C.onAccent, C.purple],
    secondary: [C.link, C.soft],
    done: [C.green, C.greenBg],
    danger: [C.red, C.redBg],
    ghost: [C.link, 'transparent'],
  };
  const [fg, bg] = colors[variant];
  return (
    <Touch
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      feedback={variant === 'ghost' ? 'none' : 'tap'}
      style={({ pressed }) => [
        s.button,
        small && s.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 13 : 15} color={fg} /> : null}
      <AppText style={[s.buttonText, small && { fontSize: 13 }, { color: fg }]}>{label}</AppText>
    </Touch>
  );
}

export function Avatar({ text, size = 34 }: { text: string; size?: number }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 3 }]}>
      <AppText style={{ color: C.link, fontWeight: '700', fontSize: size * 0.36, lineHeight: size * 0.6 }}>{text}</AppText>
    </View>
  );
}

export function IconBox({ name, tone = 'purple', size = 38 }: { name: IconName; tone?: 'purple' | 'green' | 'amber' | 'visit' | 'meeting'; size?: number }) {
  const [fg, bg] =
    tone === 'green' ? [C.green, C.greenBg] : tone === 'amber' ? [C.amber, C.amberBg] : tone === 'visit' || tone === 'meeting' ? [KIND[tone].fg, KIND[tone].bg] : [C.link, C.soft];
  return (
    <View style={[s.iconBox, { width: size, height: size, borderRadius: size / 3.2, backgroundColor: bg }]}>
      <Icon name={name} size={size * 0.48} color={fg} />
    </View>
  );
}

export function Progress({ value, max, color = C.purple, track = C.track, height = 7 }: { value: number; max: number; color?: string; track?: string; height?: number }) {
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
    <Touch
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      aria-checked={checked}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      feedback="select"
      scaleTo={0.88}
      hitSlop={8}
      style={[s.checkbox, checked && s.checkboxOn, disabled && { opacity: 0.4 }]}
    >
      {checked ? <Icon name="check" size={15} color={C.onAccent} /> : null}
    </Touch>
  );
}

export function Segmented<V extends string | number>({ options, value, onChange, wrap }: { options: { value: V; label: string }[]; value: V; onChange: (value: V) => void; wrap?: boolean }) {
  return (
    <View style={[s.segmented, wrap && { flexWrap: 'wrap' }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Touch
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            feedback="select"
            style={[s.segment, wrap && s.segmentGrid, wrap && options.length > 4 && { flexBasis: '30%' }, active && s.segmentOn]}
          >
            <AppText numberOfLines={wrap ? undefined : 1} style={[s.segmentText, !wrap && options.length >= 3 && { fontSize: 13 }, active && { color: C.onAccent }]}>{option.label}</AppText>
          </Touch>
        );
      })}
    </View>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label: string; style?: StyleProp<TextStyle> }) {
  return (
    <View style={{ gap: 4, marginBottom: 10 }}>
      <T style={s.label}>{label}</T>
      <TextInput placeholderTextColor={C.placeholder} {...props} style={[s.input, style]} />
    </View>
  );
}

export function Stepper({ label, onPrev, onNext, prevDisabled, nextDisabled }: { label: string; onPrev: () => void; onNext: () => void; prevDisabled?: boolean; nextDisabled?: boolean }) {
  return (
    <Row gap={6}>
      <Touch accessibilityLabel="السابق" accessibilityRole="button" disabled={prevDisabled} onPress={onPrev} feedback="select" hitSlop={8} style={[s.stepBtn, prevDisabled && { opacity: 0.4 }]}>
        <Icon name="chevron-right" size={16} color={C.ink} />
      </Touch>
      <T style={{ fontSize: 13, minWidth: 70, textAlign: 'center' }}>{label}</T>
      <Touch accessibilityLabel="التالي" accessibilityRole="button" disabled={nextDisabled} onPress={onNext} feedback="select" hitSlop={8} style={[s.stepBtn, nextDisabled && { opacity: 0.4 }]}>
        <Icon name="chevron-left" size={16} color={C.ink} />
      </Touch>
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
            <Touch accessibilityRole="button" accessibilityLabel="إغلاق" onPress={onClose} style={s.stepBtn} testID="sheet-close">
              <Icon name="x" size={18} color={C.ink} />
            </Touch>
          </Spread>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
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

export const s = themed(() => ({
  text: { color: C.ink, fontSize: 15 },
  sub: { color: C.muted, fontSize: 13, lineHeight: 20 },
  h2: { fontSize: 19, fontWeight: '800', color: C.ink },
  h3: { fontSize: 15, fontWeight: '700', color: C.ink },
  label: { fontSize: 13, fontWeight: '700', color: C.ink },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14, marginBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  chipText: { fontSize: 12, fontWeight: '600', lineHeight: 18 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, paddingHorizontal: 14, minHeight: 44 },
  buttonSmall: { minHeight: 34, paddingHorizontal: 10, borderRadius: 9 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  avatar: { backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  iconBox: { alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: C.softLine, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },
  checkboxOn: { backgroundColor: C.purple, borderColor: C.purple },
  segmented: { flexDirection: 'row', backgroundColor: C.track, borderRadius: 11, padding: 3, gap: 3 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingVertical: 7, paddingHorizontal: 6, minHeight: 36 },
  /** وضع الشبكة: خياران في كل سطر بعرض ثابت (ما ينضغط النص على الآيفون). */
  segmentGrid: { flexGrow: 1, flexShrink: 0, flexBasis: '47%' },
  segmentOn: { backgroundColor: C.purple },
  segmentText: { fontSize: 14, fontWeight: '600', color: C.muted },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.white, color: C.ink, paddingHorizontal: 10, minHeight: 44, fontSize: 16, fontFamily: FONTS.regular },
  stepBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, backgroundColor: C.bg },
  sheetHead: { padding: 16, paddingBottom: 12, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.line },
  sheetFooter: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, gap: 8 },
  webBackdrop: { backgroundColor: '#1d123c89', justifyContent: 'flex-end' },
  webSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '92%', flex: 0, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
}) as const satisfies Record<string, object>);
