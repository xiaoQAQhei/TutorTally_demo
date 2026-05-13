// ── 时间段选择器（TimeRangePicker） ──
/**
 * 底部弹出式时间段选择器，通过两个滚轮列分别选择开始和结束时间（时/分）。
 * 支持联动校验（结束时间不能早于开始时间），自动计算并展示时长。
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
  NativeSyntheticEvent, NativeScrollEvent, Animated,
} from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../styles/theme';
import { useResponsive, scale, verticalScale } from '../utils/responsive';

// 每行选项的基础高度
const BASE_ITEM_H = 36;

// 小时数据 0-23
const HOURS = Array.from({ length: 24 }, (_, i) => i);
// 分钟数据 0-59
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** 数字补零（两位） */
const pad = (n: number) => String(n).padStart(2, '0');

/** TimeRangePicker 组件属性 */
interface TimeRangePickerProps {
  visible: boolean;
  initialStartHour?: number;      // 初始开始小时（默认 9）
  initialStartMinute?: number;    // 初始开始分钟（默认 0）
  initialEndHour?: number;        // 初始结束小时（默认 10）
  initialEndMinute?: number;      // 初始结束分钟（默认 0）
  onConfirm: (startHour: number, startMinute: number, endHour: number, endMinute: number) => void;
  onClose: () => void;
}

/** ScrollColumn 滚轮列属性 */
interface ScrollColumnProps {
  data: number[];           // 选项数据数组
  selectedIndex: number;    // 当前选中项索引
  onSelect: (index: number) => void;  // 选中回调
  label: string;            // 列标签（如"时""分"）
}

/**
 * 可滚动的选择列组件，类似 iOS 原生滚轮选择器。
 * 支持惯性滚动、吸附效果、上下半透明遮罩。
 */
const ScrollColumn: React.FC<ScrollColumnProps> = ({ data, selectedIndex, onSelect, label }) => {
  const { isTablet, isUltraNarrow } = useResponsive();
  // ── 响应式尺寸 ──
  const itemH = verticalScale(isTablet ? 44 : isUltraNarrow ? 32 : BASE_ITEM_H);
  const colW = scale(isUltraNarrow ? 40 : isTablet ? 56 : 48);
  const pickerH = itemH * 3;

  const scrollRef = useRef<ScrollView>(null);
  const [centeredIndex, setCenteredIndex] = useState(selectedIndex);
  const isDragging = useRef(false);   // 是否正在拖拽
  const isSnapping = useRef(false);   // 是否正在吸附动画中
  const snapTimeout = useRef<NodeJS.Timeout | null>(null);

  // 每个选项对应的 scrollTo 偏移量
  const targetOffsets = data.map((_, i) => i * itemH);

  // 外部 selectedIndex 变化时：同步内部状态并滚动到对应位置
  useEffect(() => {
    setCenteredIndex(selectedIndex);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: selectedIndex * itemH, animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  // ── 记下选中索引并回调 ──
  const snapToIndex = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, data.length - 1));
    setCenteredIndex(clamped);
    onSelect(clamped);
  }, [data.length, onSelect]);

  // ── 执行吸附动画滚到指定位置 ──
  const performSnap = useCallback((index: number) => {
    if (isSnapping.current) return;
    isSnapping.current = true;
    const clamped = Math.max(0, Math.min(index, data.length - 1));
    const targetY = clamped * itemH;
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: targetY, animated: true });
    }
    snapToIndex(clamped);
    setTimeout(() => { isSnapping.current = false; }, 300);
  }, [snapToIndex, data.length]);

  // ── 滚动中实时计算居中项 ──
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (snapTimeout.current) {
      clearTimeout(snapTimeout.current);
    }
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / itemH);
    const clamped = Math.max(0, Math.min(index, data.length - 1));
    setCenteredIndex(clamped);

    // 非拖拽/吸附状态：延迟自动吸附
    if (!isDragging.current && !isSnapping.current) {
      snapTimeout.current = setTimeout(() => {
        performSnap(clamped);
      }, 150);
    }
  }, [performSnap, data.length]);

  // ── 开始拖拽：取消自动吸附定时器 ──
  const handleScrollBeginDrag = useCallback(() => {
    isDragging.current = true;
    if (snapTimeout.current) {
      clearTimeout(snapTimeout.current);
    }
  }, []);

  // ── 拖拽结束：执行吸附 ──
  const handleScrollEndDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isDragging.current = false;
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / itemH);
    performSnap(index);
  }, [performSnap]);

  // ── 惯性滚动结束：执行吸附 ──
  const handleMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isDragging.current = false;
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / itemH);
    performSnap(index);
  }, [performSnap]);

  return (
    <View style={columnStyles.container}>
      {/* 列标签 */}
      <Text style={columnStyles.label}>{label}</Text>
      <View style={[columnStyles.pickerContainer, { height: pickerH, width: colW }]}>
        {/* 可滚动的选项列表 */}
        <ScrollView
          ref={scrollRef}
          style={columnStyles.scrollView}
          showsVerticalScrollIndicator={false}
          snapToOffsets={targetOffsets}
          decelerationRate="fast"
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          bounces={false}
          contentContainerStyle={{ paddingVertical: itemH }}
        >
          {data.map((val) => (
            <View key={val} style={[columnStyles.item, { height: itemH }]}>
              <Text style={[
                columnStyles.itemText,
                val === data[centeredIndex] && columnStyles.itemTextSelected,
              ]}>
                {pad(val)}
              </Text>
            </View>
          ))}
        </ScrollView>
        {/* 上下半透明遮罩 + 中间选中框 */}
        <View style={columnStyles.mask} pointerEvents="none">
          <View style={columnStyles.maskTop} />
          <View style={[columnStyles.maskCenter, { height: itemH }]} />
          <View style={columnStyles.maskBottom} />
        </View>
      </View>
    </View>
  );
};

