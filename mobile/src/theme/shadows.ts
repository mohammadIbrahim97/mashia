import { Platform, ViewStyle } from 'react-native';

const ios = (opacity: number, radius: number, height: number): ViewStyle => ({
  shadowColor: '#14181A',
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height },
});

export const shadows: Record<'s1' | 's2' | 's3', ViewStyle> = {
  s1: Platform.select<ViewStyle>({
    ios: ios(0.06, 2, 1),
    android: { elevation: 1 },
    default: {},
  }) as ViewStyle,
  s2: Platform.select<ViewStyle>({
    ios: ios(0.1, 12, 4),
    android: { elevation: 4 },
    default: {},
  }) as ViewStyle,
  s3: Platform.select<ViewStyle>({
    ios: ios(0.2, 24, 8),
    android: { elevation: 8 },
    default: {},
  }) as ViewStyle,
};
