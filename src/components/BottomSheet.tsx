/**
 * ── BottomSheet.tsx ───────────────────────────────────────────────────
 * 通用底部弹出面板组件，从屏幕底部滑入显示内容。
 * 支持动画弹出/收起、平板自适应宽度、可滚/不可滚内容区域。
 * ────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated,
  ScrollView, useWindowDimensions, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontWeight, BorderRadius, Shadows } from '../styles/theme';
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
  const { isTablet, maxContentWidth, spacing, fontSize, iconSize } = useResponsive();

  // ── 平板端限制面板宽度 ──
  const sheetWidth = isTablet ? maxContentWidth : undefined;

  // ── 响应式尺寸 ──
  const handleW = scale(isTablet ? 48 : 36);       // 拖拽手柄宽度
  const handleH = verticalScale(4);                  // 拖拽手柄高度
  const closeBtnSize = scale(isTablet ? 44 : 36);   // 关闭按钮尺寸

  // 面板基础高度，根据 heightFactor 动态计算
  const sheetHeight = useMemo(() => screenH * heightFactor, [screenH, heightFactor]);

  // ── 控制出场动画完成前保持渲染 ──
  const [rendering, setRendering] = useState(false);

  // ── 动画值 ──
  const translateY = useRef(new Animated.Value(sheetHeight)).current; // 垂直偏移
  const overlayOpacity = useRef(new Animated.Value(0)).current;       // 遮罩透明度
  const heightOffset = useRef(new Animated.Value(0)).current;         // 上拉延展高度
  const baseHeight = useRef(new Animated.Value(sheetHeight)).current; // 面板基础高度（动画版）
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // baseHeight 跟随 sheetHeight 变化
  useEffect(() => { baseHeight.setValue(sheetHeight); }, [sheetHeight]);

  // ── 三档快照位置（占屏比） ──
  const SNAP_FRACTIONS = [0.5, 0.82, 0.95];
  const snapTarget = (currentFraction: number): { tY: number; hOff: number } => {
    // 找到最近的档位
    const nearest = SNAP_FRACTIONS.reduce((a, b) =>
      Math.abs(a - currentFraction) < Math.abs(b - currentFraction) ? a : b
    );
    if (nearest <= 0.5) return { tY: sheetHeight - screenH * nearest, hOff: 0 };
    return { tY: 0, hOff: screenH * nearest - sheetHeight };
  };

  // ── 拖拽手势 ──
  const startY = useRef(0);
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      translateY.stopAnimation();
      startY.current = (translateY as any)._value || 0;
    },
    onPanResponderMove: (_, gs) => {
      if (gs.dy < 0) {
        // 上拉：面板延展
        heightOffset.setValue(Math.min(Math.abs(gs.dy), screenH * 0.4));
        translateY.setValue(0);
      } else {
        // 下拉：先收回延展，再下移面板
        const curOff = (heightOffset as any)._value || 0;
        if (curOff > 0) {
          const shrink = Math.min(gs.dy, curOff);
          heightOffset.setValue(curOff - shrink);
          translateY.setValue(gs.dy - shrink);
        } else {
          translateY.setValue(gs.dy);
        }
      }
    },
    onPanResponderRelease: () => {
      const curTY = (translateY as any)._value || 0;
      const curOff = (heightOffset as any)._value || 0;
      const currentFraction = (sheetHeight + curOff - curTY) / screenH;
      // 面板可见比例 < 35% → 关闭
      if (currentFraction < 0.35) {
        Animated.timing(translateY, { toValue: sheetHeight, duration: 200, useNativeDriver: true })
          .start(() => { setRendering(false); closeRef.current(); });
        return;
      }
      // 快照到最近档位
      const target = snapTarget(currentFraction);
      Animated.parallel([
        Animated.timing(heightOffset, { toValue: target.hOff, duration: 200, useNativeDriver: false }),
        Animated.timing(translateY, { toValue: target.tY, duration: 200, useNativeDriver: true }),
      ]).start();
    },
  })).current;

  // ── 可见性变化时触发入场/出场动画 ──
  useEffect(() => {
    if (visible) {
      setRendering(true);
      heightOffset.setValue(0);
      translateY.setValue(sheetHeight);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1, duration: 300, useNativeDriver: true,
        }),
      ]).start();
    } else if (rendering) {
      heightOffset.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: sheetHeight, duration: 250, useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0, duration: 250, useNativeDriver: true,
        }),
      ]).start(() => setRendering(false));
    }
  }, [visible, sheetHeight, rendering]);

  // ── 响应式样式 ──
  const styles = useMemo(() => ({
    container: { flex: 1, justifyContent: 'flex-end' },                                              // 页面容器，底部对齐
    sheet: {                                                                                         // 面板主体
      backgroundColor: Colors.card,
      borderTopLeftRadius: BorderRadius.card + 4,
      borderTopRightRadius: BorderRadius.card + 4,
      ...Shadows.floating,
    },
    handleContainer: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.xs },    // 拖拽手柄容器
    handle: {                                                                                        // 拖拽手柄
      width: handleW, height: handleH, borderRadius: 2, backgroundColor: Colors.divider,
    },
    header: {                                                                                        // 标题栏
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: spacing.xl, paddingBottom: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: Colors.divider,
    },
    headerTitle: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },         // 标题文字
    closeButton: {                                                                                   // 关闭按钮
      width: closeBtnSize, height: closeBtnSize, borderRadius: closeBtnSize / 2,
      backgroundColor: Colors.divider, justifyContent: 'center', alignItems: 'center',
    },
    content: {
      flex: 1, paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg, paddingTop: spacing.sm,
    },                                                                                                // 内容区域
  } as const), [spacing, fontSize, handleW, handleH, closeBtnSize]);

  if (!rendering) return null;

  return (
    <Modal visible={rendering} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* ── 遮罩：固定拦截触摸 + 动画透明度 ── */}
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.overlay, opacity: overlayOpacity }]} />
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </View>

        {/* ── 面板主体（外层：原生驱动 translateY） ── */}
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }, sheetWidth ? { width: sheetWidth, alignSelf: "center", borderBottomLeftRadius: BorderRadius.card + 4, borderBottomRightRadius: BorderRadius.card + 4 } : null]}>
          {/* ── 内层：JS 驱动 height ── */}
          <Animated.View style={[{ height: Animated.add(baseHeight, heightOffset) }]}>
          {/* 顶部拖拽区（手柄 + 标题栏，整个区域可拖） */}
          <View {...panResponder.panHandlers}>
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>
            <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={iconSize.md} color={Colors.title} />
            </TouchableOpacity>
          </View>
          </View>

          {/* 内容区域 */}
          {scrollable ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
              {children}
            </ScrollView>
          ) : (
            <View style={styles.content}>{children}</View>
          )}
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default BottomSheet;
