import { ReactNode } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

// Native Liquid Glass needs iOS 26+ and an Xcode 26+ build; resolved once.
const HAS_LIQUID_GLASS = isLiquidGlassAvailable();

type Props = ViewProps & {
  /** Light/dark appearance of the glass. */
  tint?: 'light' | 'dark';
  children?: ReactNode;
};

/**
 * A glass surface. Uses real iOS 26 Liquid Glass when available, otherwise a
 * frosted blur with a hand-drawn highlight so older iOS versions still look right.
 * Pass layout / radius / padding in `style`; the border and highlight are added
 * automatically for the fallback only.
 */
export function Glass({ tint = 'light', style, children, ...rest }: Props) {
  if (HAS_LIQUID_GLASS) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme={tint} style={style} {...rest}>
        {children}
      </GlassView>
    );
  }
  return (
    <BlurView intensity={70} tint={tint} style={[style, styles.fallback]} {...rest}>
      <View style={styles.specular} />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  fallback: {
    overflow:    'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  specular: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          '50%',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
