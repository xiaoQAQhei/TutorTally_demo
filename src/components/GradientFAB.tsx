import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, BorderRadius } from '../styles/theme';
import { usePulse, useBounce } from '../styles/animations';

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
  position = { bottom: 24, right: 24 },
}) => {
  const { pulse } = usePulse();
  const { scale, bounce } = useBounce(onPress);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: position.bottom,
          right: position.right,
          transform: [{ scale: Animated.multiply(pulse, scale) }],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.button, { backgroundColor: color, shadowColor: color }]}
        activeOpacity={0.9}
        onPress={bounce}
      >
        <Ionicons name={icon as any} size={28} color={Colors.white} />
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
    width: 60,
    height: 60,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.floating,
  },
});

export default GradientFAB;
