import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, BorderRadius } from '../styles/theme';
import { usePulse, useBounce } from '../styles/animations';
import { useResponsive, moderateScale } from '../utils/responsive';

interface GradientFABProps {
  icon?: string;
  onPress: () => void;
  color?: string;
  position?: { bottom?: number; right?: number };
}

const GradientFAB: React.FC<GradientFABProps> = ({
  icon = 'add',
  onPress,
  color = Colors.primary,
  position,
}) => {
  const { pulse } = usePulse();
  const { scale, bounce } = useBounce(onPress);
  const { isTablet, isUltraNarrow, contentPaddingH, iconSize } = useResponsive();

  const btnSize = moderateScale(60);
  const defaultPos = { bottom: isTablet ? 32 : 24, right: isTablet ? 24 : contentPaddingH + 4 };
  const pos = position ?? defaultPos;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: pos.bottom,
          right: pos.right,
          transform: [{ scale: Animated.multiply(pulse, scale) }],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.button, { backgroundColor: color, shadowColor: color, width: btnSize, height: btnSize }]}
        activeOpacity={0.9}
        onPress={bounce}
      >
        <Ionicons name={icon as any} size={iconSize.xl} color={Colors.white} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 100,
  },
  button: {
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.floating,
  },
});

export default GradientFAB;
