import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, BorderRadius } from '../styles/theme';
import { usePulse, useBounce } from '../styles/animations';
import { useResponsive, moderateScale } from '../utils/responsive';

// ── FAB 位置常量（供其他组件同步定位用） ──
export const FAB_BASE_SIZE = 60;           // 按钮基准尺寸（moderateScale 缩放）
export const FAB_BOTTOM_PHONE = 24;        // 手机底部间距
export const FAB_BOTTOM_TABLET = 32;       // 平板底部间距
export const FAB_RIGHT_TABLET = 24;       // 平板右侧间距

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

  const btnSize = moderateScale(FAB_BASE_SIZE);
  const defaultPos = { bottom: isTablet ? FAB_BOTTOM_TABLET : FAB_BOTTOM_PHONE, right: isTablet ? 24 : contentPaddingH + 4 };
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
