import type { ColorValue, NativeSyntheticEvent, ViewProps } from 'react-native';
import type { ThemeMode } from './theme';

export type NativeTabBarProps = ViewProps & {
  items: { id: string; title: string; symbol: string }[];
  selection: string;
  colorScheme: ThemeMode;
  selectionColor: ColorValue;
  onTabSelect: (event: NativeSyntheticEvent<{ id: string }>) => void;
};

export const hasNativeTabBar = false;
export const NativeTabBar: (props: NativeTabBarProps) => null = () => null;
