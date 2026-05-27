/**
 * ── 模块功能 ─────────────────────────────────────────────
 * LessonScreen - 课程管理页面
 *
 * 展示所有课程列表，支持按状态筛选（待上课/待收款/已收款/全部）。
 * 提供增删改查功能，支持课程状态流转（scheduled → completed → pendingPayment → paid）。
 * 特色交互：确认下课滑动动画、取消课程删除线动画、删除碎纸机碎片动画。
 * 从首页跳转时可接收 pendingAction（添加课程）、pendingFilter（筛选状态）和 highlight（高亮某课程）。
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Animated as RNAnimated, LayoutAnimation, Easing,
} from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, interpolateColor, runOnJS, Easing as REasing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Lesson, Student, StudentSubject, LessonStatus } from '../models';
import { addLesson, getAllLessons, updateLesson, deleteLesson, setLessonStatus, getAllStudents, getSubjectsByStudentId } from '../database';
import { useAction } from '../contexts/ActionContext';
import GradientFAB, { FAB_BASE_SIZE, FAB_BOTTOM_PHONE, FAB_BOTTOM_TABLET, FAB_RIGHT_TABLET } from '../components/GradientFAB';
import BottomSheet from '../components/BottomSheet';
import CalendarPicker from '../components/CalendarPicker';
import TimeRangePicker from '../components/TimeRangePicker';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../contexts/ToastContext';
import StudentAvatar from '../components/StudentAvatar';
import EmptyState from '../components/EmptyState';
import DropdownSelect from '../components/DropdownSelect';
import {
  Colors, FontWeight, BorderRadius, Shadows, LessonStatusColors,
} from '../styles/theme';
import { useShatterManager } from '../utils/animationHooks';
import { useBatchAnim } from '../styles/animations';
import { ShredderStrip } from '../components/ShredderStrip';
import { scale, moderateScale, useResponsive } from '../utils/responsive';

/** 筛选状态：待上课 / 待收款 / 已收款 / 全部 */
type FilterStatus = 'upcoming' | 'unpaid' | 'paid' | 'all';

const FILTER_OPTIONS: { key: FilterStatus; label: string; color: string }[] = [
  { key: 'upcoming', label: '待上课', color: '#6366F1' },
  { key: 'unpaid', label: '待收款', color: Colors.pending },
  { key: 'paid', label: '已收款', color: Colors.paid },
  { key: 'all', label: '全部', color: '#6b7280' },
];

