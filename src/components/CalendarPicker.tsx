import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../styles/theme';

const CELL_GAP = Spacing.xs;
const MAX_CARD_WIDTH = 400;

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

interface CalendarPickerProps {
  visible: boolean;
  value: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
}

const formatDate = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const CalendarPicker: React.FC<CalendarPickerProps> = ({ visible, value, onConfirm, onClose }) => {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth - Spacing.xl * 2, MAX_CARD_WIDTH);
  const cellSize = Math.floor((cardWidth - Spacing.lg * 2 - CELL_GAP * 7) / 7);

  const today = new Date();
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const initialDate = value ? new Date(value + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(initialDate.getDate());

  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const result: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(d);
    while (result.length < 42) result.push(null);
    return result;
  }, [viewYear, viewMonth]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const handleConfirm = () => {
    onConfirm(formatDate(viewYear, viewMonth, selectedDay));
    onClose();
  };

  const rows: (number | null)[][] = [];
  for (let r = 0; r < 6; r++) {
    rows.push(cells.slice(r * 7, (r + 1) * 7));
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.card, Shadows.floating, { width: cardWidth }]}>
          {/* Month Navigator */}
          <View style={styles.nav}>
            <TouchableOpacity style={styles.navButton} onPress={goToPrevMonth} activeOpacity={0.6}>
              <Ionicons name="chevron-back" size={20} color={Colors.title} />
            </TouchableOpacity>
            <Text style={styles.navTitle}>
              {viewYear}年 {viewMonth + 1}月
            </Text>
            <TouchableOpacity style={styles.navButton} onPress={goToNextMonth} activeOpacity={0.6}>
              <Ionicons name="chevron-forward" size={20} color={Colors.title} />
            </TouchableOpacity>
          </View>

          {/* Weekday Headers */}
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((d) => (
              <View key={d} style={[styles.weekdayCell, { width: cellSize }]}>
                <Text style={styles.weekdayText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Day Grid */}
          {rows.map((row, ri) => (
            <View key={ri} style={styles.gridRow}>
              {row.map((day, ci) => {
                const cellStyle = { width: cellSize, height: cellSize, borderRadius: cellSize / 2 };
                if (day === null) return <View key={`e-${ci}`} style={[styles.dayCell, cellStyle]} />;
                const dateStr = formatDate(viewYear, viewMonth, day);
                const isToday = dateStr === todayStr;
                const isSelected = day === selectedDay;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayCell, cellStyle, isSelected && styles.dayCellSelected]}
                    onPress={() => setSelectedDay(day)}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                      {day}
                    </Text>
                    {isToday && !isSelected && <View style={styles.todayDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} activeOpacity={0.8}>
              <Text style={styles.confirmText}>确定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.overlay,
    paddingHorizontal: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.card + 4,
    padding: Spacing.lg,
  },
  nav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  navButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  navTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title },
  weekdayRow: { flexDirection: 'row', marginBottom: Spacing.xs },
  weekdayCell: {
    height: 24,
    justifyContent: 'center', alignItems: 'center',
    marginHorizontal: CELL_GAP / 2,
  },
  weekdayText: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold, color: Colors.caption },
  gridRow: { flexDirection: 'row' },
  dayCell: {
    justifyContent: 'center', alignItems: 'center',
    marginHorizontal: CELL_GAP / 2,
    marginVertical: 1,
  },
  dayCellSelected: { backgroundColor: Colors.primary },
  dayText: { fontSize: FontSize.caption, color: Colors.title },
  dayTextSelected: { color: Colors.white, fontWeight: FontWeight.semiBold },
  todayDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: Colors.primary,
    position: 'absolute', bottom: 2,
  },
  actions: {
    flexDirection: 'row', gap: Spacing.md,
    marginTop: Spacing.xl, paddingTop: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  cancelButton: {
    flex: 1, height: 44, borderRadius: BorderRadius.button,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.background,
  },
  cancelText: { fontSize: FontSize.body, color: Colors.caption, fontWeight: FontWeight.medium },
  confirmButton: {
    flex: 1, height: 44, borderRadius: BorderRadius.button,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  confirmText: { fontSize: FontSize.body, color: Colors.white, fontWeight: FontWeight.semiBold },
});

export default CalendarPicker;
