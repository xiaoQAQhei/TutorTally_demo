// ── 提示消息（Toast） ──
/**
 * 短暂的弹出提示组件，从屏幕底部滑入，2.5 秒后自动消失。
 * 支持成功/错误两种类型，带对应图标和颜色。
 * 使用绝对定位而非 Modal，
 * 配合高 zIndex 浮在所有内容之上，且不阻挡触摸事件。
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../styles/theme';
import { useResponsive, verticalScale } from '../utils/responsive';

/** Toast 组件属性 */
interface ToastProps {
  visible: boolean;            // 是否显示
  message: string;             // 提示文字
  type?: 'success' | 'error'; // 类型：成功/错误，默认 error
  onDismiss: () => void;       // 消失回调
}

const Toast: React.FC<ToastProps> = ({ visible, message, type = 'error', onDismiss }) => {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const { isTablet, maxContentWidth, iconSize } = useResponsive();

  // 平板端限制最大宽度
  const toastMaxWidth = isTablet ? Math.min(maxContentWidth * 0.8, 500) : undefined;

  // ── 显示时：滑入 → 2.5s 后滑出 → 触发 onDismiss ──
  useEffect(() => {
    if (visible) {
      // 滑入动画
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 3 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      // 2.5 秒后自动滑出并关闭
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 100, duration: 200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => onDismiss());
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const iconName = type === 'success' ? 'checkmark-circle' : 'alert-circle';

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.container,
          { opacity, transform: [{ translateY }] },
          type === 'success' ? styles.successBg : styles.errorBg,
          toastMaxWidth ? { maxWidth: toastMaxWidth, alignSelf: 'center' } : null,
        ]}
      >
        <Ionicons name={iconName} size={iconSize.md} color={Colors.white} />
        <Text style={styles.message}>{message}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end',
    paddingBottom: verticalScale(70), paddingHorizontal: Spacing.xl,
    marginHorizontal: Spacing.xxl,
    zIndex: 99999, elevation: 99999,  // 极高层级，浮在所有内容之上
  },
  container: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.button,
    gap: Spacing.sm,
    ...Shadows.floating,
  },
  errorBg: { backgroundColor: Colors.danger },
  successBg: { backgroundColor: Colors.paid },
  message: { flex: 1, fontSize: FontSize.body, color: Colors.white, fontWeight: FontWeight.medium },
});

export default Toast;
