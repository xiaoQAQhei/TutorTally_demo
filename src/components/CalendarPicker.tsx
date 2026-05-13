// ── 日历日期选择器（CalendarPicker） ──
/**
 * 模态弹窗形式的日历组件，用于选择单个日期。
 * 支持上/下月切换、显示当天标记、选中高亮，返回值格式 "YYYY-MM-DD"。
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../styles/theme';
import { useResponsive, scale, verticalScale, moderateScale } from '../utils/responsive';

// 日期格子之间的间距
const CELL_GAP = Spacing.xs;

// 星期表头（周一 ~ 周日）
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

/** CalendarPicker 组件属性 */
interface CalendarPickerProps {
  visible: boolean;                        // 是否显示弹窗
  value: string;                           // 当前选中的日期（"YYYY-MM-DD"）
  onConfirm: (date: string) => void;       // 确认选择回调
  onClose: () => void;                     // 关闭回调
}

/** 将年月日格式化为 "YYYY-MM-DD" */
const formatDate = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * CalendarPicker 组件
 * 模态弹窗形式的日历选择器，支持上/下月切换、当天标记、选中高亮。
 * @param visible 是否显示弹窗
 * @param value 当前选中日期（"YYYY-MM-DD"）
 * @param onConfirm 确认选择回调
 * @param onClose 关闭回调
 */
