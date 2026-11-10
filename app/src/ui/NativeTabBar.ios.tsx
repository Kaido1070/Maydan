import { requireNativeView, requireOptionalNativeModule } from 'expo';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import type { NativeTabBarProps } from './NativeTabBar';

export const hasNativeTabBar = isLiquidGlassAvailable() && !!requireOptionalNativeModule('MaydanTabBar');
export const NativeTabBar = hasNativeTabBar
  ? requireNativeView<NativeTabBarProps>('MaydanTabBar', 'MaydanTabBarView')
  : () => null;
