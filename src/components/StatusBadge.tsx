// ── 课程状态徽章（StatusBadge） ──
/**
 * 显示课程当前状态的徽章组件，带对应颜色和图标。
 * 支持点击切换到下一个状态，带弹跳动画反馈。
 */

import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LessonStatusColors, StatusTransitions, FontSize, FontWeight, BorderRadius, Spacing } from '../styles/theme';
import { LessonStatus } from '../models';
import { useResponsive } from '../utils/responsive';

/** 各状态对应的 Ionicons 图标名称 */
const StatusIcons: Record<string, 'book' | 'time' | 'checkmark-circle' | 'close-circle' | 'wallet'> = {
  scheduled: 'book',
  completed: 'time',
  pendingPayment: 'wallet',
  paid: 'checkmark-circle',
  cancelled: 'close-circle',
};

/** StatusBadge 组件属性 */
interface StatusBadgeProps {
  status: LessonStatus;                    // 当前状态
  disabled?: boolean;                      // 是否禁用点击切换
  onToggle?: (nextStatus: LessonStatus) => void;  // 状态切换回调
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, disabled, onToggle }) => {
  const { iconSize } = useResponsive();
  const scale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;          // 呼吸动画值
  // 获取当前状态可切换到的下一个状态列表
  const nextStatuses = (StatusTransitions[status] || []) as LessonStatus[];
  const tappable = !disabled && nextStatuses.length > 0 && onToggle;

  const colors = LessonStatusColors[status];
  const label = LessonStatusColors[status].label;
  const icon = StatusIcons[status];

  // ── 点击处理：弹跳动画后触发状态切换 ──
  const handleTap = () => {
    if (!tappable || nextStatuses.length === 0) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.25, useNativeDriver: true, speed: 30, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    onToggle(nextStatuses[0]);
  };

  // ── 可点击时触发呼吸动画 ──
  useEffect(() => {
    if (tappable) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0.7, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [tappable, pulseOpacity]);

  return (
    <TouchableOpacity activeOpacity={tappable ? 0.75 : 1} onPress={handleTap} disabled={!tappable}>
      <Animated.View style={[styles.badge, { backgroundColor: colors.bg, transform: [{ scale }], opacity: pulseOpacity }]}>
        <Ionicons name={icon} size={iconSize.xs} color={colors.text} />
        <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
        {tappable && <Ionicons name="chevron-forward" size={iconSize.xs} color={colors.text} style={{ opacity: 0.6 }} />}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.pill, gap: 4 },
  text: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold },
});

export default StatusBadge;