const CalendarPicker: React.FC<CalendarPickerProps> = ({ visible, value, onConfirm, onClose }) => {
  const { width: screenWidth, isTablet, isUltraNarrow } = useResponsive();

  // ── 响应式尺寸计算 ──
  const maxCardW = isTablet ? 800 : Math.min(screenWidth - Spacing.xl * 2, 400);  // 卡片最大宽度
  const cardWidth = Math.min(screenWidth - Spacing.xl * 2, maxCardW);             // 卡片实际宽度
  const navBtnSize = scale(isTablet ? 44 : isUltraNarrow ? 32 : 36);             // 导航按钮大小
  const weekdayH = verticalScale(24);                                              // 星期表头高度
  const dotSize = moderateScale(4);                                                // 当天标记圆点大小
  const actionBtnH = scale(isTablet ? 48 : 44);                                    // 底部操作按钮高度
  // 每个日期格子的尺寸（根据卡片宽度、内边距和间距反算）
  const cellSize = Math.floor((cardWidth - Spacing.lg * 2 - CELL_GAP * 7) / 7);

  // ── 响应式样式（替代静态 StyleSheet） ──
  // ── 响应式样式（替代静态 StyleSheet，用 useMemo 避免重复创建） ──
  const s = useMemo(() => ({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.overlay, paddingHorizontal: Spacing.xl },                                      // 全屏遮罩
    card: { backgroundColor: Colors.card, borderRadius: BorderRadius.card + 4, padding: Spacing.lg },                                                                             // 日历卡片
    nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },                                                               // 月份导航栏
    navButton: { width: navBtnSize, height: navBtnSize, borderRadius: navBtnSize / 2, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },        // 左右切换月份按钮
    navTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title },                                                                                  // 年月标题
    weekdayRow: { flexDirection: 'row', marginBottom: Spacing.xs },                                                                                                              // 星期表头行
    weekdayCell: { width: cellSize, height: weekdayH, justifyContent: 'center', alignItems: 'center', marginHorizontal: CELL_GAP / 2 },                                           // 星期格子
    weekdayText: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold, color: Colors.caption },                                                                            // 星期文字
    gridRow: { flexDirection: 'row' },                                                                                                                                            // 日期网格行
    dayCell: { justifyContent: 'center', alignItems: 'center', marginHorizontal: CELL_GAP / 2, marginVertical: 1 },                                                                // 单个日期格子
    dayCellSelected: { backgroundColor: Colors.primary },                                                                                                                         // 选中高亮
    dayText: { fontSize: FontSize.caption, color: Colors.title },                                                                                                                 // 日期数字
    dayTextSelected: { color: Colors.white, fontWeight: FontWeight.semiBold },                                                                                                    // 选中日期文字
    todayDot: { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: Colors.primary, position: 'absolute', bottom: 2 },                                    // 当天标记小圆点
    actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.divider },                          // 底部操作按钮区
    cancelButton: { flex: 1, height: actionBtnH, borderRadius: BorderRadius.button, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },           // 取消按钮
    cancelText: { fontSize: FontSize.body, color: Colors.caption, fontWeight: FontWeight.medium },                                                                                // 取消文字
    confirmButton: { flex: 1, height: actionBtnH, borderRadius: BorderRadius.button, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary },            // 确定按钮
    confirmText: { fontSize: FontSize.body, color: Colors.white, fontWeight: FontWeight.semiBold },                                                                               // 确定文字
  } as const), [navBtnSize, weekdayH, cellSize, actionBtnH, dotSize]);

  const today = new Date();
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  // ── 状态：当前浏览的年/月 和 选中的日期 ──
  // 初始值优先使用传入的 value，否则取今天
  const initialDate = value ? new Date(value + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());    // 当前浏览的年份
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());     // 当前浏览的月份（0=1月）
  const [selectedDay, setSelectedDay] = useState<number>(initialDate.getDate()); // 选中的日期

  // ── 生成当前月份的日期格子数组（null 表示占位，数字表示日期） ──
  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    // 将周日（0）转为 6，周一~周六对应 0~5
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const result: (number | null)[] = [];
    // 月初空白占位
    for (let i = 0; i < startOffset; i++) result.push(null);
    // 日期数字
    for (let d = 1; d <= daysInMonth; d++) result.push(d);
    // 补齐到 42 格（6 行 x 7 列）
    while (result.length < 42) result.push(null);
    return result;
  }, [viewYear, viewMonth]);

  // ── 切换到上个月 ──
  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };

  // ── 切换到下个月 ──
  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  // ── 确认选择 ──
  const handleConfirm = () => {
    onConfirm(formatDate(viewYear, viewMonth, selectedDay));
    onClose();
  };

  // ── 将一维 cells 拆分为 6 行 x 7 列的二维数组 ──
  const rows: (number | null)[][] = [];
  for (let r = 0; r < 6; r++) {
    rows.push(cells.slice(r * 7, (r + 1) * 7));
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        {/* 点击遮罩关闭 */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[s.card, Shadows.floating]}>
          {/* ── 月份导航 ── */}
          <View style={s.nav}>
            <TouchableOpacity
              style={s.navButton}
              onPress={goToPrevMonth} activeOpacity={0.6}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.title} />
            </TouchableOpacity>
            <Text style={s.navTitle}>
              {viewYear}年 {viewMonth + 1}月
            </Text>
            <TouchableOpacity
              style={s.navButton}
              onPress={goToNextMonth} activeOpacity={0.6}
            >
              <Ionicons name="chevron-forward" size={20} color={Colors.title} />
            </TouchableOpacity>
          </View>

          {/* ── 星期表头 ── */}
          <View style={s.weekdayRow}>
            {WEEKDAYS.map((d) => (
              <View key={d} style={s.weekdayCell}>
                <Text style={s.weekdayText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* ── 日期网格 ── */}
          {rows.map((row, ri) => (
            <View key={ri} style={s.gridRow}>
              {row.map((day, ci) => {
                const cellStyle = { width: cellSize, height: cellSize, borderRadius: cellSize / 2 };
                // null 表示占位空格
                if (day === null) return <View key={`e-${ci}`} style={[s.dayCell, cellStyle]} />;
                const dateStr = formatDate(viewYear, viewMonth, day);
                const isToday = dateStr === todayStr;
                const isSelected = day === selectedDay;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[s.dayCell, cellStyle, isSelected && s.dayCellSelected]}
                    onPress={() => setSelectedDay(day)}
                    activeOpacity={0.6}
                  >
                    <Text style={[s.dayText, isSelected && s.dayTextSelected]}>
                      {day}
                    </Text>
                    {/* 当天标记小圆点（选中状态不显示） */}
                    {isToday && !isSelected && (
                      <View style={s.todayDot} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* ── 底部操作按钮 ── */}
          <View style={s.actions}>
            <TouchableOpacity style={s.cancelButton} onPress={onClose} activeOpacity={0.7}>
              <Text style={s.cancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmButton} onPress={handleConfirm} activeOpacity={0.8}>
              <Text style={s.confirmText}>确定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CalendarPicker;