const LessonScreen: React.FC = () => {
  // ═══════════════ 课程与筛选 ═══════════════
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('upcoming');

  // Tab 滑块（点击时动画，替代 scrollX.interpolate）
  const tabSliderPos = useSharedValue(0);
  const switchTab = useCallback((key: FilterStatus) => {
    setFilterStatus(key);
    const idx = FILTER_OPTIONS.findIndex(o => o.key === key);
    tabSliderPos.value = withTiming(idx, { duration: 200 });
  }, []);

  // ═══════════════ 表单状态 ═══════════════
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [tabBarW, setTabBarW] = useState(0);
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [duration, setDuration] = useState('');
  const [lessonRate, setLessonRate] = useState('');
  const [notes, setNotes] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const { showToast } = useToast();

  // ═══════════════ 跨页面交互 ═══════════════
  const { pendingAction, clearAction, pendingFilter, clearFilter, highlightLessonId, clearHighlight, confirmBeforeChange } = useAction();
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const highlightAnim = useSharedValue(0);
  const calArrowRot = useSharedValue(0);
  const timeArrowRot = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);

  // ═══════════════ 响应式 ═══════════════
  const { maxContentWidth, spacing, fontSize, isTablet, iconSize, contentPaddingH, inputSize } = useResponsive();
  const itemHeightRef = useRef(180);
  const cardWidthRef = useRef<Map<number, number>>(new Map());
  const cardHeightRef = useRef<Map<number, number>>(new Map());
  const cardPosRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const [showScrollTop, setShowScrollTop] = useState(false);

  // ═══════════════ 计数徽章上浮动画 ═══════════════
  const badgeAnim = useSharedValue(0);
  const badgeAnimStyle = useAnimatedStyle(() => ({
    opacity: badgeAnim.value,
    transform: [{ translateY: interpolate(badgeAnim.value, [0, 1], [8, 0]) }],
  }));
  useEffect(() => {
    badgeAnim.value = 0;
    badgeAnim.value = withTiming(1, { duration: 500, easing: REasing.out(REasing.cubic) });
  }, [filterStatus]);

  const [shredCollapsingId, setShredCollapsingId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const batchCollapseAnims = useRef<Map<number, RNAnimated.Value>>(new Map());
  const subjectsCache = useRef<Map<number, StudentSubject[]>>(new Map());
  const [currentSubjects, setCurrentSubjects] = useState<StudentSubject[]>([]);

  // ═══════════════ 响应式样式 ═══════════════
  const styles = useMemo(() => ({
    container: { flex: 1, backgroundColor: Colors.background, position: 'relative' as const, width: '100%', alignSelf: 'center' },

    // ── Tab 筛选栏 — 保留原有 tabGroup + tabSolo + slider + badge ──
    tabBarWrap: {
      paddingHorizontal: spacing.xl, paddingTop: spacing.md + spacing.sm, paddingBottom: spacing.sm,
      flexDirection: 'row', gap: spacing.sm,
    },
    tabGroup: {
      flex: 3, flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.pill,
      borderWidth: 1.5, borderColor: Colors.divider, position: 'relative' as const,
    },
    tabSolo: {
      flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.pill,
      borderWidth: 1.5, borderColor: Colors.divider, position: 'relative' as const,
      alignItems: 'center', justifyContent: 'center',
    },
    tabBtn: {
      flex: 1, paddingVertical: spacing.sm + 2,
      alignItems: 'center', justifyContent: 'center', zIndex: 2,
    },
    tabBtnText: { fontSize: fontSize.caption, fontWeight: FontWeight.medium, color: Colors.caption },
    badge: {
      position: 'absolute' as const, top: -spacing.lg, alignSelf: 'center',
      width: spacing.xl, height: spacing.xl, borderRadius: scale(10),
      backgroundColor: Colors.caption, justifyContent: 'center' as const, alignItems: 'center' as const,
    },
    badgeText: { fontSize: 11, color: Colors.white, fontWeight: '600' },
    tabSlider: {
      position: 'absolute' as const, top: 2, bottom: 2, left: 2, right: 2,
      borderRadius: BorderRadius.pill - 2, zIndex: 1,
    },

    // ── 批量操作按钮 ──
    batchBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      borderRadius: BorderRadius.button, padding: spacing.sm, gap: spacing.sm, borderWidth: 1,
    },
    batchBtnWrap: { overflow: 'hidden' as const },
    batchBtnText: { fontSize: fontSize.body, fontWeight: FontWeight.semiBold },

    // ── 课程卡片 ──
    card: {
      backgroundColor: Colors.card, borderRadius: BorderRadius.card,
      padding: spacing.lg, marginBottom: spacing.md,
      position: 'relative' as const,
    },
    cardHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    studentName: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },
    subject: { fontSize: fontSize.small, color: Colors.caption, marginTop: 2 },
    cardBody: { paddingTop: spacing.sm },
    infoBoxContainer: {
      flexDirection: 'row', borderRadius: BorderRadius.smallCard, overflow: 'hidden',
    },
    infoBox: {
      flex: 1, backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.smallCard,
      padding: spacing.md, justifyContent: 'center',
    },
    infoTopRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm,
    },
    infoTopText: { fontSize: fontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.body },
    timeSlotLarge: {
      fontSize: fontSize.h1, fontWeight: FontWeight.bold, color: Colors.title,
    },
    amountBox: {
      justifyContent: 'center', alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    amountText: { fontSize: fontSize.amount, fontWeight: FontWeight.bold, color: Colors.title },
    noteRow: {
      flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
      marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider,
    },
    noteText: { fontSize: fontSize.small, color: Colors.caption, flex: 1 },
    strikethroughOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: 'center', alignItems: 'center', zIndex: 10,
      overflow: 'visible',
    },
    strikethroughLine: {
      position: 'absolute', left: -30, height: 2,
      backgroundColor: '#9CA3AF',
    },
    shatterOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'visible', zIndex: 20 },
    shredStrip: { position: 'absolute', top: 0, height: '100%', overflow: 'hidden' },
    shredInner: {
      position: 'absolute', top: 0,
      backgroundColor: Colors.card,
      padding: spacing.lg,
      borderRadius: BorderRadius.card,
    },
    strikethroughLabel: {
      fontSize: fontSize.caption, color: '#6B7280', fontWeight: FontWeight.semiBold,
      backgroundColor: '#F3F4F6', paddingHorizontal: spacing.md, paddingVertical: 2,
      borderRadius: BorderRadius.pill, overflow: 'hidden',
    },
    footerDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: spacing.md },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    actionRowLeft: { flexDirection: 'row', gap: spacing.lg },
    actionRowRight: { flexDirection: 'row', gap: spacing.lg },
    actionButton: { padding: spacing.sm },
    scrollTopBtn: {
      position: 'absolute' as const,
      bottom: (isTablet ? FAB_BOTTOM_TABLET * 2 : FAB_BOTTOM_PHONE) + FAB_BASE_SIZE + spacing.md,
      right: (isTablet ? FAB_RIGHT_TABLET : contentPaddingH + 4) + Math.round((moderateScale(FAB_BASE_SIZE) - scale(44)) / 2),
      width: scale(44), height: scale(44), borderRadius: scale(22),
      backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#D1D5DB',
      justifyContent: 'center', alignItems: 'center',
      ...Shadows.standard,
    },
    confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', zIndex: 200 },
    confirmBox: { backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: spacing.xxl, width: '80%' },
    confirmTitle: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: spacing.md, textAlign: 'center' },
    confirmMessage: { fontSize: fontSize.body, color: Colors.body, marginBottom: spacing.xl, textAlign: 'center' },
    confirmButtons: { flexDirection: 'row', gap: spacing.md },
    confirmCancelBtn: { flex: 1, height: scale(46), borderRadius: scale(23), backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
    confirmCancelText: { fontSize: fontSize.body, color: Colors.caption, fontWeight: FontWeight.medium },
    confirmOkBtn: { flex: 1, height: scale(46), borderRadius: scale(23), backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    confirmOkText: { fontSize: fontSize.body, color: Colors.white, fontWeight: FontWeight.semiBold },
    datePickerButton: {
      flexDirection: 'row', alignItems: 'center',
      height: inputSize.input, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
      paddingHorizontal: spacing.md, backgroundColor: Colors.card, gap: spacing.sm,
    },
    formCardWrapper: { backgroundColor: Colors.primary + '15', borderRadius: BorderRadius.card, padding: spacing.md },
    datePickerText: { flex: 1, fontSize: fontSize.body, color: Colors.title },
    datePickerPlaceholder: { color: Colors.caption },
    formLabel: { fontSize: fontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.body, marginBottom: spacing.sm, marginTop: spacing.md },
    pickerButton: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      height: inputSize.input, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
      paddingHorizontal: spacing.md, backgroundColor: Colors.background,
    },
    pickerSelected: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    pickerText: { fontSize: fontSize.body, color: Colors.title, fontWeight: FontWeight.medium },
    pickerPlaceholder: { fontSize: fontSize.body, color: Colors.caption },
    input: {
      height: inputSize.input, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
      paddingHorizontal: spacing.md, fontSize: fontSize.body, color: Colors.title,
      backgroundColor: Colors.background,
    },
    textArea: { height: inputSize.textArea, paddingTop: spacing.md, textAlignVertical: 'top' },
    formRow: { flexDirection: 'row', gap: spacing.md },
    formHalf: { flex: 1 },
    rateInput: { textAlign: 'center', fontWeight: FontWeight.semiBold },
    amountPreview: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: Colors.paidLight, borderRadius: BorderRadius.button,
      padding: spacing.lg, marginTop: spacing.md,
    },
    amountPreviewLabel: { fontSize: fontSize.body, color: Colors.body, fontWeight: FontWeight.medium },
    amountPreviewValue: { fontSize: fontSize.h2, fontWeight: FontWeight.bold, color: Colors.paid },
    saveButton: {
      backgroundColor: Colors.primary, height: inputSize.saveButton, borderRadius: BorderRadius.button,
      justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl,
    },
    saveButtonText: { color: Colors.white, fontSize: fontSize.body, fontWeight: FontWeight.semiBold },
    studentItem: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
      paddingHorizontal: spacing.md, borderRadius: BorderRadius.smallCard, gap: spacing.md,
    },
    studentItemActive: { backgroundColor: Colors.primaryLight },
    studentItemInfo: { flex: 1 },
    studentItemName: { fontSize: fontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title },
    studentItemSubject: { fontSize: fontSize.small, color: Colors.caption, marginTop: 2 },
  } as const), [spacing, fontSize, iconSize, isTablet, contentPaddingH, inputSize]);

  // ═══════════════ Tab 滑块动画 ═══════════════
  const tabSliderGroupStyle = useAnimatedStyle(() => {
    const idx = tabSliderPos.value;
    if (tabBarW <= 0) return {};
    const slotW = tabBarW / 3;
    return {
      width: interpolate(idx, [0, 1, 2, 3], [slotW, slotW, slotW, 0]),
      backgroundColor: interpolateColor(idx, [0, 1, 2, 3],
        [FILTER_OPTIONS[0].color, FILTER_OPTIONS[1].color, FILTER_OPTIONS[2].color, FILTER_OPTIONS[3].color],
      ),
      transform: [{ translateX: interpolate(idx, [0, 1, 2, 3], [0, slotW, 2 * slotW, 3 * slotW]) }],  // idx=3 时滑出右边界，向右收缩
      opacity: interpolate(idx, [2, 3], [1, 0]),
    };
  });
  const tabSliderSoloStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tabSliderPos.value, [0, 1, 2, 3],
      [FILTER_OPTIONS[0].color, FILTER_OPTIONS[1].color, FILTER_OPTIONS[2].color, FILTER_OPTIONS[3].color],
    ),
    opacity: interpolate(tabSliderPos.value, [2, 3], [0, 1]),
  }));

  // ═══════════════ 动画 refs ═══════════════
  const [morphing, setMorphing] = useState<{ id: number; targetStatus: LessonStatus } | null>(null);
  const slideTestAnims = useRef<Map<number, RNAnimated.Value>>(new Map());
  const slideOpacityAnims = useRef<Map<number, RNAnimated.Value>>(new Map());
  const shatterMgr = useShatterManager();
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const cancelAnims = useRef<Map<number, { anim: RNAnimated.Value; width: number }>>(new Map());
  const containerRef = useRef<View>(null);
  const containerOffRef = useRef({ x: 0, y: 0 });
  const cardRefs = useRef<Map<number, any>>(new Map());
  const [shredPortal, setShredPortal] = useState<{
    pageX: number; pageY: number; cardW: number; cardH: number;
    strips: import('../utils/animationHooks').ShatterStripConfig[];
    lessonId: number;
  } | null>(null);

  // ═══════════════ 批量按钮动画 ═══════════════
  const cpl = useBatchAnim(2000);
  const coll = useBatchAnim(2000);
  const cplWrapStyle = useAnimatedStyle(() => ({ transform: [{ translateY: cpl.translateY.value }], opacity: cpl.opacity.value }));
  const collWrapStyle = useAnimatedStyle(() => ({ transform: [{ translateY: coll.translateY.value }], opacity: coll.opacity.value }));
  const highlightOverlayStyle = useAnimatedStyle(() => ({ opacity: highlightAnim.value }));
  const calArrowStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(calArrowRot.value, [0, 1], [0, 180])}deg` }] }));
  const timeArrowStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(timeArrowRot.value, [0, 1], [0, 180])}deg` }] }));
  const isCplRunning = useRef(false);
  const isCollRunning = useRef(false);

  // ═══════════════ 加载数据 ═══════════════
  useFocusEffect(useCallback(() => { loadLessons(); loadStudents(); }, []));

  const loadLessons = async () => {
    try {
      const all = await getAllLessons();
      if (!all || !Array.isArray(all)) { setLessons([]); return; }
      const now = new Date();
      for (const l of all) {
        if (l.status === 'scheduled' && l.timeSlot) {
          const endTime = l.timeSlot.split('-')[1]?.trim();
          if (endTime && now >= new Date(`${l.date}T${endTime}:00`))
            await setLessonStatus(l.id, 'completed');
        }
      }
      setLessons(await getAllLessons());
    } catch { setLessons([]); }
  };
  const loadStudents = async () => {
    try {
      const data = await getAllStudents();
      if (!data || !Array.isArray(data)) { setStudents([]); return; }
      setStudents(data);
      if (data.length > 0 && !selectedStudentId) setSelectedStudentId(data[0].id);
    } catch { setStudents([]); }
  };

  const getStudent = (studentId: number) => students.find((s) => s.id === studentId);

  // ── 按筛选条件过滤+排序 ──
  const filteredLessons = useMemo(() => {
    let filtered: Lesson[];
    if (filterStatus === 'upcoming') {
      filtered = lessons.filter((l) => l.status === 'scheduled' || l.status === 'completed');
      filtered.sort((a, b) => a.date.localeCompare(b.date) || (a.timeSlot || '').localeCompare(b.timeSlot || ''));
    } else if (filterStatus === 'unpaid') {
      filtered = lessons.filter((l) => l.status === 'pendingPayment');
      filtered.sort((a, b) => a.date.localeCompare(b.date));
    } else if (filterStatus === 'paid') {
      filtered = lessons.filter((l) => l.status === 'paid');
      filtered.sort((a, b) => b.date.localeCompare(a.date));
    } else {
      filtered = [...lessons];
      filtered.sort((a, b) => b.date.localeCompare(a.date));
    }
    return filtered;
  }, [lessons, filterStatus]);

  const counts = useMemo(() => ({
    upcoming: lessons.filter((l) => l.status === 'scheduled' || l.status === 'completed').length,
    unpaid: lessons.filter((l) => l.status === 'pendingPayment').length,
    paid: lessons.filter((l) => l.status === 'paid').length,
    all: lessons.length,
  }), [lessons]);

  const schedulableCount = lessons.filter((l) => l.status === 'completed').length;
  const collectableCount = lessons.filter((l) => l.status === 'pendingPayment').length;
  const roundDuration = (d: number) => Math.round(d * 2) / 2;
  const fmtDuration = (d: number) => (d % 1 === 0 ? `${d}h` : `${d}h`);
  const calculateAmount = () => { if (!duration) return 0; return (parseFloat(lessonRate) || 0) * parseFloat(duration); };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!selectedStudentId) missing.push('学生');
    if (!date) missing.push('日期');
    if (!timeSlot) missing.push('时段');
    if (!duration) missing.push('课时');
    if (!lessonRate) missing.push('课时费');
    if (missing.length > 0) { showToast(`请填写：${missing.join('、')}`, 'error'); return; }
    const amount = calculateAmount();
    const parts = timeSlot.split('-');
    if (parts.length === 2) {
      const [sh, sm] = parts[0].trim().split(':').map(Number);
      const [eh, em] = parts[1].trim().split(':').map(Number);
      const slotDuration = (eh + (em || 0) / 60) - (sh + (sm || 0) / 60);
      const rounded = roundDuration(slotDuration);
      if (rounded > 0 && Math.abs(rounded - parseFloat(duration)) > 0.01) {
        setDuration(rounded.toString());
        showToast(`课时已根据时段自动调整为 ${fmtDuration(rounded)}`, 'success');
        return;
      }
    }
    if (editingLesson) {
      await updateLesson({ ...editingLesson, studentId: selectedStudentId, date, timeSlot, duration: parseFloat(duration), amount, notes, studentSubjectId: selectedSubjectId || undefined });
    } else {
      await addLesson({ studentId: selectedStudentId, date, timeSlot, duration: parseFloat(duration), amount, status: 'scheduled', confirmedAt: null, notes, createdAt: new Date().toISOString(), studentSubjectId: selectedSubjectId || undefined });
    }
    setModalVisible(false); setEditingLesson(null); setSelectedSubjectId(null);
    setDate(''); setTimeSlot(''); setDuration('2'); setLessonRate(''); setNotes('');
    loadLessons();
    showToast(editingLesson ? '课程已更新' : '课程已添加', 'success');
  };

  // ═══════════════ 状态流转：右滑 + 坍缩动画链 ═══════════════
  const handleStatusChange = async (lesson: Lesson, nextStatus: LessonStatus) => {
    const doChange = () => {
      if (filterStatus !== 'all' && (nextStatus === 'completed' || nextStatus === 'pendingPayment' || nextStatus === 'paid')) {
        if (!slideTestAnims.current.has(lesson.id)) slideTestAnims.current.set(lesson.id, new RNAnimated.Value(0));
        if (!slideOpacityAnims.current.has(lesson.id)) slideOpacityAnims.current.set(lesson.id, new RNAnimated.Value(1));
        const slideX = slideTestAnims.current.get(lesson.id)!;
        const slideOp = slideOpacityAnims.current.get(lesson.id)!;
        slideX.setValue(0); slideOp.setValue(1);
        setMorphing({ id: lesson.id, targetStatus: nextStatus });
        setTimeout(() => {
          RNAnimated.parallel([
            RNAnimated.timing(slideX, { toValue: 400, duration: 350, useNativeDriver: false }),
            RNAnimated.timing(slideOp, { toValue: 0, duration: 350, useNativeDriver: false }),
          ]).start(() => {
            // 不 reset slideX/slideOp —— 否则卡片在 React 重渲染完成前置 translateX=0、全尺寸可见，产生闪烁
            // 保留 translateX=400/opacity=0，collapse 块会设透明背景，重渲染后卡片在屏幕外坍缩
            const cardH = cardHeightRef.current.get(lesson.id) || 200;
            if (!batchCollapseAnims.current.has(lesson.id)) batchCollapseAnims.current.set(lesson.id, new RNAnimated.Value(cardH));
            const collapseAnim = batchCollapseAnims.current.get(lesson.id)!;
            collapseAnim.setValue(cardH);
            setMorphing(null);  // 触发重渲染 → collapse 透明+坍缩生效，卡片在 x=400 屏幕外
            RNAnimated.timing(collapseAnim, { toValue: 0, duration: 300, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start(() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setLessons((prev) => prev.filter((x) => x.id !== lesson.id));
              slideTestAnims.current.get(lesson.id)?.setValue(0);
              batchCollapseAnims.current.delete(lesson.id);
              slideOpacityAnims.current.get(lesson.id)?.setValue(1);
              setLessonStatus(lesson.id, nextStatus).then(() => loadLessons());
            });
          });  // slide callback close
        }, 300);
      } else {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setLessonStatus(lesson.id, nextStatus).then(() => loadLessons());
      }
    };
    if (confirmBeforeChange) {
      const nextLabel = LessonStatusColors[nextStatus]?.label || nextStatus;
      setConfirmDialog({ visible: true, title: '确认操作', message: `确定要标记为「${nextLabel}」吗？`, onConfirm: doChange });
    } else { doChange(); }
  };

  const animateOneSlide = (lessonId: number, targetStatus: LessonStatus): Promise<void> => {
    return new Promise((resolve) => {
      if (!slideTestAnims.current.has(lessonId)) slideTestAnims.current.set(lessonId, new RNAnimated.Value(0));
      if (!slideOpacityAnims.current.has(lessonId)) slideOpacityAnims.current.set(lessonId, new RNAnimated.Value(1));
      const slideX = slideTestAnims.current.get(lessonId)!;
      const slideOp = slideOpacityAnims.current.get(lessonId)!;
      slideX.setValue(0); slideOp.setValue(1);
      setMorphing({ id: lessonId, targetStatus });
      setTimeout(() => {
        RNAnimated.parallel([
          RNAnimated.timing(slideX, { toValue: 400, duration: 350, useNativeDriver: true }),
          RNAnimated.timing(slideOp, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]).start(() => { resolve(); });  // 保留 slide 残留值，由 collapse 透明块接管
      }, 300);
    });
  };

  const handleBatchComplete = () => {
    if (isCplRunning.current) return;
    const doBatch = async () => {
      isCplRunning.current = true; await cpl.exit();
      const targetLessons = filteredLessons.filter((l) => l.status === 'completed');
      for (const l of targetLessons) {
        await animateOneSlide(l.id, 'pendingPayment');
        await setLessonStatus(l.id, 'pendingPayment');
        const cardH = cardHeightRef.current.get(l.id) || 200;
        if (!batchCollapseAnims.current.has(l.id)) batchCollapseAnims.current.set(l.id, new RNAnimated.Value(cardH));
        const collapseAnim = batchCollapseAnims.current.get(l.id)!;
        collapseAnim.setValue(cardH);
        setMorphing(null);  // 先触发重渲染，raf 等一帧再启动 collapse 确保 View 已绑定
        await new Promise<void>((resolve) => {
          RNAnimated.timing(collapseAnim, { toValue: 0, duration: 300, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setLessons((prev) => prev.filter((x) => x.id !== l.id));
            batchCollapseAnims.current.delete(l.id);
            slideTestAnims.current.get(l.id)?.setValue(0);
            slideOpacityAnims.current.get(l.id)?.setValue(1);
            resolve();
          });
        });
      }
      isCplRunning.current = false; loadLessons();
      showToast(`已确认 ${targetLessons.length} 节课待收款`, 'success');
    };
    if (confirmBeforeChange) {
      setConfirmDialog({ visible: true, title: '批量确认下课', message: `确定要将 ${schedulableCount} 节已下课课程转为待收款吗？`, onConfirm: doBatch });
    } else { doBatch(); }
  };

  const handleBatchCollect = () => {
    if (isCollRunning.current) return;
    const doBatch = async () => {
      isCollRunning.current = true; await coll.exit();
      const targetLessons = filteredLessons.filter((l) => l.status === 'pendingPayment');
      for (const l of targetLessons) {
        await animateOneSlide(l.id, 'paid');
        await setLessonStatus(l.id, 'paid');
        const cardH = cardHeightRef.current.get(l.id) || 200;
        if (!batchCollapseAnims.current.has(l.id)) batchCollapseAnims.current.set(l.id, new RNAnimated.Value(cardH));
        const collapseAnim = batchCollapseAnims.current.get(l.id)!;
        collapseAnim.setValue(cardH);
        setMorphing(null);  // 先触发重渲染，raf 等一帧再启动 collapse 确保 View 已绑定
        await new Promise<void>((resolve) => {
          RNAnimated.timing(collapseAnim, { toValue: 0, duration: 300, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setLessons((prev) => prev.filter((x) => x.id !== l.id));
            batchCollapseAnims.current.delete(l.id);
            slideTestAnims.current.get(l.id)?.setValue(0);
            slideOpacityAnims.current.get(l.id)?.setValue(1);
            resolve();
          });
        });
      }
      isCollRunning.current = false; loadLessons();
      showToast(`已收取 ${targetLessons.length} 节课款`, 'success');
    };
    if (confirmBeforeChange) {
      setConfirmDialog({ visible: true, title: '批量收款', message: `确定要将 ${collectableCount} 节待收款课程标记为已收款吗？`, onConfirm: doBatch });
    } else { doBatch(); }
  };

  // ═══════════════ 取消课程 ═══════════════
  const handleCancelLesson = (lesson: Lesson) => {
    const doCancel = () => {
      setCancellingId(lesson.id);
      if (!cancelAnims.current.has(lesson.id)) cancelAnims.current.set(lesson.id, { anim: new RNAnimated.Value(0), width: 0 });
      const cd = cancelAnims.current.get(lesson.id)!;
      RNAnimated.timing(cd.anim, { toValue: 1, duration: 350, useNativeDriver: false }).start(() => {
        setTimeout(() => { setCancellingId(null); setLessonStatus(lesson.id, 'cancelled').then(loadLessons); }, 800);
      });
    };
    if (confirmBeforeChange) {
      setConfirmDialog({ visible: true, title: '取消课程', message: '确定要取消这个课程吗？', onConfirm: doCancel });
    } else { doCancel(); }
  };

  const isClassEnded = (lesson: Lesson): boolean => {
    const endTime = lesson.timeSlot?.split('-')[1]?.trim();
    if (!endTime) return true;
    return new Date() >= new Date(`${lesson.date}T${endTime}:00`);
  };

  // ═══════════════ 删除课程 ═══════════════
  const handleDelete = (id: number) => {
    if (shatterMgr.activeId !== null) return;
    const doDelete = () => {
      const cardView = cardRefs.current.get(id);
      const doShatter = (x: number, y: number, cardW: number, cardH: number) => {
        // 坍缩高度动画
        if (!batchCollapseAnims.current.has(id)) batchCollapseAnims.current.set(id, new RNAnimated.Value(cardH));
        const collapseAnim = batchCollapseAnims.current.get(id)!;
        collapseAnim.setValue(cardH);
        RNAnimated.timing(collapseAnim, { toValue: 0, duration: 350, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
        // 碎纸视觉动画 → 完成后直接清理
        const strips = shatterMgr.triggerShatter(id, cardH, () => {
          setShredPortal(null); setShredCollapsingId(null); batchCollapseAnims.current.delete(id);
          cardRefs.current.delete(id); cardPosRef.current.delete(id); cardWidthRef.current.delete(id); cardHeightRef.current.delete(id);
          deleteLesson(id).then(loadLessons).catch(() => { loadLessons(); showToast('删除失败，请重试', 'error'); });
        });
        setShredPortal({ pageX: x, pageY: y, cardW, cardH, strips, lessonId: id });
      };
      // 嵌套 measure 同步获取位置（比 RAF + measureInWindow 更直接）
      if (cardView && containerRef.current) {
        (containerRef.current as any).measure((_cx: number, _cy: number, _cw: number, _ch: number, cPageX: number, cPageY: number) => {
          (cardView as any).measure((_x: number, _y: number, _w: number, _h: number, cardPageX: number, cardPageY: number) => {
            doShatter(cardPageX - cPageX, cardPageY - cPageY, _w, _h);
          });
        });
      } else {
        doShatter(0, 0, cardWidthRef.current.get(id) || 400, cardHeightRef.current.get(id) || 200);
      }
    };
    if (confirmBeforeChange) {
      setConfirmDialog({ visible: true, title: '删除课程', message: '确定要删除这个课程吗？删除后无法恢复。', onConfirm: doDelete });
    } else { doDelete(); }
  };

  const handleEdit = (lesson: Lesson) => {
    setEditingLesson(lesson); setSelectedStudentId(lesson.studentId); setSelectedSubjectId(lesson.studentSubjectId || null);
    setDate(lesson.date); setTimeSlot(lesson.timeSlot || ''); setDuration(lesson.duration.toString());
    setLessonRate(''); setNotes(lesson.notes || ''); setModalVisible(true);
  };

  const openAddModal = () => {
    setEditingLesson(null); setSelectedSubjectId(null);
    const firstStudent = students[0]; setSelectedStudentId(firstStudent?.id || null);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    setDate(tomorrow); setTimeSlot(''); setDuration('2'); setLessonRate(''); setNotes(''); setModalVisible(true);
  };

  useEffect(() => { if (pendingAction === 'addLesson') { openAddModal(); clearAction(); } }, [pendingAction]);
  useEffect(() => { if (pendingFilter) { switchTab(pendingFilter); clearFilter(); } }, [pendingFilter, clearFilter]);

  // 批量按钮：根据 filterStatus 触发入场/退场
  const prevFilterKey = useRef(filterStatus);
  useEffect(() => {
    if (prevFilterKey.current !== filterStatus) { cpl.exit(); coll.exit(); prevFilterKey.current = filterStatus; }
    if (filterStatus === 'upcoming' && schedulableCount >= 5 && !isCplRunning.current) cpl.enter();
    if (filterStatus === 'unpaid' && collectableCount >= 5 && !isCollRunning.current) coll.enter();
  }, [filterStatus, schedulableCount, collectableCount]);

  useEffect(() => {
    if (selectedStudentId === null || !modalVisible) return;
    getSubjectsByStudentId(selectedStudentId).then((subjects) => {
      subjectsCache.current.set(selectedStudentId, subjects); setCurrentSubjects(subjects);
      if (subjects.length > 0) {
        let targetSubject = subjects[0];
        if (editingLesson && editingLesson.studentSubjectId) { const found = subjects.find(s => s.id === editingLesson.studentSubjectId); if (found) targetSubject = found; }
        setSelectedSubjectId(targetSubject.id); setLessonRate(targetSubject.hourlyRate.toString());
      } else { setSelectedSubjectId(null); setLessonRate(''); }
    });
  }, [selectedStudentId, editingLesson, modalVisible]);

  useEffect(() => {
    if (highlightLessonId === null || lessons.length === 0) return;
    const idx = filteredLessons.findIndex((l) => l.id === highlightLessonId);
    if (idx !== -1) {
      highlightAnim.value = 0; setHighlightedId(highlightLessonId);
      requestAnimationFrame(() => { flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 }); });
      highlightAnim.value = withTiming(1, { duration: 400 });
      const timerId = setTimeout(() => {
        highlightAnim.value = withTiming(0, { duration: 600 }, (finished) => { if (finished) runOnJS(() => { setHighlightedId(null); clearHighlight(); })(); });
      }, 2400);
      return () => { clearTimeout(timerId); highlightAnim.value = 0; };
    }
  }, [highlightLessonId, filteredLessons, lessons, filterStatus, clearHighlight]);

  useEffect(() => { calArrowRot.value = withTiming(showCalendar ? 1 : 0, { duration: 200 }); }, [showCalendar]);
  useEffect(() => { timeArrowRot.value = withTiming(showTimePicker ? 1 : 0, { duration: 200 }); }, [showTimePicker]);

  // ═══════════════ 渲染卡片内容 ═══════════════
  const renderCardContent = (lesson: Lesson, interactive: boolean) => {
    const student = getStudent(lesson.studentId);
    const lessonId = lesson.id;
    const isMorphingCard = morphing?.id === lessonId;
    const displayStatus = isMorphingCard ? morphing!.targetStatus : lesson.status;
    const isCancelled = lesson.status === 'cancelled';
    const isCancellingCard = cancellingId === lessonId;
    const showCancelAnim = isCancelled || isCancellingCard;

    if (!cancelAnims.current.has(lessonId)) cancelAnims.current.set(lessonId, { anim: new RNAnimated.Value(0), width: 0 });
    const cancelData = cancelAnims.current.get(lessonId)!;
    if (isCancelled && !isCancellingCard) cancelData.anim.setValue(1);

    return (
      <>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {student && <StudentAvatar name={student.name} size={iconSize.avatar.md} />}
            <View>
              <Text style={[styles.studentName]}>{student?.name || '未知学生'}</Text>
              <Text style={[styles.subject]}>{student?.phone || ''}</Text>
            </View>
          </View>
          <StatusBadge status={displayStatus} disabled={!interactive || isMorphingCard || lesson.status === 'scheduled'} onToggle={!interactive || isMorphingCard ? undefined : (nextStatus: LessonStatus) => handleStatusChange(lesson, nextStatus)} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.infoBoxContainer}>
            <View style={[styles.infoBox, showCancelAnim && { backgroundColor: '#F9FAFB' }]}>
              <View style={styles.infoTopRow}>
                <Ionicons name="calendar-outline" size={iconSize.sm} color={Colors.caption} />
                <Text style={styles.infoTopText}>{lesson.date} · {fmtDuration(lesson.duration)}</Text>
              </View>
              {lesson.timeSlot ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Ionicons name="time-outline" size={iconSize.lg} color={showCancelAnim ? Colors.caption : Colors.title} />
                  <Text style={[styles.timeSlotLarge, showCancelAnim && { color: Colors.caption }]}>{lesson.timeSlot}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.amountBox}>
              <Ionicons name="wallet-outline" size={iconSize.md} color={Colors.caption} />
              <Text style={styles.amountText}>{lesson.amount.toFixed(0)}元</Text>
            </View>
          </View>
          {lesson.notes ? (
            <View style={styles.noteRow}><Ionicons name="document-text-outline" size={iconSize.xs} color={Colors.caption} /><Text style={[styles.noteText]} numberOfLines={2}>{lesson.notes}</Text></View>
          ) : null}
          {/* 取消删除线 */}
          {showCancelAnim && interactive && (
            <View style={styles.strikethroughOverlay} pointerEvents="none">
              <RNAnimated.View style={[styles.strikethroughLine, { width: cancelData.anim.interpolate({ inputRange: [0, 1], outputRange: [0, cancelData.width > 0 ? cancelData.width + 20 : (cardWidthRef.current.get(lessonId) || 400) + 20] }) }]} />
              <RNAnimated.Text style={[styles.strikethroughLabel, { opacity: cancelData.anim.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1] }) }]}>已取消</RNAnimated.Text>
            </View>
          )}
          {showCancelAnim && !interactive && isCancelled && (
            <View style={styles.strikethroughOverlay} pointerEvents="none">
              <View style={[styles.strikethroughLine, { width: (cancelData.width > 0 ? cancelData.width : (cardWidthRef.current.get(lessonId) || 400)) + 20 }]} />
              <Text style={[styles.strikethroughLabel]}>已取消</Text>
            </View>
          )}
        </View>
        <View style={styles.footerDivider} />
        <View style={styles.actionRow}>
          <View style={styles.actionRowLeft}>
            {interactive && shatterMgr.activeId === null ? (
              <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(lesson.id)}><Ionicons name="trash-outline" size={iconSize.md} color={Colors.danger} /></TouchableOpacity>
            ) : (
              <View style={styles.actionButton}><Ionicons name="trash-outline" size={iconSize.md} color={interactive ? Colors.caption : Colors.danger} /></View>
            )}
          </View>
          <View style={styles.actionRowRight}>
            {lesson.status === 'scheduled' && !isClassEnded(lesson) && (
              interactive ? (
                <TouchableOpacity style={styles.actionButton} onPress={() => handleCancelLesson(lesson)}><Ionicons name="close-circle-outline" size={iconSize.md} color={Colors.pending} /></TouchableOpacity>
              ) : (
                <View style={styles.actionButton}><Ionicons name="close-circle-outline" size={iconSize.md} color={Colors.pending} /></View>
              )
            )}
            {(lesson.status !== 'paid' && lesson.status !== 'cancelled') && (
              interactive ? (
                <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(lesson)}><Ionicons name="pencil" size={iconSize.md} color={Colors.primary} /></TouchableOpacity>
              ) : (
                <View style={styles.actionButton}><Ionicons name="pencil" size={iconSize.md} color={Colors.primary} /></View>
              )
            )}
          </View>
        </View>
      </>
    );
  };

  // ═══════════════ 渲染卡片 ═══════════════
  const renderLesson = ({ item }: { item: Lesson }) => {
    const lessonId = item.id;
    const isMorphing = morphing?.id === lessonId;
    const displayStatus = isMorphing ? morphing!.targetStatus : item.status;
    const borderColor = displayStatus === 'paid' ? Colors.paid : displayStatus === 'pendingPayment' ? Colors.pending : displayStatus === 'cancelled' ? Colors.caption : Colors.primary;
    const isCancelled = item.status === 'cancelled';
    const isCancelling = cancellingId === lessonId;
    const showCancelAnim = isCancelled || isCancelling;
    const isHighlighted = item.id === highlightedId;

    if (!slideTestAnims.current.has(lessonId)) slideTestAnims.current.set(lessonId, new RNAnimated.Value(0));
    if (!slideOpacityAnims.current.has(lessonId)) slideOpacityAnims.current.set(lessonId, new RNAnimated.Value(1));

    const cardH = cardHeightRef.current.get(lessonId) || 200;
    const cardInner = (interactive: boolean) => renderCardContent(item, interactive);
    const cardBg = showCancelAnim ? '#F3F4F6' : Colors.card;

    return (
      <RNAnimated.View
        style={[styles.card, Shadows.standard, {
          borderLeftWidth: 4, borderLeftColor: borderColor, backgroundColor: cardBg,
          opacity: isMorphing ? slideOpacityAnims.current.get(lessonId)! : showCancelAnim ? 0.6 : 1,
          transform: [{ translateX: slideTestAnims.current.get(lessonId)! }],
        }, shatterMgr.activeId === lessonId ? {
          backgroundColor: 'transparent', borderLeftWidth: 0, overflow: 'hidden',
          ...(batchCollapseAnims.current.has(lessonId) ? {
            height: batchCollapseAnims.current.get(lessonId)!,
            padding: batchCollapseAnims.current.get(lessonId)!.interpolate({ inputRange: [0, cardH], outputRange: [0, spacing.lg], extrapolate: 'clamp' }),
            marginBottom: batchCollapseAnims.current.get(lessonId)!.interpolate({ inputRange: [0, cardH], outputRange: [0, spacing.md], extrapolate: 'clamp' }),
          } : { height: 0 }),
        } : batchCollapseAnims.current.has(lessonId) ? {
          backgroundColor: 'transparent', borderLeftWidth: 0,
          height: batchCollapseAnims.current.get(lessonId)!,
          padding: batchCollapseAnims.current.get(lessonId)!.interpolate({ inputRange: [0, cardH], outputRange: [0, spacing.lg], extrapolate: 'clamp' }),
          marginBottom: batchCollapseAnims.current.get(lessonId)!.interpolate({ inputRange: [0, cardH], outputRange: [0, spacing.md], extrapolate: 'clamp' }),
          overflow: 'hidden',
        } : null]}
        ref={(el) => { if (el) cardRefs.current.set(lessonId, el); }}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height; const w = e.nativeEvent.layout.width;
          if (h > 0) itemHeightRef.current = h;
          if (w > 0) {
            cardWidthRef.current.set(lessonId, w); cardHeightRef.current.set(lessonId, h);
            if (cancelAnims.current.has(lessonId)) cancelAnims.current.get(lessonId)!.width = w;
            try { (e.target as any).measureInWindow((x: number, y: number) => { cardPosRef.current.set(lessonId, { x: x - containerOffRef.current.x, y: y - containerOffRef.current.y }); }); } catch (_) {}
          }
        }}
      >
        {isHighlighted && (
          <Reanimated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.primary + '18', borderRadius: BorderRadius.card }, highlightOverlayStyle]} pointerEvents="none" />
        )}
        <View style={shatterMgr.activeId === lessonId ? { opacity: 0 } : null}>{cardInner(true)}</View>
      </RNAnimated.View>
    );
  };

  return (
    <View style={[styles.container, { maxWidth: maxContentWidth }]} ref={containerRef} onLayout={() => { try { containerRef.current?.measureInWindow?.((x: number, y: number) => { containerOffRef.current = { x, y }; }); } catch (e) {} }}>
      {/* ── Tab 筛选栏 — 保留原样式，驱动改为 tabSliderPos ── */}
      <View style={styles.tabBarWrap}>
        <View style={styles.tabGroup} onLayout={(e) => setTabBarW(e.nativeEvent.layout.width)}>
          {tabBarW > 0 && <Reanimated.View style={[styles.tabSlider, tabSliderGroupStyle]} />}
          {FILTER_OPTIONS.slice(0, 3).map((opt) => (
            <TouchableOpacity key={opt.key} style={styles.tabBtn} activeOpacity={0.75} onPress={() => switchTab(opt.key)}>
              {filterStatus === opt.key && (
                <Reanimated.View style={[styles.badge, badgeAnimStyle]}>
                  <Text style={styles.badgeText}>{opt.key === 'upcoming' ? counts.upcoming : opt.key === 'unpaid' ? counts.unpaid : counts.paid}</Text>
                </Reanimated.View>
              )}
              <Text style={[styles.tabBtnText, filterStatus === opt.key && { color: '#FFF' }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.tabSolo} activeOpacity={0.75} onPress={() => switchTab('all')}>
          <Reanimated.View style={[styles.tabSlider, tabSliderSoloStyle]} />
          <View style={styles.tabBtn}>
            {filterStatus === 'all' && (
              <Reanimated.View style={[styles.badge, badgeAnimStyle]}><Text style={styles.badgeText}>{counts.all}</Text></Reanimated.View>
            )}
            <Text style={[styles.tabBtnText, filterStatus === 'all' && { color: '#FFF' }]}>全部</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── 单选课程列表 ── */}
      <FlatList
        ref={flatListRef} data={filteredLessons} renderItem={renderLesson}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: 0, paddingBottom: 100 }}
        onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)} scrollEventThrottle={16}
        initialNumToRender={15} extraData={lessons.length} windowSize={10}
        getItemLayout={(_, index) => { const h = itemHeightRef.current; return { length: h, offset: h * index, index }; }}
        onScrollToIndexFailed={(info) => {
          const h = itemHeightRef.current;
          const retryInterval = setInterval(() => { if (info.index < filteredLessons.length) { clearInterval(retryInterval); flatListRef.current?.scrollToIndex({ index: info.index, animated: true }); } }, 50);
          setTimeout(() => clearInterval(retryInterval), 1000);
        }}
        ListHeaderComponent={
          <>
            {filterStatus === 'upcoming' && cpl.visible && (
              <Reanimated.View style={[styles.batchBtnWrap, { marginBottom: spacing.md }, cplWrapStyle]}>
                <RNAnimated.View style={{ overflow: 'hidden', height: cpl.height }}>
                  <TouchableOpacity style={[styles.batchBtn, { backgroundColor: Colors.dangerLight, borderColor: Colors.danger + '30' }]} activeOpacity={0.75} onPress={handleBatchComplete}>
                    <Ionicons name="time-outline" size={iconSize.lg} color={Colors.danger} />
                    <Text style={[styles.batchBtnText, { color: Colors.danger }]}>一键确认下课（{schedulableCount}节）</Text>
                  </TouchableOpacity>
                </RNAnimated.View>
              </Reanimated.View>
            )}
            {filterStatus === 'unpaid' && coll.visible && (
              <Reanimated.View style={[styles.batchBtnWrap, { marginBottom: spacing.md }, collWrapStyle]}>
                <RNAnimated.View style={{ overflow: 'hidden', height: coll.height }}>
                  <TouchableOpacity style={[styles.batchBtn, { backgroundColor: Colors.paidLight, borderColor: Colors.paid + '30' }]} activeOpacity={0.75} onPress={handleBatchCollect}>
                    <Ionicons name="wallet-outline" size={iconSize.lg} color={Colors.paid} />
                    <Text style={[styles.batchBtnText, { color: Colors.paid }]}>一键收款（{collectableCount}节）</Text>
                  </TouchableOpacity>
                </RNAnimated.View>
              </Reanimated.View>
            )}
          </>
        }
        ListEmptyComponent={
          <EmptyState icon="book-outline"
            title={filterStatus === 'upcoming' ? '没有待上课程' : filterStatus === 'paid' ? '没有已收款记录' : filterStatus === 'unpaid' ? '没有待收款记录' : '还没有课程记录'}
            subtitle={filterStatus === 'all' ? '点击右下角按钮记录第一节课' : undefined}
            buttonLabel={filterStatus === 'all' ? '添加课程' : undefined}
            onButtonPress={filterStatus === 'all' ? openAddModal : undefined}
          />
        }
      />

      {showScrollTop && (
        <TouchableOpacity style={styles.scrollTopBtn} activeOpacity={0.7} onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}>
          <Ionicons name="arrow-up" size={iconSize.lg} color={Colors.primary} />
        </TouchableOpacity>
      )}
      <GradientFAB icon="add" onPress={openAddModal} color={Colors.primary} />

      {shredPortal && (() => {
        const portalLesson = filteredLessons.find(l => l.id === shredPortal.lessonId);
        if (!portalLesson) return null;
        const pBorderColor = portalLesson.status === 'paid' ? Colors.paid : portalLesson.status === 'pendingPayment' ? Colors.pending : portalLesson.status === 'cancelled' ? Colors.caption : Colors.primary;
        return (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, pointerEvents: 'none' }}>
            <View style={{ position: 'absolute', top: shredPortal.pageY, left: shredPortal.pageX }}>
              {shredPortal.strips.map((strip) => (
                <ShredderStrip key={`portal-shred-${strip.index}`} index={strip.index} cardWidth={shredPortal.cardW} cardHeight={shredPortal.cardH} fallDist={strip.fallDist} driftX={strip.driftX} rotateDeg={strip.rotateDeg} delay={strip.delay} onDone={shatterMgr.onStripDone}>
                  <View style={[styles.shredInner, { width: shredPortal.cardW, borderLeftWidth: 4, borderLeftColor: pBorderColor }]}>{renderCardContent(portalLesson, false)}</View>
                </ShredderStrip>
              ))}
            </View>
          </View>
        );
      })()}

      <BottomSheet visible={modalVisible} onClose={() => { setModalVisible(false); setEditingLesson(null); setSelectedSubjectId(null); setCurrentSubjects([]); setLessonRate(''); }} title={editingLesson ? '编辑课程' : '添加课程'}>
        <View style={styles.formCardWrapper}>
          <Text style={[styles.formLabel, { marginTop: 0 }]}>选择学生 / 科目</Text>
          <View style={styles.formRow}>
            <View style={styles.formHalf}>
              <DropdownSelect options={students.map(s => ({ label: s.name, value: s.id, leftIcon: <StudentAvatar name={s.name} size={iconSize.avatar.sm} /> }))} selectedValue={selectedStudentId} onSelect={(id) => setSelectedStudentId(id)} placeholder="请选择学生" />
            </View>
            <View style={styles.formHalf}>
              <DropdownSelect key={selectedStudentId} options={currentSubjects.map(sub => ({ label: sub.subject, value: sub.id, subtitle: `${sub.hourlyRate}元/小时` }))} selectedValue={selectedSubjectId} onSelect={(id) => { setSelectedSubjectId(id); const sub = currentSubjects.find(s => s.id === id); if (sub) setLessonRate(sub.hourlyRate.toString()); }} placeholder="选择科目" disabled={currentSubjects.length <= 1} />
            </View>
          </View>
          <Text style={[styles.formLabel]}>上课日期 / 时段</Text>
          <View style={styles.formRow}>
            <View style={styles.formHalf}>
              <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={iconSize.md} color={Colors.primary} />
                <Text style={[styles.datePickerText, !date && styles.datePickerPlaceholder]}>{date ? date.slice(5) : '选择日期'}</Text>
                <Reanimated.View style={calArrowStyle}><Ionicons name="chevron-down" size={iconSize.sm} color={Colors.caption} /></Reanimated.View>
              </TouchableOpacity>
            </View>
            <View style={styles.formHalf}>
              <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
                <Ionicons name="time-outline" size={iconSize.md} color={Colors.primary} />
                <Text style={[styles.datePickerText, !timeSlot && styles.datePickerPlaceholder]}>{timeSlot || '选择时段'}</Text>
                <Reanimated.View style={timeArrowStyle}><Ionicons name="chevron-down" size={iconSize.sm} color={Colors.caption} /></Reanimated.View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={styles.formRow}>
          <View style={styles.formHalf}><Text style={[styles.formLabel]}>课时（小时）</Text><TextInput style={styles.input} placeholder="如 1.5" value={duration} onChangeText={setDuration} keyboardType="numeric" placeholderTextColor={Colors.caption} /></View>
          <View style={styles.formHalf}><Text style={[styles.formLabel]}>课时费（元/小时）</Text><TextInput style={[styles.input, styles.rateInput]} placeholder="如 75" value={lessonRate} onChangeText={setLessonRate} keyboardType="numeric" placeholderTextColor={Colors.caption} /></View>
        </View>
        <View style={styles.amountPreview}><Text style={[styles.amountPreviewLabel]}>预计课时费</Text><Text style={[styles.amountPreviewValue]}>{calculateAmount().toFixed(0)}元</Text></View>
        <Text style={[styles.formLabel]}>备注（可选）</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="添加备注..." value={notes} onChangeText={setNotes} multiline placeholderTextColor={Colors.caption} />
        <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave}><Text style={[styles.saveButtonText]}>{editingLesson ? '更新课程' : '添加课程'}</Text></TouchableOpacity>
      </BottomSheet>

      <CalendarPicker visible={showCalendar} value={date} onConfirm={setDate} onClose={() => setShowCalendar(false)} />
      <TimeRangePicker visible={showTimePicker} onConfirm={(sh, sm, eh, em) => { const slot = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}-${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`; setTimeSlot(slot); }} onClose={() => setShowTimePicker(false)} />

      {confirmDialog && (
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, Shadows.floating, { borderRadius: BorderRadius.card, maxWidth: isTablet ? 500 : 400 }]}>
            <Text style={[styles.confirmTitle]}>{confirmDialog.title}</Text>
            <Text style={[styles.confirmMessage]}>{confirmDialog.message}</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmDialog(null)}><Text style={[styles.confirmCancelText]}>取消</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmOkBtn} onPress={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}><Text style={[styles.confirmOkText]}>确定</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default LessonScreen;
