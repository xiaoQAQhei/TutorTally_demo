// ── 底部弹出面板（BottomSheet） ──
/**
 * 通用的底部弹出面板组件，从屏幕底部滑入显示内容。
 * 支持动画弹出/收起、平板自适应宽度、可滚/不可滚内容区域。
 */

import React, { useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated,
  ScrollView, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../styles/theme';
import { useResponsive, scale, verticalScale } from '../utils/responsive';

/** BottomSheet 组件属性 */
interface BottomSheetProps {
  visible: boolean;         // 是否显示
  onClose: () => void;      // 关闭回调
  title: string;            // 标题文字
  children: React.ReactNode; // 面板内容
  heightFactor?: number;    // 面板高度占屏幕比例，默认 0.82
  scrollable?: boolean;     // 内容区域是否可滚动，默认 true
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  visible, onClose, title, children, heightFactor = 0.82, scrollable = true,
}) => {
  const { height: screenH } = useWindowDimensions();
  const { isTablet, maxContentWidth } = useResponsive();

  // ── 平板端限制面板宽度 ──
  const sheetWidth = isTablet ? maxContentWidth : undefined;

  // ── 响应式尺寸 ──
  const handleW = scale(isTablet ? 48 : 36);
  const handleH = verticalScale(4);
  const closeBtnSize = scale(isTablet ? 44 : 36);

  // 面板高度，根据 heightFactor 动态计算
  const sheetHeight = useMemo(() => screenH * heightFactor, [screenH, heightFactor]);

  // ── 动画值 ──
  const translateY = useRef(new Animated.Value(sheetHeight)).current; // 垂直偏移（初始在屏幕外）
  const overlayOpacity = useRef(new Animated.Value(0)).current;       // 遮罩透明度

  // ── 可见性变化时触发滑入/滑出动画 ──
  useEffect(() => {
    if (visible) {
      // 弹出：弹簧效果滑入 + 淡入遮罩
      translateY.setValue(sheetHeight);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1, duration: 300, useNativeDriver: true,
        }),
      ]).start();
    } else {
      // 收起：滑出屏幕 + 淡出遮罩
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: sheetHeight, duration: 250, useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0, duration: 250, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, sheetHeight]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* ── 半透明遮罩，点击关闭 ── */}
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* ── 面板主体 ── */}
        <Animated.View
          style={[
            styles.sheet,
            { height: sheetHeight, transform: [{ translateY }] },
            // 平板端居中显示
            sheetWidth ? {
              width: sheetWidth,
              alignSelf: 'center',
              borderBottomLeftRadius: BorderRadius.card + 4,
              borderBottomRightRadius: BorderRadius.card + 4,
            } : null,
          ]}
        >
          {/* 顶部拖拽手柄 */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { width: handleW, height: handleH }]} />
          </View>

          {/* 标题栏 + 关闭按钮 */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              style={[styles.closeButton, { width: closeBtnSize, height: closeBtnSize, borderRadius: closeBtnSize / 2 }]}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color={Colors.title} />
            </TouchableOpacity>
          </View>

          {/* 内容区域：根据 scrollable 决定是否可滚动 */}
          {scrollable ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
              {children}
            </ScrollView>
          ) : (
            <View style={styles.content}>{children}</View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.card + 4,
    borderTopRightRadius: BorderRadius.card + 4,
    ...Shadows.floating,
  },
  handleContainer: { alignItems: 'center', paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.divider },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  title: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },
  closeButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.divider, justifyContent: 'center', alignItems: 'center',
  },
  content: { flex: 1, paddingHorizontal: Spacing.xl,paddingBottom: Spacing.lg },
});

export default BottomSheet;
