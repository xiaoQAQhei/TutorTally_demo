import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
  NativeSyntheticEvent, NativeScrollEvent, Animated,
} from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../styles/theme';

const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const pad = (n: number) => String(n).padStart(2, '0');

interface TimeRangePickerProps {
  visible: boolean;
  initialStartHour?: number;
  initialStartMinute?: number;
  initialEndHour?: number;
  initialEndMinute?: number;
  onConfirm: (startHour: number, startMinute: number, endHour: number, endMinute: number) => void;
  onClose: () => void;
}

interface ScrollColumnProps {
  data: number[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  label: string;
}

const ScrollColumn: React.FC<ScrollColumnProps> = ({ data, selectedIndex, onSelect, label }) => {
  const scrollRef = useRef<ScrollView>(null);
  const [centeredIndex, setCenteredIndex] = useState(selectedIndex);
  const isDragging = useRef(false);
  const isSnapping = useRef(false);
  const snapTimeout = useRef<NodeJS.Timeout | null>(null);

  const targetOffsets = data.map((_, i) => i * ITEM_HEIGHT);

  useEffect(() => {
    setCenteredIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    }
  }, []);

  const snapToIndex = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, data.length - 1));
    setCenteredIndex(clamped);
    onSelect(clamped);
  }, [data.length, onSelect]);

  const performSnap = useCallback((index: number) => {
    if (isSnapping.current) return;
    isSnapping.current = true;
    const clamped = Math.max(0, Math.min(index, data.length - 1));
    const targetY = clamped * ITEM_HEIGHT;
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: targetY, animated: true });
    }
    snapToIndex(clamped);
    setTimeout(() => { isSnapping.current = false; }, 300);
  }, [snapToIndex, data.length]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (snapTimeout.current) {
      clearTimeout(snapTimeout.current);
    }
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, data.length - 1));
    setCenteredIndex(clamped);

    if (!isDragging.current && !isSnapping.current) {
      snapTimeout.current = setTimeout(() => {
        performSnap(clamped);
      }, 150);
    }
  }, [performSnap, data.length]);

  const handleScrollBeginDrag = useCallback(() => {
    isDragging.current = true;
    if (snapTimeout.current) {
      clearTimeout(snapTimeout.current);
    }
  }, []);

  const handleScrollEndDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isDragging.current = false;
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    performSnap(index);
  }, [performSnap]);

  const handleMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isDragging.current = false;
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    performSnap(index);
  }, [performSnap]);

  return (
    <View style={columnStyles.container}>
      <Text style={columnStyles.label}>{label}</Text>
      <View style={columnStyles.pickerContainer}>
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
          contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        >
          {data.map((val) => (
            <View key={val} style={columnStyles.item}>
              <Text style={[
                columnStyles.itemText,
                val === data[centeredIndex] && columnStyles.itemTextSelected,
              ]}>
                {pad(val)}
              </Text>
            </View>
          ))}
        </ScrollView>
        <View style={columnStyles.mask} pointerEvents="none">
          <View style={columnStyles.maskTop} />
          <View style={columnStyles.maskCenter} />
          <View style={columnStyles.maskBottom} />
        </View>
      </View>
    </View>
  );
};

