/**
 * ── BottomSheet.tsx ───────────────────────────────────────────────────
 * 通用底部弹出面板组件，从屏幕底部滑入显示内容。
 * 支持动画弹出/收起、平板自适应宽度、可滚/不可滚内容区域。
 * ────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, useWindowDimensions, PanResponder,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS, cancelAnimation, Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontWeight, BorderRadius, Shadows } from '../styles/theme';
import { useResponsive, scale, verticalScale } from '../utils/responsive';
import Toast from './Toast';

/** BottomSheet 组件属性 */
interface BottomSheetProps {
  visible: boolean;         // 是否显示
  onClose: () => void;      // 关闭回调
  title: string;            // 标题文字
  children: React.ReactNode; // 面板内容
  heightFactor?: number;    // 面板高度占屏幕比例，默认 0.82
  scrollable?: boolean;     // 内容区域是否可滚动，默认 true
  /** 表单内的 Toast 状态，渲染在 Modal 内部，确保 Android 上不被遮挡 */
  toast?: { visible: boolean; message: string; type: 'success' | 'error' };
  onToastDismiss?: () => void; // Toast 消失回调
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  visible, onClose, title, children, heightFactor = 0.82, scrollable = true,
  toast, onToastDismiss,
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

  // ── Reanimated 共享值 ──
  const translateY = useSharedValue(sheetHeight);     // 垂直偏移
  const overlayOpacity = useSharedValue(0);            // 遮罩透明度
  const heightOffset = useSharedValue(0);              // 上拉延展高度
  const baseHeight = useSharedValue(sheetHeight);      // 面板基础高度（动画版）

  // 同步 sheetHeight 到 baseHeight 共享值
  useEffect(() => { baseHeight.value = sheetHeight; }, [sheetHeight]);

  // JS 线程追踪 ref（PanResponder 手势中读取最新动画值）
  const translateYRef = useRef(sheetHeight);
  const heightOffsetRef = useRef(0);

  // 保持最新 onClose
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // ── useAnimatedStyle：驱动面板 transform ──
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // ── useAnimatedStyle：驱动面板高度（基础高度 + 延展偏移） ──
  const heightAnimatedStyle = useAnimatedStyle(() => ({
    height: baseHeight.value + heightOffset.value,
  }));

  // ── useAnimatedStyle：遮罩透明度 ──
  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

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
      // 停止正在运行的动画，读取当前值到 JS ref
      cancelAnimation(translateY);
      cancelAnimation(heightOffset);
      startY.current = translateY.value;
      translateYRef.current = translateY.value;
      heightOffsetRef.current = heightOffset.value;
    },
    onPanResponderMove: (_, gs) => {
      if (gs.dy < 0) {
        // 上拉：面板延展
        heightOffset.value = Math.min(Math.abs(gs.dy), screenH * 0.4);
        heightOffsetRef.current = heightOffset.value;
        translateY.value = 0;
        translateYRef.current = 0;
      } else {
        // 下拉：先收回延展，再下移面板
        const curOff = heightOffsetRef.current;
        if (curOff > 0) {
          const shrink = Math.min(gs.dy, curOff);
          heightOffset.value = curOff - shrink;
          heightOffsetRef.current = heightOffset.value;
          translateY.value = gs.dy - shrink;
          translateYRef.current = translateY.value;
        } else {
          translateY.value = gs.dy;
          translateYRef.current = gs.dy;
        }
      }
    },
    onPanResponderRelease: () => {
      const curTY = translateYRef.current;
      const curOff = heightOffsetRef.current;
      const currentFraction = (sheetHeight + curOff - curTY) / screenH;
      // 面板可见比例 < 35% → 关闭
      if (currentFraction < 0.35) {
        const finishClose = () => {
          setRendering(false);
          closeRef.current();
        };
        // ── 无条件回调：冷启动时动画可能被取消，finished=false 也会执行，防止 Modal 卡住 ──
        translateY.value = withTiming(sheetHeight, { duration: 200 }, () => {
          runOnJS(finishClose)();
        });
        return;
      }
      // 快照到最近档位
      const target = snapTarget(currentFraction);
      heightOffset.value = withTiming(target.hOff, { duration: 200 });
      translateY.value = withTiming(target.tY, { duration: 200 });
    },
  })).current;

  // ── 可见性变化时触发入场/出场动画 ──
  useEffect(() => {
    if (visible) {
      setRendering(true);
      heightOffset.value = 0;
      translateY.value = sheetHeight;
      overlayOpacity.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });  // 纯缓出，不露底
    } else if (rendering) {
      const finishExit = () => { setRendering(false); };
      heightOffset.value = withTiming(0, { duration: 250 });
      overlayOpacity.value = withTiming(0, { duration: 250 });
      // 无条件回调，防 finished=false 导致 Modal 不关闭
      translateY.value = withTiming(sheetHeight, { duration: 250 }, () => {
        runOnJS(finishExit)();
      });
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
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.overlay }, overlayAnimatedStyle]} />
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </View>

        {/* ── 面板主体（外层：Reanimated 驱动 translateY） ── */}
        <Animated.View style={[styles.sheet, sheetAnimatedStyle, sheetWidth ? { width: sheetWidth, alignSelf: "center", borderBottomLeftRadius: BorderRadius.card + 4, borderBottomRightRadius: BorderRadius.card + 4 } : null]}>
          {/* ── 内层：Reanimated 驱动 height（基础高度 + 延展偏移） ── */}
          <Animated.View style={[heightAnimatedStyle]}>
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

        {/* ── Toast 渲染在 Modal 内部，Android 上不被 BottomSheet 遮挡 ── */}
        {toast && (
          <Toast
            visible={toast.visible}
            message={toast.message}
            type={toast.type}
            onDismiss={onToastDismiss ?? (() => {})}
          />
        )}
      </View>
    </Modal>
  );
};

export default BottomSheet;
