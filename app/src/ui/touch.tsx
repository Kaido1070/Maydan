import React, { useRef, useState } from 'react';
import { Animated, Platform, Pressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

const native = Platform.OS === 'ios' || Platform.OS === 'android';

/** اهتزاز خفيف حسب نوع اللمسة. على الويب ما يسوي شي. */
export const haptic = {
  /** اختيار: تبويب، خيار، مربع اختيار. */
  select: () => {
    if (native) Haptics.selectionAsync().catch(() => {});
  },
  /** ضغطة زر رئيسي. */
  tap: () => {
    if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** حفظ ناجح أو إنجاز. */
  success: () => {
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning: () => {
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type TouchProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  /** نوع الاهتزاز عند الضغط (الافتراضي بدون). */
  feedback?: 'select' | 'tap' | 'none';
  /** مقدار التصغير وقت الضغط. */
  scaleTo?: number;
};

/**
 * بديل Pressable: ينكمش شوي وقت اللمس ويرجع بنعومة (على خيط الواجهة الأصلي)،
 * مع اهتزاز اختياري. يقبل style كدالة مثل Pressable.
 */
export function Touch({ style, onPressIn, onPressOut, onPress, feedback = 'none', scaleTo = 0.97, disabled, ...props }: TouchProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const animate = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: Platform.OS !== 'web', speed: 50, bounciness: toValue === 1 ? 5 : 0 }).start();
  const resolved = typeof style === 'function' ? style({ pressed, hovered: false } as PressableStateCallbackType) : style;
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        setPressed(true);
        animate(scaleTo);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        animate(1);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (feedback !== 'none') haptic[feedback]();
        onPress?.(event);
      }}
      style={[resolved, { transform: [{ scale }] }]}
    />
  );
}
