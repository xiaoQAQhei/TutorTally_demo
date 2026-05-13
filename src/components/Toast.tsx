// ── 提示消息（Toast） ──
/**
 * 短暂的弹出提示组件，从屏幕底部滑入，2.5 秒后自动消失。
 * 支持成功/错误两种类型，带对应图标和颜色。
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Modal } from 'react-native';
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
  const { isTablet, maxContentWidth } = useResponsive();

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
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.wrapper}>
        <Animated.View
          style={[
            styles.container,
            { opacity, transform: [{ translateY }] },
            type === 'success' ? styles.successBg : styles.errorBg,
            toastMaxWidth ? { maxWidth: toastMaxWidth, alignSelf: 'center' } : null,
          ]}
        >
          <Ionicons name={iconName} size={18} color={Colors.white} />
          <Text style={styles.message}>{message}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1, justifyContent: 'flex-end',
    paddingBottom: verticalScale(70), paddingHorizontal: Spacing.xl,
    marginHorizontal:Spacing.xxl,
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
