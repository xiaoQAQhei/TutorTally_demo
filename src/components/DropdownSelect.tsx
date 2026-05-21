/**
 * ── DropdownSelect.tsx ────────────────────────────────────────────────
 * 通用下拉选择器组件：触发按钮 + Modal 浮层选项列表 + 箭头旋转动画。
 * 使用 Modal 确保浮动列表不被任何父容器裁剪或覆盖。
 * ────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontWeight, BorderRadius, Shadows } from '../styles/theme';
import { useResponsive } from '../utils/responsive';

/** 下拉选项数据结构 */
export interface DropdownOption<T = string> {
  label: string;        // 显示文字
  value: T;             // 选项值
  subtitle?: string;    // 副标题（可选）
  leftIcon?: React.ReactNode;  // 左侧图标（可选）
}

/** DropdownSelect 组件属性 */
interface DropdownSelectProps<T> {
  options: DropdownOption<T>[];
  selectedValue: T | null;
  onSelect: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
}

function DropdownSelect<T>({
  options, selectedValue, onSelect, placeholder = '请选择', disabled = false,
}: DropdownSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);                        // 实际可见态（Modal visible）
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0, width: 0 });  // 按钮屏幕位置
  const rotateAnim = useSharedValue(0);                                 // 箭头旋转动画值
  const menuAnim = useSharedValue(0);                                   // 入场/出场动画（0→1 淡入缩放）
  const triggerRef = useRef<any>(null);                                // 触发按钮 DOM 引用
  const { spacing, fontSize, iconSize, inputSize } = useResponsive();
  const selected = options.find(o => o.value === selectedValue);

  // ── 响应式样式 ──
  const styles = useMemo(() => ({
    trigger: {                                                            // 触发按钮基础样式
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      height: inputSize.input, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
      paddingHorizontal: spacing.md, backgroundColor: Colors.card, gap: spacing.xs,
    },
    triggerDisabled: { backgroundColor: Colors.background, opacity: 0.5, borderColor: Colors.divider + '60' },  // 禁用态
    triggerText: {                                                         // 触发按钮文字
      fontSize: fontSize.body, fontWeight: FontWeight.regular, color: Colors.caption, flexShrink: 1,
    },
    triggerTextSelected: { color: Colors.title, fontWeight: FontWeight.medium },  // 选中态文字
    menuBox: {                                                             // 浮动选项列表容器
      position: 'absolute',
      backgroundColor: Colors.card, borderRadius: BorderRadius.smallCard,
      borderWidth: 1, borderColor: Colors.divider, overflow: 'hidden',
      ...Shadows.floating,
    },
    optionItem: {                                                          // 单个选项行
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: spacing.sm , paddingHorizontal: spacing.sm, gap: spacing.sm,
    },
    optionItemSelected: { backgroundColor: Colors.primary + '12' },        // 选中选项背景
    optionText: { fontSize: fontSize.body, color: Colors.title, flexShrink: 1 },
    optionTextSelected: { color: Colors.primary, fontWeight: FontWeight.semiBold },  // 选中选项文字
    optionSubtitle: { fontSize: fontSize.small, color: Colors.caption, marginTop: 1 },
    emptyText: { padding: spacing.md, fontSize: fontSize.small, color: Colors.caption, textAlign: 'center' },
    divider: { borderBottomColor: Colors.divider + '50' },                 // 选项分隔线
  } as const), [spacing, fontSize]);

  /** 打开下拉菜单：测量按钮位置 → 显示 Modal → 淡入缩放动画 */
  const openMenu = useCallback(() => {
    if (disabled) return;
    triggerRef.current?.measureInWindow((x: number, y: number, w: number) => {
      setMenuPos({ left: x, top: y, width: w });
      setIsOpen(true);
      menuAnim.value = 0;
      rotateAnim.value = withSpring(1, { duration: 200, dampingRatio: 0.65 });  // 箭头快速翻转，轻微回弹
      menuAnim.value = withSpring(1, { duration: 250, dampingRatio: 0.75 });    // 菜单平滑展开，少回弹
    });
  }, [disabled, rotateAnim, menuAnim]);

  /** 关闭下拉菜单：淡出 → 隐藏 Modal */
  const closeMenu = useCallback(() => {
    rotateAnim.value = withSpring(0, { duration: 200, dampingRatio: 0.65 });
    menuAnim.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) runOnJS(setIsOpen)(false);
    });
  }, [rotateAnim, menuAnim]);

  /** 选中选项 → 回调 → 关闭菜单 */
  const handleSelect = useCallback((value: T) => {
    onSelect(value);
    closeMenu();
  }, [onSelect, closeMenu]);

  // ── reanimated 动画样式 ──
  // 箭头旋转：0°→180°
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotateAnim.value, [0, 1], [0, 180])}deg` }],
  }));

  // 菜单浮层：透明度 0→1 + 缩放 0.92→1
  const menuAnimStyle = useAnimatedStyle(() => ({
    opacity: menuAnim.value,
    transform: [{ scale: interpolate(menuAnim.value, [0, 1], [0.92, 1]) }],
  }));

  return (
    <>
      {/* ── 触发按钮 ── */}
      <TouchableOpacity
        ref={triggerRef}
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={openMenu}
        activeOpacity={0.7}
      >
        <Text style={[styles.triggerText, selected && styles.triggerTextSelected]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        {!disabled && (
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-down" size={iconSize.sm} color={Colors.caption} />
          </Animated.View>
        )}
      </TouchableOpacity>

      {/* ── Modal 浮层（盖在所有内容之上，避免被裁剪） ── */}
      <Modal visible={isOpen} transparent animationType="none" onRequestClose={closeMenu}>
        {/* 遮罩：点击外部关闭 */}
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'transparent' }} activeOpacity={1} onPress={closeMenu}>
          {/* 选项列表，定位在触发按钮正下方 */}
          <Animated.View
            style={[styles.menuBox, {
              top: menuPos.top + inputSize.input + spacing.xs, left: menuPos.left, width: menuPos.width,
            }, menuAnimStyle]}
          >
            {options.length === 0 ? (
              <Text style={styles.emptyText}>暂无数据</Text>
            ) : options.map((option, index) => {
              const isSel = option.value === selectedValue;
              return (
                <TouchableOpacity
                  key={String(option.value)}
                  style={[styles.optionItem, isSel && styles.optionItemSelected, index < options.length - 1 && styles.divider]}
                  onPress={() => handleSelect(option.value)}
                  activeOpacity={0.6}
                >
                  {/* 左侧图标（如学生头像） */}
                  {option.leftIcon || null}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionText, isSel && styles.optionTextSelected]} numberOfLines={1}>
                      {option.label}
                    </Text>
                    {option.subtitle ? <Text style={styles.optionSubtitle}>{option.subtitle}</Text> : null}
                  </View>
                  {/* 已选项打勾 */}
                  {isSel && <Ionicons name="checkmark-circle" size={iconSize.sm} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export default DropdownSelect;