/** ScrollColumn 样式 */
const columnStyles = StyleSheet.create({
  container: { alignItems: 'center' },
  label: {
    fontSize: FontSize.small, fontWeight: FontWeight.semiBold,
    color: Colors.caption, marginBottom: Spacing.xs,
  },
  pickerContainer: {
    height: BASE_ITEM_H * 3, width: 48,
    position: 'relative', overflow: 'hidden',
  },
  scrollView: { flex: 1 },
  item: {
    height: BASE_ITEM_H, justifyContent: 'center', alignItems: 'center',
  },
  itemText: {
    fontSize: FontSize.h3, color: Colors.caption, fontWeight: FontWeight.medium,
  },
  // 选中项文字放大加粗
  itemTextSelected: {
    fontSize: FontSize.h1, color: Colors.title, fontWeight: FontWeight.bold,
  },
  mask: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  // 上半透明遮罩
  maskTop: {
    flex: 1,
    backgroundColor: Colors.card,
    opacity: 0.85,
  },
  // 中间选中框（带上下边框）
  maskCenter: {
    height: BASE_ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: 'transparent',
  },
  // 下半透明遮罩
  maskBottom: {
    flex: 1,
    backgroundColor: Colors.card,
    opacity: 0.85,
  },
});

const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  visible, initialStartHour = 9, initialStartMinute = 0,
  initialEndHour = 10, initialEndMinute = 0,
  onConfirm, onClose,
}) => {
  // ── 四个独立的状态：开始/结束的时/分 ──
  const [startHour, setStartHour] = useState(initialStartHour);
  const [startMin, setStartMin] = useState(initialStartMinute);
  const [endHour, setEndHour] = useState(initialEndHour);
  const [endMin, setEndMin] = useState(initialEndMinute);

  // 用 ref 保存最新值，供联动校验回调中读取（避免闭包过期问题）
  const startHourRef = useRef(startHour);
  const startMinRef = useRef(startMin);
  const endHourRef = useRef(endHour);
  const endMinRef = useRef(endMin);
  startHourRef.current = startHour;
  startMinRef.current = startMin;
  endHourRef.current = endHour;
  endMinRef.current = endMin;

  // ── 每次打开时重置为初始值 ──
  useEffect(() => {
    if (visible) {
      setStartHour(initialStartHour);
      setStartMin(initialStartMinute);
      setEndHour(initialEndHour);
      setEndMin(initialEndMinute);
    }
  }, [visible, initialStartHour, initialStartMinute, initialEndHour, initialEndMinute]);

  // ── 开始小时变化：结束时间自动跟随，保持时长不变 ──
  const handleStartHour = (val: number) => {
    setStartHour(val);
    const curStartMin = startMinRef.current;
    const curEndHour = endHourRef.current;
    const curEndMin = endMinRef.current;
    const curStartHour = startHourRef.current;
    // 当前时长（分钟），不足 30 分钟按 30 分钟算
    const curDuration = Math.max((curEndHour * 60 + curEndMin) - (curStartHour * 60 + curStartMin), 30);
    // 新结束时间 = 新开始时间 + 原时长
    const newEndTotal = val * 60 + curStartMin + curDuration;
    const clamped = Math.min(newEndTotal, 23 * 60 + 59);
    setEndHour(Math.floor(clamped / 60));
    setEndMin(clamped % 60);
  };

  // ── 开始分钟变化：结束分钟同步偏移，保持时长不变 ──
  const handleStartMin = (val: number) => {
    setStartMin(val);
    const curStartHour = startHourRef.current;
    const curEndHour = endHourRef.current;
    const curEndMin = endMinRef.current;
    const curStartMin = startMinRef.current;
    // 当前时长（分钟），不足 30 分钟按 30 分钟算
    const curDuration = Math.max((curEndHour * 60 + curEndMin) - (curStartHour * 60 + curStartMin), 30);
    // 新结束时间 = 新开始时间 + 原时长
    const newEndTotal = curStartHour * 60 + val + curDuration;
    const clamped = Math.min(newEndTotal, 23 * 60 + 59);
    setEndHour(Math.floor(clamped / 60));
    setEndMin(clamped % 60);
  };

  // ── 结束小时变化：若早于开始时间则同步回退开始时间 ──
  const handleEndHour = (val: number) => {
    const curStartHour = startHourRef.current;
    if (val < curStartHour) {
      setStartHour(val);
    }
    setEndHour(val);
  };

  // ── 结束分钟变化：若小时相同且分钟早于开始分钟则同步回退 ──
  const handleEndMin = (val: number) => {
    setEndMin(val);
    const curEndHour = endHourRef.current;
    const curStartHour = startHourRef.current;
    const curStartMin = startMinRef.current;
    if (curEndHour === curStartHour && val < curStartMin) {
      setStartMin(val);
    }
  };

  const { height: screenH, inputSize } = useResponsive();
  const sheetHeight = Math.min(screenH * 0.6, 500);

  // ── 计算时长与合法性 ──
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  const isValid = totalMinutes > 0;
  const durationText = isValid
    ? totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)} 小时${totalMinutes % 60 > 0 ? ` ${totalMinutes % 60} 分钟` : ''}`
      : `${totalMinutes} 分钟`
    : '结束时间不能早于或等于开始时间';

  // ── 弹出动画 ──
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(sheetHeight);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4 }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // ── 确认回调 ──
  const handleConfirm = () => {
    if (isValid) {
      onConfirm(startHour, startMin, endHour, endMin);
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* 半透明遮罩 */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* 底部面板 */}
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          {/* 拖拽手柄 */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {/* 开始 / 结束 两列滚轮 */}
          <View style={styles.body}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>开始</Text>
              <View style={styles.columnsRow}>
                <ScrollColumn data={HOURS} selectedIndex={startHour} onSelect={handleStartHour} label="时" />
                <View style={styles.colGap} />
                <ScrollColumn data={MINUTES} selectedIndex={startMin} onSelect={handleStartMin} label="分" />
              </View>
            </View>

            {/* 竖向分隔线 */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>结束</Text>
              <View style={styles.columnsRow}>
                <ScrollColumn data={HOURS} selectedIndex={endHour} onSelect={handleEndHour} label="时" />
                <View style={styles.colGap} />
                <ScrollColumn data={MINUTES} selectedIndex={endMin} onSelect={handleEndMin} label="分" />
              </View>
            </View>
          </View>

          {/* 时间预览 + 时长 */}
          <View style={[styles.preview, !isValid && styles.previewInvalid]}>
            <Text style={[styles.previewTime, !isValid && styles.previewTimeInvalid]}>
              {pad(startHour)}:{pad(startMin)}  ——  {pad(endHour)}:{pad(endMin)}
              {isValid ? <Text style={styles.previewDuration}>  ·  {durationText}</Text> : null}
            </Text>
            {!isValid && <Text style={styles.previewErrorText}>{durationText}</Text>}
          </View>

          {/* 确认按钮 */}
          <TouchableOpacity
            style={[styles.confirmBtn, !isValid && styles.confirmBtnDisabled, { height: inputSize.input }]}
            activeOpacity={0.8}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmText}>确认</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

/** TimeRangePicker 样式 */
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.card + 4,
    borderTopRightRadius: BorderRadius.card + 4,
    paddingBottom: Spacing.xl,
    ...Shadows.floating,
  },
  handleRow: { alignItems: 'center', paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.divider },
  body: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    gap: 0,
  },
  section: { flex: 1, alignItems: 'center' },
  sectionLabel: {
    fontSize: FontSize.caption, fontWeight: FontWeight.semiBold,
    color: Colors.primary, marginBottom: Spacing.sm,
    textTransform: 'uppercase', letterSpacing: 2,
  },
  columnsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  colGap: { width: Spacing.sm },
  // 竖向分隔线
  divider: {
    alignSelf: 'stretch', justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  dividerLine: {
    width: 1, flex: 1,
    backgroundColor: Colors.divider,
  },
  // 时间预览区域
  preview: {
    marginHorizontal: Spacing.xl, marginTop: Spacing.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.button,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
  },
  previewInvalid: { backgroundColor: Colors.danger + '15' },
  previewTime: {
    fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.primary,
  },
  previewTimeInvalid: { color: Colors.danger },
  previewDuration: {
    fontSize: FontSize.body, color: Colors.primary, fontWeight: FontWeight.semiBold,
  },
  previewErrorText: {
    fontSize: FontSize.caption, color: Colors.danger, fontWeight: FontWeight.medium,
    marginTop: Spacing.xs,
  },
  confirmBtn: {
    marginHorizontal: Spacing.xl, marginTop: Spacing.lg,
    borderRadius: BorderRadius.button,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: Colors.divider },
  confirmText: { fontSize: FontSize.body, fontWeight: FontWeight.semiBold, color: Colors.white },
});

export default TimeRangePicker;