const columnStyles = StyleSheet.create({
  container: { alignItems: 'center' },
  label: {
    fontSize: FontSize.small, fontWeight: FontWeight.semiBold,
    color: Colors.caption, marginBottom: Spacing.xs,
  },
  pickerContainer: {
    height: PICKER_HEIGHT, width: 48,
    position: 'relative', overflow: 'hidden',
  },
  scrollView: { flex: 1 },
  item: {
    height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center',
  },
  itemText: {
    fontSize: FontSize.h3, color: Colors.caption, fontWeight: FontWeight.medium,
  },
  itemTextSelected: {
    fontSize: FontSize.h1, color: Colors.title, fontWeight: FontWeight.bold,
  },
  mask: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  maskTop: {
    flex: 1,
    backgroundColor: Colors.card,
    opacity: 0.85,
  },
  maskCenter: {
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: 'transparent',
  },
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
  const [startHour, setStartHour] = useState(initialStartHour);
  const [startMin, setStartMin] = useState(initialStartMinute);
  const [endHour, setEndHour] = useState(initialEndHour);
  const [endMin, setEndMin] = useState(initialEndMinute);

  const startHourRef = useRef(startHour);
  const startMinRef = useRef(startMin);
  const endHourRef = useRef(endHour);
  const endMinRef = useRef(endMin);
  startHourRef.current = startHour;
  startMinRef.current = startMin;
  endHourRef.current = endHour;
  endMinRef.current = endMin;

  useEffect(() => {
    if (visible) {
      setStartHour(initialStartHour);
      setStartMin(initialStartMinute);
      setEndHour(initialEndHour);
      setEndMin(initialEndMinute);
    }
  }, [visible, initialStartHour, initialStartMinute, initialEndHour, initialEndMinute]);

  const handleStartHour = (val: number) => {
    setStartHour(val);
    const curEndHour = endHourRef.current;
    const curStartMin = startMinRef.current;
    const curEndMin = endMinRef.current;
    if (val > curEndHour || (val === curEndHour && curStartMin > curEndMin)) {
      setEndHour(val);
      setEndMin(curStartMin);
    }
  };

  const handleStartMin = (val: number) => {
    setStartMin(val);
    const curStartHour = startHourRef.current;
    const curEndHour = endHourRef.current;
    const curEndMin = endMinRef.current;
    if (curStartHour > curEndHour || (curStartHour === curEndHour && val > curEndMin)) {
      setEndHour(curStartHour);
      setEndMin(val);
    }
  };

  const handleEndHour = (val: number) => {
    const curStartHour = startHourRef.current;
    if (val < curStartHour) {
      setStartHour(val);
    }
    setEndHour(val);
  };

  const handleEndMin = (val: number) => {
    setEndMin(val);
    const curEndHour = endHourRef.current;
    const curStartHour = startHourRef.current;
    const curStartMin = startMinRef.current;
    if (curEndHour === curStartHour && val < curStartMin) {
      setStartMin(val);
    }
  };

  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  const isValid = totalMinutes > 0;
  const durationText = isValid
    ? totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)} 小时${totalMinutes % 60 > 0 ? ` ${totalMinutes % 60} 分钟` : ''}`
      : `${totalMinutes} 分钟`
    : '结束时间不能早于或等于开始时间';

  const sheetHeight = 500;
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
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <View style={styles.body}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>开始</Text>
              <View style={styles.columnsRow}>
                <ScrollColumn data={HOURS} selectedIndex={startHour} onSelect={handleStartHour} label="时" />
                <View style={styles.colGap} />
                <ScrollColumn data={MINUTES} selectedIndex={startMin} onSelect={handleStartMin} label="分" />
              </View>
            </View>

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

          <View style={[styles.preview, !isValid && styles.previewInvalid]}>
            <Text style={[styles.previewTime, !isValid && styles.previewTimeInvalid]}>
              {pad(startHour)}:{pad(startMin)}  ——  {pad(endHour)}:{pad(endMin)}
              {isValid ? <Text style={styles.previewDuration}>  ·  {durationText}</Text> : null}
            </Text>
            {!isValid && <Text style={styles.previewErrorText}>{durationText}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, !isValid && styles.confirmBtnDisabled]}
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
  colGap: { width: 8 },
  divider: {
    alignSelf: 'stretch', justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  dividerLine: {
    width: 1, flex: 1,
    backgroundColor: Colors.divider,
  },
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
    height: 50, borderRadius: BorderRadius.button,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: Colors.divider },
  confirmText: { fontSize: FontSize.body, fontWeight: FontWeight.semiBold, color: Colors.white },
});

export default TimeRangePicker;
