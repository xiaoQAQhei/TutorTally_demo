// ── 空状态占位组件（EmptyState） ──
/**
 * 当列表/页面没有数据时显示的占位视图。
 * 包含图标、标题、副标题和可选的操作按钮，带有淡入动画。
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../styles/theme';
import { useFadeIn } from '../styles/animations';
import { useResponsive, moderateScale } from '../utils/responsive';

/** EmptyState 组件属性 */
interface EmptyStateProps {
  icon: string;                // 显示的图标名称（Ionicons）
  title: string;               // 主标题文字
  subtitle?: string;           // 副标题文字（可选）
  buttonLabel?: string;        // 操作按钮文字（可选，不传则不显示按钮）
  onButtonPress?: () => void;  // 按钮点击回调（可选）
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  buttonLabel,
  onButtonPress,
}) => {
  const { opacity, translateY } = useFadeIn();
  const { isTablet } = useResponsive();

  // ── Reanimated 动画样式 ──
  const fadeInStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // ── 响应式图标尺寸 ──
  const iconSize = moderateScale(isTablet ? 110 : 100);
  const iconInner = isTablet ? 64 : 56;

  return (
    <Animated.View style={[styles.container, fadeInStyle]}>
      {/* 图标容器 */}
      <View style={[styles.iconContainer, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]}>
        <Ionicons name={icon as any} size={iconInner} color={Colors.caption} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {/* 可选操作按钮 */}
      {buttonLabel && onButtonPress ? (
        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={onButtonPress}>
          <Ionicons name="add-circle-outline" size={18} color={Colors.white} />
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl * 2,
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    backgroundColor: Colors.divider,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.semiBold,
    color: Colors.title,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.caption,
    color: Colors.caption,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  buttonText: {
    color: Colors.white,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semiBold,
  },
});

export default EmptyState;
