// ── 统计卡片（StatCard） ──
/**
 * 用于展示单个统计指标的卡片组件，包含图标、标签和数值。
 * 可选支持点击交互，按下时带缩放动画反馈。
 */

import React from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, BorderRadius, Shadows, Spacing } from '../styles/theme';
import { useFadeIn, useScale } from '../styles/animations';
import { useResponsive, moderateScale } from '../utils/responsive';

/** StatCard 组件属性 */
interface StatCardProps {
  icon: string;                // 图标名称（Ionicons）
  label: string;               // 指标标签文字
  value: string | number;      // 指标数值
  color?: string;              // 主题色，默认 Colors.primary
  onPress?: () => void;        // 点击回调（可选，不传则为纯展示）
}

const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  color = Colors.primary,
  onPress,
}) => {
  const { opacity, translateY } = useFadeIn();
  const { scale, scaleDown, scaleUp } = useScale();
  const { isTablet, fontSize, iconSize } = useResponsive();

  // ── 卡片内容（淡入动画） ──
  const content = (
    <Animated.View
      style={[
        styles.card,
        Shadows.subtle,
        { opacity, transform: [{ translateY }], padding: Spacing.lg },
      ]}
    >
      {/* 图标容器 */}
      <View style={[styles.iconContainer, { backgroundColor: color + '18', width: iconSize.container.md, height: iconSize.container.md }]}>
        <Ionicons name={icon as any} size={iconSize.lg} color={color} />
      </View>
      <Text style={[styles.label, { fontSize: fontSize.caption }]}>{label}</Text>
      <Text
        style={[styles.value, { color: Colors.title, fontSize: fontSize.h2 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
    </Animated.View>
  );

  // 无点击回调时直接返回纯展示
  if (!onPress) return content;

  // 带缩放反馈的点击卡片
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      onPressIn={scaleDown}
      onPressOut={scaleUp}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {content}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.smallCard,
    padding: Spacing.lg,
    alignItems: 'flex-start',
  },
  iconContainer: {
    borderRadius: BorderRadius.iconContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    color: Colors.caption,
    marginBottom: Spacing.xs,
  },
  value: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
  },
});

export default StatCard;
