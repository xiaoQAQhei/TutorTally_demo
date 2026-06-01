// ── 渐变浮动操作按钮（GradientFAB） ──
/**
 * 悬浮在页面右下角的操作按钮，支持脉冲动画和按下弹跳效果。
 * 导出位置常量供其他组件同步使用。
 */

import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, BorderRadius } from '../styles/theme';
import { usePulse, useBounce } from '../styles/animations';
import { useResponsive, moderateScale } from '../utils/responsive';

// ── FAB 位置常量（供其他组件同步定位用） ──
export const FAB_BASE_SIZE = 60;           // 按钮基准尺寸（moderateScale 缩放）
export const FAB_BOTTOM_PHONE = 24;        // 手机底部间距
export const FAB_BOTTOM_TABLET = 32;       // 平板底部间距
export const FAB_RIGHT_TABLET = 24;       // 平板右侧间距

/** GradientFAB 组件属性 */
interface GradientFABProps {
  icon?: string;               // 图标名称（Ionicons），默认 "add"
  onPress: () => void;         // 点击回调
  color?: string;              // 按钮背景色，默认 Colors.primary
  position?: { bottom?: number; right?: number };  // 自定义位置（可选）
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
  // 默认位置：根据设备类型自动计算
  const defaultPos = {
    bottom: isTablet ? FAB_BOTTOM_TABLET : FAB_BOTTOM_PHONE,
    right: isTablet ? 24 : contentPaddingH + 4,
  };
  const pos = position ?? defaultPos;

  // ── 脉冲与弹跳动画叠加（Reanimated DerivedValue）──
  const combinedScale = useDerivedValue(() => pulse.value * scale.value);
  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: combinedScale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: pos.bottom,
          right: pos.right,
        },
        wrapperStyle,
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
