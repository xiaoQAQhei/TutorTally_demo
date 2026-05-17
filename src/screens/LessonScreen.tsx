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
  View, Text, FlatList, TouchableOpacity, TextInput, Animated, LayoutAnimation, Easing,
  ScrollView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Lesson, Student, StudentSubject, Payment, LessonStatus } from '../models';
import { addLesson, getAllLessons, updateLesson, deleteLesson, setLessonStatus, getAllStudents, getSubjectsByStudentId, addPayment, getPaymentsByLessonId } from '../database';
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
import { useSlideManager, useShatterManager, useCancelAnimation } from '../utils/animationHooks';
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

/**
 * LessonScreen 组件
 *
 * 课程管理主页面，功能包括：
 * - 课程列表展示 + 四态筛选（待上课/待收款/已收款/全部）
 * - 添加/编辑课程表单（含学生选择、日期、时段、课时、课时费、金额预览）
 * - 状态流转操作（确认下课→待收款→已收款）
 * - 带确认弹窗的安全删除（含碎纸机动画效果）
 * - 取消课程（删除线动画）
 * - 接收来自首页的跨页面动作（pendingAction / pendingFilter / highlightLessonId）
 */
const LessonScreen: React.FC = () => {
  // ── 课程与筛选 ──
  const [lessons, setLessons] = useState<Lesson[]>([]);                     // 全部课程
  const [students, setStudents] = useState<Student[]>([]);                   // 全部学生（用于显示姓名）
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('upcoming'); // 当前筛选状态（与横滑初始页一致）
  // Tab 动画值
  const FILTER_INDEX: Record<FilterStatus, number> = { upcoming: 0, unpaid: 1, paid: 2, all: 3 };
  const SCREEN_W = Dimensions.get('window').width;                          // 屏幕宽度（分页基准）
  const pageScrollRef = useRef<ScrollView>(null);                           // 横向 ScrollView 引用
  const scrollX = useRef(new Animated.Value(0)).current;                    // 横向滚动偏移量
  const scrollXRef = useRef(0);                                              // 横向滚动偏移量（非动画版，用于 measure 计算）
  const filterAnim = useRef(new Animated.Value(FILTER_INDEX[filterStatus])).current;  // 初始值与当前筛选状态一致
  const tabColorAnim = useRef(new Animated.Value(FILTER_INDEX[filterStatus])).current; // 滑块颜色插值
  const switchTab = useCallback((key: FilterStatus) => {
    setFilterStatus(key);
    const idx = FILTER_INDEX[key];
    // 动画 + 横滑滚动
    const anims = [
      Animated.timing(filterAnim, { toValue: idx, duration: 250, useNativeDriver: true }),
      Animated.timing(tabColorAnim, { toValue: idx, duration: 250, useNativeDriver: false }),
    ];
    if (pageScrollRef.current) {
      pageScrollRef.current.scrollTo({ x: idx * SCREEN_W, animated: true });
      // 手动设值，避免 onScroll 覆盖
      Animated.timing(scrollX, { toValue: idx * SCREEN_W, duration: 250, useNativeDriver: true }).start();
    }
    Animated.parallel(anims).start();
  }, [filterAnim, tabColorAnim, scrollX, SCREEN_W]);

  // 横滑跟踪：直接更新 scrollX（避免 Animated.event 额外开销）
  const onPageScroll = (e: any) => {
    scrollX.setValue(e.nativeEvent.contentOffset.x);
    scrollXRef.current = e.nativeEvent.contentOffset.x;
  };

  // 抬手吸附：更新 filterStatus
  const onMomentumEnd = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    const key = FILTER_OPTIONS[idx].key;
    setFilterStatus(key);
    Animated.parallel([
      Animated.timing(filterAnim, { toValue: idx, duration: 150, useNativeDriver: true }),
      Animated.timing(tabColorAnim, { toValue: idx, duration: 150, useNativeDriver: false }),
    ]).start();
      }, [filterAnim, tabColorAnim, SCREEN_W]);

  const [modalVisible, setModalVisible] = useState(false);                   // 添加/编辑弹窗
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);   // 正在编辑的课程
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null); // 表单选中的学生 ID
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null); // 表单选中的科目 ID
  const [tabBarW, setTabBarW] = useState(0);                    // Tab 栏宽度（用于计算滑块位置）
  // 学生/科目选择器状态由 DropdownSelect 组件内部管理
  const [date, setDate] = useState('');                                       // 表单：日期
  const [timeSlot, setTimeSlot] = useState('');                               // 表单：时段
  const [duration, setDuration] = useState('');                               // 表单：课时
  const [lessonRate, setLessonRate] = useState('');                           // 表单：课时费
  const [notes, setNotes] = useState('');                                     // 表单：备注
  const [showCalendar, setShowCalendar] = useState(false);                    // 日历选择器
  const [showTimePicker, setShowTimePicker] = useState(false);                // 时段选择器
  const { showToast } = useToast();

  // ── 跨页面交互 ──
  const { pendingAction, clearAction, pendingFilter, clearFilter, highlightLessonId, clearHighlight, confirmBeforeChange } = useAction();
  const [highlightedId, setHighlightedId] = useState<number | null>(null);   // 高亮课程 ID
  const highlightAnim = useRef(new Animated.Value(0)).current;               // 高亮闪烁动画
  const calArrowRot = useRef(new Animated.Value(0)).current;
  const timeArrowRot = useRef(new Animated.Value(0)).current;
  const flatListRefs = useRef<(FlatList | null)[]>([]);                      // 4 个分页列表引用

  // ── 响应式 + 屏幕 ──
  const { maxContentWidth, spacing, fontSize, isTablet, iconSize, contentPaddingH, inputSize } = useResponsive();
  const itemHeightRef = useRef(180);                                          // 列表项预估高度（用于 getItemLayout）
  const cardWidthRef = useRef<Map<number, number>>(new Map());                // 卡片实际宽度缓存
  const cardHeightRef = useRef<Map<number, number>>(new Map());              // 卡片实际高度缓存
  const cardPosRef = useRef<(Map<number, { x: number; y: number }>)[]>([new Map(), new Map(), new Map(), new Map()]); // 卡片容器内位置缓存（onLayout + measureInWindow）
  const [showScrollTop, setShowScrollTop] = useState(false);                  // 回到顶部按钮可见性
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void } | null>(null); // 确认弹窗
  const batchCollapseAnims = useRef<Map<number, Animated.Value>>(new Map());                             // 批量操作中卡片高度收缩动画
  const subjectsCache = useRef<Map<number, StudentSubject[]>>(new Map());                                // 学生科目缓存
  const [currentSubjects, setCurrentSubjects] = useState<StudentSubject[]>([]);                          // 当前选中学生的科目列表

  // ── 响应式样式 ──
  const styles = useMemo(() => ({
    // ═══════════════ 页面容器 ═══════════════
    container: { flex: 1, backgroundColor: Colors.background, position: 'relative' as const, width: '100%', alignSelf: 'center' },
    pageWrap: { width: SCREEN_W, flex: 1 },                                                           // 单页宽度 = 屏幕宽
    pageList: { paddingBottom: 100, paddingTop: spacing.sm },                                          // 每页列表底部留白
    list: { paddingBottom: 100 },                                                                     // 列表底部留白

    // ═══════════════ Tab 筛选栏（左三一组 + 右侧单独）═══════════════
    tabBarWrap: {                                                                                     // Tab 栏外层容器
      paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: spacing.sm,
      flexDirection: 'row', gap: spacing.sm,
    },
    tabGroup: {                                                                                       // 左边三个一组
      flex: 3, flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.pill,
      borderWidth: 1.5, borderColor: Colors.divider, overflow: 'hidden', position: 'relative' as const,
    },
    tabSolo: {                                                                                        // 全部单独
      flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.pill,
      borderWidth: 1.5, borderColor: Colors.divider, overflow: 'hidden', position: 'relative' as const,
      alignItems: 'center', justifyContent: 'center',
    },
    tabBtn: {                                                                                         // Tab 按钮
      flex: 1, paddingVertical: spacing.sm + 2,
      alignItems: 'center', justifyContent: 'center', zIndex: 2,
    },
    tabBtnText: { fontSize: fontSize.caption, fontWeight: FontWeight.medium, color: Colors.caption },
    tabSlider: {                                                                                      // 滑块指示器
      position: 'absolute' as const, top: 2, bottom: 2, left: 2, right: 2,
      borderRadius: BorderRadius.pill - 2, zIndex: 1,
    },

    // ═══════════════ 一键操作按钮 ═══════════════
    batchBtn: {                                                                                       // 批量操作按钮
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      borderRadius: BorderRadius.button, padding: spacing.sm, gap: spacing.sm, borderWidth: 1,
    },
    batchBtnWrap: { overflow: 'hidden' as const },                                                    // 批量按钮动画容器
    batchBtnText: { fontSize: fontSize.body, fontWeight: FontWeight.semiBold },                      // 按钮文字
    // ═══════════════ 课程卡片 ═══════════════
    card: {
      backgroundColor: Colors.card, borderRadius: BorderRadius.card,
      padding: spacing.lg, marginBottom: spacing.md,
      position: 'relative' as const,
    },
    cardHeader: {                                                                                     // 卡片头部（头像+姓名 + 状态徽章）
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },                 // 头部左侧（头像 + 姓名）
    studentName: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },        // 学生名
    subject: { fontSize: fontSize.small, color: Colors.caption, marginTop: 2 },                       // 科目名
    cardBody: { paddingTop: spacing.sm },                                                             // 卡片内容区
    infoBoxContainer: {                                                                               // 核心信息框+金额行
      flexDirection: 'row', borderRadius: BorderRadius.smallCard, overflow: 'hidden',
    },
    infoBox: {                                                                                        // 信息框主体
      flex: 1, backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.smallCard,
      padding: spacing.md, justifyContent: 'center',
    },
    infoTopRow: {                                                                                     // 第一行：日期·时长
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm,
    },
    infoTopText: { fontSize: fontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.body },
    timeSlotLarge: {                                                                                  // 时段（视觉重心）
      fontSize: fontSize.h1, fontWeight: FontWeight.bold, color: Colors.title,
    },
    amountBox: {                                                                                      // 金额容器
      justifyContent: 'center', alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    amountText: { fontSize: fontSize.amount, fontWeight: FontWeight.bold, color: Colors.title },       // 金额数字
    noteRow: {                                                                                        // 备注行
      flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
      marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider,
    },
    noteText: { fontSize: fontSize.small, color: Colors.caption, flex: 1 },
    // ═══════════════ 取消动画（删除线 + 碎片）═══════════════
    strikethroughOverlay: {                                                                           // 删除线覆盖层
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: 'center', alignItems: 'center', zIndex: 10,
      overflow: 'visible',
    },
    strikethroughLine: {                                                                              // 删除线
      position: 'absolute', left: -30, height: 2,
      backgroundColor: '#9CA3AF',
    },
    shatterOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'visible', zIndex: 20 }, // 碎片覆盖层
    shredStrip: {                                                                                     // 碎片条
      position: 'absolute', top: 0, height: '100%',
      overflow: 'hidden',
    },
    shredInner: {                                                                                     // 碎片内容
      position: 'absolute',
      top: 0,
      backgroundColor: Colors.card,
      padding: spacing.lg,
      borderRadius: BorderRadius.card,
    },
    strikethroughLabel: {                                                                             // 删除线标签 "已取消"
      fontSize: fontSize.caption, color: '#6B7280', fontWeight: FontWeight.semiBold,
      backgroundColor: '#F3F4F6', paddingHorizontal: spacing.md, paddingVertical: 2,
      borderRadius: BorderRadius.pill, overflow: 'hidden',
    },

    // ═══════════════ 底部操作栏 ═══════════════
    footerDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: spacing.md },        // 操作栏分割线
    actionRow: {                                                                                      // 操作按钮行
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    actionRowLeft: { flexDirection: 'row', gap: spacing.lg },                                         // 左侧按钮组
    actionRowRight: { flexDirection: 'row', gap: spacing.lg },                                        // 右侧按钮组
    actionButton: { padding: spacing.sm },                                                            // 单个操作按钮

    // ═══════════════ 回到顶部按钮 ═══════════════
    scrollTopBtn: {
      position: 'absolute' as const,
      bottom: (isTablet ? FAB_BOTTOM_TABLET*2 : FAB_BOTTOM_PHONE) + FAB_BASE_SIZE + spacing.md, // FAB底部 + 按钮高度 + 间距
      right: (isTablet ? FAB_RIGHT_TABLET : contentPaddingH + 4) + Math.round((moderateScale(FAB_BASE_SIZE) - scale(44)) / 2), // FAB右侧 + 居中偏移
      width: scale(44), height: scale(44), borderRadius: scale(22),
      backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#D1D5DB',
      justifyContent: 'center' as const, alignItems: 'center' as const,
      ...Shadows.standard,
    },
    // ═══════════════ 确认弹窗 ═══════════════
    confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', zIndex: 200 },
    confirmBox: { backgroundColor: Colors.card, padding: spacing.xxl, width: '80%' },               // 弹窗容器
    confirmTitle: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: spacing.md, textAlign: 'center' },
    confirmMessage: { fontSize: fontSize.body, color: Colors.body, marginBottom: spacing.xl, textAlign: 'center' },
    confirmButtons: { flexDirection: 'row', gap: spacing.md },                                       // 按钮行
    confirmCancelBtn: { flex: 1, height: scale(46), borderRadius: scale(23), backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
    confirmCancelText: { fontSize: fontSize.body, color: Colors.caption, fontWeight: FontWeight.medium },
    confirmOkBtn: { flex: 1, height: scale(46), borderRadius: scale(23), backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    confirmOkText: { fontSize: fontSize.body, color: Colors.white, fontWeight: FontWeight.semiBold },

    // ═══════════════ 表单（添加/编辑课程）═══════════════
    datePickerButton: {                                                                               // 日期选择按钮
      flexDirection: 'row', alignItems: 'center',
      height: inputSize.input, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
      paddingHorizontal: spacing.md, backgroundColor: Colors.card,
      gap: spacing.sm,
    },
    formCardWrapper: {                                                                                // 重要信息区背景卡片
      backgroundColor: Colors.primary + '15', borderRadius: BorderRadius.card,
      padding: spacing.md, 
    },
    datePickerText: { flex: 1, fontSize: fontSize.body, color: Colors.title },                       // 日期文字
    datePickerPlaceholder: { color: Colors.caption },                                                 // 日期占位符
    formLabel: { fontSize: fontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.body, marginBottom: spacing.sm, marginTop: spacing.md },
    pickerButton: {                                                                                   // 选择器按钮（学生/时间段）
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      height: inputSize.input, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
      paddingHorizontal: spacing.md, backgroundColor: Colors.background,
    },
    pickerSelected: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },                 // 已选中状态
    pickerText: { fontSize: fontSize.body, color: Colors.title, fontWeight: FontWeight.medium },     // 选中文字
    pickerPlaceholder: { fontSize: fontSize.body, color: Colors.caption },                            // 占位文字
    input: {                                                                                          // 文本输入框
      height: inputSize.input, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
      paddingHorizontal: spacing.md, fontSize: fontSize.body, color: Colors.title,
      backgroundColor: Colors.background,
    },
    textArea: { height: inputSize.textArea, paddingTop: spacing.md, textAlignVertical: 'top' },              // 多行文本框（备注）
    formRow: { flexDirection: 'row', gap: spacing.md },                                               // 表单双列行
    formHalf: { flex: 1 },                                                                            // 表单半列
    rateInput: { textAlign: 'center', fontWeight: FontWeight.semiBold },                              // 课时费输入

    // ═══════════════ 金额预览 ═══════════════
    amountPreview: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: Colors.paidLight, borderRadius: BorderRadius.button,
      padding: spacing.lg, marginTop: spacing.md,
    },
    amountPreviewLabel: { fontSize: fontSize.body, color: Colors.body, fontWeight: FontWeight.medium }, // "预计课时费"
    amountPreviewValue: { fontSize: fontSize.h2, fontWeight: FontWeight.bold, color: Colors.paid },    // 金额数字

    // ═══════════════ 保存按钮 ═══════════════
    saveButton: {
      backgroundColor: Colors.primary, height: inputSize.saveButton, borderRadius: BorderRadius.button,
      justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl,
    },
    saveButtonText: { color: Colors.white, fontSize: fontSize.body, fontWeight: FontWeight.semiBold },

    // ═══════════════ 学生选择列表项 ═══════════════
    studentItem: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
      paddingHorizontal: spacing.md, borderRadius: BorderRadius.smallCard, gap: spacing.md,
    },
    studentItemActive: { backgroundColor: Colors.primaryLight },                                      // 选中态
    studentItemInfo: { flex: 1 },                                                                     // 学生信息
    studentItemName: { fontSize: fontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title },
    studentItemSubject: { fontSize: fontSize.small, color: Colors.caption, marginTop: 2 },           // 科目名
  } as const), [spacing, fontSize, iconSize, isTablet, contentPaddingH]);

  // ── 动画状态 ──
  const [morphing, setMorphing] = useState<{ id: number; targetStatus: LessonStatus } | null>(null); // 正在执行状态流转动画的课程
  const slideTestAnims = useRef<Map<number, Animated.Value>>(new Map());                        // 状态流转：水平位移
  const slideOpacityAnims = useRef<Map<number, Animated.Value>>(new Map());                     // 状态流转：透明度
  const collapseAnims = useRef<Map<number, Animated.Value>>(new Map());                         // 删除碎纸动画：高度收缩
  const collapseStarted = useRef<Set<number>>(new Set());                                       // 标记已开始收缩的课程 ID
  const slideMgr = useSlideManager();                                                            // 滑动管理器
  const shatterMgr = useShatterManager();                                                         // 碎纸管理器
  const cancelAnim = useCancelAnimation();                                                        // 取消删除线动画
  const containerRef = useRef<View>(null);                                                        // 页面容器引用（用于碎纸定位）
  const containerOffRef = useRef({ x: 0, y: 0 });                                                   // 容器屏幕偏移（onLayout 捕获）
  const cardRefs = useRef<(Map<number, any>)[]>([new Map(), new Map(), new Map(), new Map()]);                                          // 卡片 DOM 引用（用于碎纸定位）
  const [shredPortal, setShredPortal] = useState<{                                               // 碎纸 Portal 配置
    pageX: number; pageY: number; cardW: number; cardH: number;
    strips: import('../utils/animationHooks').ShatterStripConfig[];
    lessonId: number;
  } | null>(null);
  const cpl = useBatchAnim(2000);                                                                          // 一键确认下课动画（停留2s后显示）
  const coll = useBatchAnim(2000);                                                                         // 一键收款动画（停留2s后显示）
  const isCplRunning = useRef(false);                                                                      // 一键确认下课执行中
  const isCollRunning = useRef(false);                                                                     // 一键收款执行中

  // ── 页面聚焦时加载数据 ──
  useFocusEffect(useCallback(() => {
    loadLessons();
    loadStudents();
  }, []));

  /**
   * loadLessons - 加载全部课程
   *
   * 自动将已过 scheduled 结束时间的课程标记为 completed（超时自动下课），
   * 然后重新获取最新课程列表。
   */
  const loadLessons = async () => {
    const all = await getAllLessons();
    const now = new Date();
    for (const l of all) {
      if (l.status === 'scheduled' && l.timeSlot) {
        const endTime = l.timeSlot.split('-')[1]?.trim();
        if (endTime && now >= new Date(`${l.date}T${endTime}:00`)) {
          await setLessonStatus(l.id, 'completed');
        }
      }
    }
    setLessons(await getAllLessons());
  };
  /**
   * loadStudents - 加载学生列表
   *
   * 默认选中第一个学生作为添加课程表单的默认值。
   */
  const loadStudents = async () => {
    const data = await getAllStudents();
    setStudents(data);
    if (data.length > 0 && !selectedStudentId) setSelectedStudentId(data[0].id);
  };

  /** 根据学生 ID 查找学生对象 */
  const getStudent = (studentId: number) => students.find((s) => s.id === studentId);

  /** 4 个独立分页数据（按状态预过滤+排序） */
  const pageData: Lesson[][] = useMemo(() => {
    const upcoming = lessons.filter((l) => l.status === 'scheduled' || l.status === 'completed');
    upcoming.sort((a, b) => a.date.localeCompare(b.date) || (a.timeSlot || '').localeCompare(b.timeSlot || ''));
    const unpaid = lessons.filter((l) => l.status === 'pendingPayment');
    unpaid.sort((a, b) => a.date.localeCompare(b.date));
    const paid = lessons.filter((l) => l.status === 'paid');
    paid.sort((a, b) => b.date.localeCompare(a.date));
    const all = [...lessons];
    all.sort((a, b) => b.date.localeCompare(a.date));
    return [upcoming, unpaid, paid, all];
  }, [lessons]);

  /** 兼容旧逻辑：当前选中 Tab 的数据 */
  const filteredLessons = pageData[FILTER_INDEX[filterStatus]];

  /** 各状态课程数量统计（用于筛选栏计数徽章） */
  const counts = (() => {
    const upcoming = lessons.filter((l) => l.status === 'scheduled' || l.status === 'completed').length;
    const paid = lessons.filter((l) => l.status === 'paid').length;
    const unpaid = lessons.filter((l) => l.status === 'pendingPayment').length;
    return { upcoming, paid, unpaid, all: lessons.length };
  })();

  /** 可一键确认下课的课程数（completed → pendingPayment） */
  const schedulableCount = lessons.filter((l) => l.status === 'completed').length;
  /** 可一键收款的课程数（仅 pendingPayment） */
  const collectableCount = lessons.filter((l) => l.status === 'pendingPayment').length;

  /** 四舍五入到最近 0.5 小时 */
  const roundDuration = (d: number) => Math.round(d * 2) / 2;

  /** 格式化显示时长：整数 2h，小数 1.5h */
  const fmtDuration = (d: number) => (d % 1 === 0 ? `${d}h` : `${d}h`);

  /** 计算预计课时费：课时 × 课时费 */
  const calculateAmount = () => {
    if (!duration) return 0;
    return (parseFloat(lessonRate) || 0) * parseFloat(duration);
  };

  /**
   * handleSave - 保存课程（新增或更新）
   *
   * 校验必填项后，根据时段自动修正课时（表时段与课时不一致时自动调整），
   * 然后调用 addLesson 或 updateLesson 写入数据库。
   */
  const handleSave = async () => {
    if (!selectedStudentId || !date || !timeSlot || !duration || !lessonRate) {
      showToast('请选择学生、日期、时段并填写课时和课时费', 'error');
      return;
    }
    const amount = calculateAmount();

    // 校验时段与课时是否一致
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
      await updateLesson({
        ...editingLesson, studentId: selectedStudentId, date, timeSlot,
        duration: parseFloat(duration), amount, notes,
        studentSubjectId: selectedSubjectId || undefined,
      });
    } else {
      await addLesson({
        studentId: selectedStudentId, date, timeSlot, duration: parseFloat(duration),
        amount, status: 'scheduled', confirmedAt: null, notes, createdAt: new Date().toISOString(),
        studentSubjectId: selectedSubjectId || undefined,
      });
    }
    setModalVisible(false);
    setEditingLesson(null);
    setSelectedSubjectId(null);
    setDate('');
    setTimeSlot('');
    setDuration('2');
    setLessonRate('');
    setNotes('');
    loadLessons();
    showToast(editingLesson ? '课程已更新' : '课程已添加', 'success');
  };

  /**
   * handleStatusChange - 改变课程状态（如 completed → pendingPayment → paid）
   *
   * 如果当前筛选状态不是「全部」，触发滑动带动画的过渡效果；
   * 否则使用 LayoutAnimation 平滑过渡。
   * 如果 confirmBeforeChange 开启，先弹出确认对话框。
   * @param lesson 目标课程
   * @param nextStatus 目标状态
   */
  const handleStatusChange = async (lesson: Lesson, nextStatus: LessonStatus) => {
    const doChange = () => {
      if (filterStatus !== 'all' && (nextStatus === 'completed' || nextStatus === 'pendingPayment' || nextStatus === 'paid')) {
        if (!slideTestAnims.current.has(lesson.id)) {
          slideTestAnims.current.set(lesson.id, new Animated.Value(0));
        }
        if (!slideOpacityAnims.current.has(lesson.id)) {
          slideOpacityAnims.current.set(lesson.id, new Animated.Value(1));
        }
        const slideX = slideTestAnims.current.get(lesson.id)!;
        const slideOp = slideOpacityAnims.current.get(lesson.id)!;
        slideX.setValue(0);
        slideOp.setValue(1);
        setMorphing({ id: lesson.id, targetStatus: nextStatus });
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(slideX, { toValue: 400, duration: 350, useNativeDriver: false }),
            Animated.timing(slideOp, { toValue: 0, duration: 350, useNativeDriver: false }),
          ]).start(() => {
            // 不重置 slideX/slideOp，保持滑出位置
            setMorphing(null);
            // 高度收缩 → LayoutAnimation → 移除卡片 → DB 写入 → 刷新
            const cardH = cardHeightRef.current.get(lesson.id) || 200;
            if (!batchCollapseAnims.current.has(lesson.id))
              batchCollapseAnims.current.set(lesson.id, new Animated.Value(cardH));
            const collapseAnim = batchCollapseAnims.current.get(lesson.id)!;
            collapseAnim.setValue(cardH);
            Animated.timing(collapseAnim, {
              toValue: 0, duration: 300, useNativeDriver: false, easing: Easing.out(Easing.cubic),
            }).start(() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setLessons((prev) => prev.filter((x) => x.id !== lesson.id));
              slideTestAnims.current.get(lesson.id)?.setValue(0);
              slideOpacityAnims.current.get(lesson.id)?.setValue(1);
              setLessonStatus(lesson.id, nextStatus).then(() => loadLessons());
            });
          });
        }, 300);
      } else {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setLessonStatus(lesson.id, nextStatus).then(() => loadLessons());
      }
    };
    if (confirmBeforeChange) {
      const nextLabel = LessonStatusColors[nextStatus]?.label || nextStatus;
      setConfirmDialog({ visible: true, title: '确认操作', message: `确定要标记为「${nextLabel}」吗？`, onConfirm: doChange });
    } else {
      doChange();
    }
  };

  /** 依次触发单个卡片的滑动动画，返回 Promise */
  const animateOneSlide = (lessonId: number, targetStatus: LessonStatus): Promise<void> => {
    return new Promise((resolve) => {
      if (!slideTestAnims.current.has(lessonId)) slideTestAnims.current.set(lessonId, new Animated.Value(0));
      if (!slideOpacityAnims.current.has(lessonId)) slideOpacityAnims.current.set(lessonId, new Animated.Value(1));
      const slideX = slideTestAnims.current.get(lessonId)!;
      const slideOp = slideOpacityAnims.current.get(lessonId)!;
      slideX.setValue(0);
      slideOp.setValue(1);
      setMorphing({ id: lessonId, targetStatus });
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideX, { toValue: 400, duration: 350, useNativeDriver: false }),
          Animated.timing(slideOp, { toValue: 0, duration: 350, useNativeDriver: false }),
        ]).start(() => {
          // 不重置 slideX/slideOp，保持滑出位置等待收缩动画
          setMorphing(null);
          resolve();
        });
      }, 300);
    });
  };

  /** 一键确认下课：按键退场 → 每个卡片依次滑动退出 → 修改状态 */
  const handleBatchComplete = () => {
    if (isCplRunning.current) return;
    const doBatch = async () => {
      isCplRunning.current = true;
      await cpl.exit();
      const targetLessons = filteredLessons.filter((l) => l.status === 'completed');
      for (const l of targetLessons) {
        await animateOneSlide(l.id, 'pendingPayment');
        await setLessonStatus(l.id, 'pendingPayment');
        // 高度收缩动画：让下方卡片平滑上移
        const cardH = cardHeightRef.current.get(l.id) || 200;
        if (!batchCollapseAnims.current.has(l.id)) batchCollapseAnims.current.set(l.id, new Animated.Value(cardH));
        const collapseAnim = batchCollapseAnims.current.get(l.id)!;
        collapseAnim.setValue(cardH);
        await new Promise<void>((resolve) => {
          Animated.timing(collapseAnim, { toValue: 0, duration: 300, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setLessons((prev) => prev.filter((x) => x.id !== l.id));
            slideTestAnims.current.get(l.id)?.setValue(0);
            slideOpacityAnims.current.get(l.id)?.setValue(1);
            resolve();
          });
        });
      }
      isCplRunning.current = false;
      loadLessons();
      showToast(`已确认 ${targetLessons.length} 节课待收款`, 'success');
    };
    if (confirmBeforeChange) {
      setConfirmDialog({ visible: true, title: '批量确认下课', message: `确定要将 ${schedulableCount} 节已下课课程转为待收款吗？`, onConfirm: doBatch });
    } else {
      doBatch();
    }
  };

  /** 一键收款：按键退场 → 每个卡片依次滑动退出 → 修改状态 */
  const handleBatchCollect = () => {
    if (isCollRunning.current) return;
    const doBatch = async () => {
      isCollRunning.current = true;
      await coll.exit();
      const targetLessons = filteredLessons.filter((l) => l.status === 'pendingPayment');
      for (const l of targetLessons) {
        await animateOneSlide(l.id, 'paid');
        await setLessonStatus(l.id, 'paid');
        const cardH = cardHeightRef.current.get(l.id) || 200;
        if (!batchCollapseAnims.current.has(l.id)) batchCollapseAnims.current.set(l.id, new Animated.Value(cardH));
        const collapseAnim = batchCollapseAnims.current.get(l.id)!;
        collapseAnim.setValue(cardH);
        await new Promise<void>((resolve) => {
          Animated.timing(collapseAnim, { toValue: 0, duration: 300, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setLessons((prev) => prev.filter((x) => x.id !== l.id));
            slideTestAnims.current.get(l.id)?.setValue(0);
            slideOpacityAnims.current.get(l.id)?.setValue(1);
            resolve();
          });
        });
      }
      isCollRunning.current = false;
      loadLessons();
      showToast(`已收取 ${targetLessons.length} 节课款`, 'success');
    };
    if (confirmBeforeChange) {
      setConfirmDialog({ visible: true, title: '批量收款', message: `确定要将 ${collectableCount} 节待收款课程标记为已收款吗？`, onConfirm: doBatch });
    } else {
      doBatch();
    }
  };

  /**
   * handleCancelLesson - 取消课程操作
   *
   * 触发删除线动画（从左到右展开），动画完成后将课程状态设为 cancelled，
   * 并重新加载列表。
   * @param lesson 要取消的课程
   */
  const handleCancelLesson = (lesson: Lesson) => {
    const doCancel = () => {
      cancelAnim.trigger(lesson.id, () => {
        setLessonStatus(lesson.id, 'cancelled').then(loadLessons);
      });
    };
    if (confirmBeforeChange) {
      setConfirmDialog({ visible: true, title: '取消课程', message: '确定要取消这个课程吗？', onConfirm: doCancel });
    } else {
      doCancel();
    }
  };

  /** 判断课程是否已过结束时间（用于控制「取消课程」按钮的显示） */
  const isClassEnded = (lesson: Lesson): boolean => {
    const endTime = lesson.timeSlot?.split('-')[1]?.trim();
    if (!endTime) return true;
    return new Date() >= new Date(`${lesson.date}T${endTime}:00`);
  };

  /**
   * handleDelete - 删除课程（含碎纸机动画）
   *
   * 先触发碎纸机碎片动画，动画完成后执行 deleteLesson 并从列表移除。
   * 如果 confirmBeforeChange 开启，先弹出确认对话框。
   * @param id 课程 ID
   */
  const handleDelete = (id: number) => {
    if (shatterMgr.activeId !== null) return;
    const doDelete = () => {
      const cardView = cardRefs.current[FILTER_INDEX[filterStatus]].get(id);
      const doShatter = (x: number, y: number, cardW: number, cardH: number) => {
        const strips = shatterMgr.triggerShatter(id, cardH, () => {
          setShredPortal(null);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setLessons(prev => prev.filter(l => l.id !== id));
          cardRefs.current[FILTER_INDEX[filterStatus]].delete(id); cardPosRef.current[FILTER_INDEX[filterStatus]].delete(id); cardWidthRef.current.delete(id); cardHeightRef.current.delete(id);
          deleteLesson(id).catch((e) => { const target = lessons.find(l => l.id === id); if (target) setLessons(prev => [...prev, target]); showToast('删除失败，请重试', 'error'); });
        });
        setShredPortal({ pageX: x, pageY: y, cardW, cardH, strips, lessonId: id });
      };
      if (cardView) {
        // 优先用缓存的容器内位置（onLayout 时捕获）
        const cached = cardPosRef.current[FILTER_INDEX[filterStatus]].get(id);
        if (cached) {
          doShatter(cached.x, cached.y, cardWidthRef.current.get(id) || 400, cardHeightRef.current.get(id) || 200);
        } else {
          requestAnimationFrame(() => {
            (cardView as any).measureInWindow((_x: number, _y: number, _w: number, _h: number) => {
              doShatter(_x - containerOffRef.current.x, _y - containerOffRef.current.y, _w, _h);
            });
          });
        }
      } else {
        doShatter(0, 0, cardWidthRef.current.get(id) || 400, cardHeightRef.current.get(id) || 200);
      }
    };
    if (confirmBeforeChange) {
      setConfirmDialog({ visible: true, title: '删除课程', message: '确定要删除这个课程吗？删除后无法恢复。', onConfirm: doDelete });
    } else {
      doDelete();
    }
  };

  /**
   * handleEdit - 打开编辑课程弹窗
   *
   * 将课程现有数据填充到表单状态中。
   * @param lesson 要编辑的课程
   */
  const handleEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setSelectedStudentId(lesson.studentId);
    setSelectedSubjectId(lesson.studentSubjectId || null);
    setDate(lesson.date);
    setTimeSlot(lesson.timeSlot || '');
    setDuration(lesson.duration.toString());
    setLessonRate('');
    setNotes(lesson.notes || '');
    setModalVisible(true);
  };

  /** 打开添加课程弹窗，设置默认值（明天日期、2小时，课时费由选中的学生科目自动填充） */
  const openAddModal = () => {
    setEditingLesson(null);
    setSelectedSubjectId(null);
    const firstStudent = students[0];
    setSelectedStudentId(firstStudent?.id || null);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    setDate(tomorrow);
    setTimeSlot('');
    setDuration('2');
    setLessonRate('');
    setNotes('');
    setModalVisible(true);
  };

  // ── 响应来自首页的跨页面动作 ──

  /** 从首页跳转过来添加课程时自动打开弹窗 */
  useEffect(() => {
    if (pendingAction === 'addLesson') {
      openAddModal();
      clearAction();
    }
  }, [pendingAction]);

  /** 从首页跳转过来时应用筛选状态 */
  useEffect(() => {
    if (pendingFilter) {
      switchTab(pendingFilter);
      clearFilter();
    }
  }, [pendingFilter, clearFilter]);

  /** 一键确认下课：条件满足时延迟2s显示，中途切tab取消延迟 */
  useEffect(() => {
    if (filterStatus === 'upcoming' && schedulableCount >= 5 && !isCplRunning.current) {
      cpl.enter();
    } else if (cpl.visible && cpl.hasAnimated.current) {
      cpl.exit();
    } else {
      cpl.cancel();  // 条件不满足时取消延迟定时器
    }
    return () => cpl.cancel();
  }, [filterStatus, schedulableCount]);

  /** 一键收款：条件满足时延迟2s显示，中途切tab取消延迟 */
  useEffect(() => {
    if (filterStatus === 'unpaid' && collectableCount >= 5 && !isCollRunning.current) {
      coll.enter();
    } else if (coll.visible && coll.hasAnimated.current) {
      coll.exit();
    } else {
      coll.cancel();
    }
    return () => coll.cancel();
  }, [filterStatus, collectableCount]);

  /** 选中学生变化或弹窗打开时自动查询科目并填充课时费 */
  useEffect(() => {
    if (selectedStudentId === null || !modalVisible) return;
    getSubjectsByStudentId(selectedStudentId).then((subjects) => {
      subjectsCache.current.set(selectedStudentId, subjects);
      setCurrentSubjects(subjects);
      if (subjects.length > 0) {
        let targetSubject = subjects[0];
        if (editingLesson && editingLesson.studentSubjectId) {
          const found = subjects.find(s => s.id === editingLesson.studentSubjectId);
          if (found) targetSubject = found;
        }
        setSelectedSubjectId(targetSubject.id);
        setLessonRate(targetSubject.hourlyRate.toString());
      } else {
        setSelectedSubjectId(null);
        setLessonRate('');
      }
    });
  }, [selectedStudentId, editingLesson, modalVisible]);

  /** 处理课程高亮：滚动到指定课程位置 + 背景闪烁动画 */
  useEffect(() => {
    if (highlightLessonId === null || lessons.length === 0) return;

    const idx = filteredLessons.findIndex((l) => l.id === highlightLessonId);
    if (idx !== -1) {
      highlightAnim.stopAnimation();
      highlightAnim.setValue(0);
      setHighlightedId(highlightLessonId);
      
      requestAnimationFrame(() => {
        flatListRefs.current[FILTER_INDEX[filterStatus]]?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
      });
      
      Animated.sequence([
        Animated.timing(highlightAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.delay(2000),
        Animated.timing(highlightAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]).start(() => {
        setHighlightedId(null);
        clearHighlight();
      });
    }
  }, [highlightLessonId, filteredLessons, lessons, filterStatus, clearHighlight]);

  /**
   * renderCardContent - 渲染课程卡片内容（头部、信息行、金额、备注、操作按钮）
   *
   * 这是卡片的核心内容渲染函数，会被 renderLesson 调用两次：
   * - 正常模式 (interactive=true)：包含可交互的按钮
   * - 碎纸模式 (interactive=false)：只渲染不可交互的副本（用于碎纸动画）
   * 同时处理状态流转动画（morphing）和取消动画（strikethrough）的显示逻辑。
   * @param lesson 课程数据
   * @param interactive 是否可交互（按钮可点击）
   */
  const renderCardContent = (lesson: Lesson, interactive: boolean) => {
    const student = getStudent(lesson.studentId);
    const lessonId = lesson.id;
    const isMorphingCard = morphing?.id === lessonId;
    const displayStatus = isMorphingCard ? morphing!.targetStatus : lesson.status;
    const isCancelled = lesson.status === 'cancelled';
    const isCancellingCard = cancelAnim.cancellingId === lessonId;
    const showCancelAnim = isCancelled || isCancellingCard;

    if (isCancelled && !isCancellingCard) {
      cancelAnim.markCancelled(lessonId);
    }

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
          <StatusBadge
            status={displayStatus}
            disabled={!interactive || isMorphingCard || lesson.status === 'scheduled'}
            onToggle={!interactive || isMorphingCard ? undefined : (nextStatus: LessonStatus) => handleStatusChange(lesson, nextStatus)}
          />
        </View>

        {/* ── 核心信息 + 金额（同一行） ── */}
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

          {/* ── 备注 ── */}
          {lesson.notes ? (
            <View style={styles.noteRow}>
              <Ionicons name="document-text-outline" size={iconSize.xs} color={Colors.caption} />
              <Text style={[styles.noteText]} numberOfLines={2}>{lesson.notes}</Text>
            </View>
          ) : null}
          {showCancelAnim && interactive && (
            <View style={styles.strikethroughOverlay} pointerEvents="none">
              <Animated.View style={[styles.strikethroughLine, cancelAnim.getLineStyle(lessonId, cardWidthRef.current.get(lessonId) || 400)]} />
              <Animated.Text style={[styles.strikethroughLabel, cancelAnim.getLabelStyle(lessonId)]}>已取消</Animated.Text>
            </View>
          )}
          {showCancelAnim && !interactive && isCancelled && (
            <View style={styles.strikethroughOverlay} pointerEvents="none">
              <View style={[styles.strikethroughLine, { width: (cardWidthRef.current.get(lessonId) || 400) + 20 }]} />
              <Text style={[styles.strikethroughLabel]}>已取消</Text>
            </View>
          )}
        </View>
        <View style={styles.footerDivider} />
        <View style={styles.actionRow}>
          <View style={styles.actionRowLeft}>
            {interactive && shatterMgr.activeId === null ? (
              <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(lesson.id)}>
                <Ionicons name="trash-outline" size={iconSize.md} color={Colors.danger} />
              </TouchableOpacity>
            ) : (
              <View style={styles.actionButton}>
                <Ionicons name="trash-outline" size={iconSize.md} color={interactive ? Colors.caption : Colors.danger} />
              </View>
            )}
          </View>
          <View style={styles.actionRowRight}>
            {lesson.status === 'scheduled' && !isClassEnded(lesson) && (
              interactive ? (
                <TouchableOpacity style={styles.actionButton} onPress={() => handleCancelLesson(lesson)}>
                  <Ionicons name="close-circle-outline" size={iconSize.md} color={Colors.pending} />
                </TouchableOpacity>
              ) : (
                <View style={styles.actionButton}>
                  <Ionicons name="close-circle-outline" size={iconSize.md} color={Colors.pending} />
                </View>
              )
            )}
            {(lesson.status !== 'paid' && lesson.status !== 'cancelled') && (
              interactive ? (
                <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(lesson)}>
                  <Ionicons name="pencil" size={iconSize.md} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.actionButton}>
                  <Ionicons name="pencil" size={iconSize.md} color={Colors.primary} />
                </View>
              )
            )}
          </View>
        </View>
      </>
    );
  };

  /**
   * renderLesson - 渲染整个课程卡片（含动画容器）
   *
   * 包裹 Animated.View，处理：
   * - 状态流转的滑动动画（slideTestAnims）
   * - 取消课程的删除线动画（cancelAnims）
   * - 碎纸删除的高度收缩动画（collapseAnims）
   * - 高亮闪烁动画（highlightAnim）
   * 测量卡片实际尺寸并缓存（用于 getItemLayout 和删除线宽度）。
   * @param item 课程对象
   */
  // ── 选择器箭头旋转动画 ──
  useEffect(() => {
    Animated.timing(calArrowRot, { toValue: showCalendar ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [showCalendar]);
  useEffect(() => {
    Animated.timing(timeArrowRot, { toValue: showTimePicker ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [showTimePicker]);

  const renderLesson = ({ item }: { item: Lesson }, pageIdx: number = 3) => {
    const student = getStudent(item.studentId);
    const lessonId = item.id;

    const isMorphing = morphing?.id === lessonId;
    const displayStatus = isMorphing ? morphing!.targetStatus : item.status;
    const borderColor = displayStatus === 'paid' ? Colors.paid : displayStatus === 'pendingPayment' ? Colors.pending : displayStatus === 'cancelled' ? Colors.caption : Colors.primary;
    const isCancelled = item.status === 'cancelled';
    const isCancelling = cancelAnim.cancellingId === lessonId;
    const showCancelAnim = isCancelled || isCancelling;
    const isHighlighted = item.id === highlightedId;

    if (!slideTestAnims.current.has(lessonId)) {
      slideTestAnims.current.set(lessonId, new Animated.Value(0));
    }
    if (!slideOpacityAnims.current.has(lessonId)) {
      slideOpacityAnims.current.set(lessonId, new Animated.Value(1));
    }

    // Collapse animation when shredding
    const cardH = cardHeightRef.current.get(lessonId) || 200;
    if (!collapseAnims.current.has(lessonId)) {
      collapseAnims.current.set(lessonId, new Animated.Value(cardH));
    }
    const collapseAnim = collapseAnims.current.get(lessonId)!;
    if (shatterMgr.activeId === lessonId && !collapseStarted.current.has(lessonId)) {
      collapseStarted.current.add(lessonId);
      collapseAnim.setValue(cardH);
      Animated.timing(collapseAnim, {
        toValue: 0, duration: 350, useNativeDriver: false, easing: Easing.out(Easing.cubic),
      }).start();
    }
    if (shatterMgr.activeId !== lessonId) {
      collapseStarted.current.delete(lessonId);
    }

    const cardInner = (interactive: boolean) => renderCardContent(item, interactive);

    const cardBg = showCancelAnim
      ? '#F3F4F6'
      : isHighlighted
      ? highlightAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [Colors.card, Colors.primary + '18'],
        })
      : Colors.card;

    return (
      <Animated.View
        style={[styles.card, Shadows.standard, {
          borderLeftWidth: 4, borderLeftColor: borderColor, backgroundColor: cardBg,
          opacity: isMorphing ? slideOpacityAnims.current.get(lessonId)! : showCancelAnim ? 0.6 : 1,
          transform: [
            { translateX: slideTestAnims.current.get(lessonId)! },
          ],
        }, shatterMgr.activeId === lessonId ? {
          backgroundColor: 'transparent',
          borderLeftWidth: 0,
          height: collapseAnim,
          padding: collapseAnim.interpolate({ inputRange: [0, cardH], outputRange: [0, spacing.lg], extrapolate: 'clamp' }),
          marginBottom: collapseAnim.interpolate({ inputRange: [0, cardH], outputRange: [0, spacing.md], extrapolate: 'clamp' }),
          overflow: 'hidden',
        } : batchCollapseAnims.current.has(lessonId) ? {
          backgroundColor: 'transparent',
          borderLeftWidth: 0,
          height: batchCollapseAnims.current.get(lessonId)!,
          padding: batchCollapseAnims.current.get(lessonId)!.interpolate({ inputRange: [0, cardH], outputRange: [0, spacing.lg], extrapolate: 'clamp' }),
          marginBottom: batchCollapseAnims.current.get(lessonId)!.interpolate({ inputRange: [0, cardH], outputRange: [0, spacing.md], extrapolate: 'clamp' }),
          overflow: 'hidden',
        } : null]}
        ref={(el) => { if (el) cardRefs.current[pageIdx].set(lessonId, el); }}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          const w = e.nativeEvent.layout.width;
          if (h > 0) itemHeightRef.current = h;
          if (w > 0) {
            cardWidthRef.current.set(lessonId, w);
            cardHeightRef.current.set(lessonId, h);
	          try { (e.target as any).measureInWindow((x: number, y: number) => { cardPosRef.current[pageIdx].set(lessonId, { x: x - containerOffRef.current.x, y: y - containerOffRef.current.y }); }); } catch (_) {}
          }
        }}
      >
        <View style={shatterMgr.activeId === lessonId ? { opacity: 0 } : null}>
          {cardInner(true)}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { maxWidth: maxContentWidth }]} ref={containerRef} onLayout={() => { try { containerRef.current?.measureInWindow?.((x: number, y: number) => { containerOffRef.current = { x, y }; }); } catch (e) {} }}>
      {/* ── Tab 筛选栏（由 scrollX 驱动，跟随横滑） ── */}
      <View style={styles.tabBarWrap}>
        <View style={styles.tabGroup} onLayout={(e) => setTabBarW(e.nativeEvent.layout.width)}>
          {tabBarW > 0 && (
            <Animated.View style={[styles.tabSlider, {
              width: scrollX.interpolate({ inputRange: [0, 2*SCREEN_W, 3*SCREEN_W], outputRange: [tabBarW/3, tabBarW/3, 0], extrapolate: 'clamp' }),
              backgroundColor: scrollX.interpolate({ inputRange: [0, SCREEN_W, 2*SCREEN_W, 3*SCREEN_W], outputRange: ['#6366F1',Colors.pending,Colors.paid,'#6b7280'] }),
              transform: [{ translateX: scrollX.interpolate({ inputRange: [0, 2*SCREEN_W, 3*SCREEN_W], outputRange: [0, 2*tabBarW/3, 3*tabBarW/3], extrapolate: 'clamp' }) }],
              opacity: scrollX.interpolate({ inputRange: [2*SCREEN_W, 3*SCREEN_W], outputRange: [1, 0], extrapolate: 'clamp' }),
            }]} />
          )}
          {FILTER_OPTIONS.slice(0, 3).map((opt, i) => (
            <TouchableOpacity key={opt.key} style={styles.tabBtn} activeOpacity={0.75} onPress={() => switchTab(opt.key)}>
              <Animated.Text style={[styles.tabBtnText, {
                color: scrollX.interpolate({
                  inputRange: [SCREEN_W*(i-1), SCREEN_W*i, SCREEN_W*(i+1)],
                  outputRange: [Colors.caption, '#FFF', Colors.caption],
                  extrapolate: 'clamp',
                }),
              }]}>{opt.label}</Animated.Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.tabSolo} activeOpacity={0.75} onPress={() => switchTab('all')}>
          <Animated.View style={[styles.tabSlider, {
            backgroundColor: scrollX.interpolate({ inputRange: [0, SCREEN_W, 2*SCREEN_W, 3*SCREEN_W], outputRange: ['#6366F1',Colors.pending,Colors.paid,'#6b7280'] }),
            opacity: scrollX.interpolate({ inputRange: [2*SCREEN_W, 3*SCREEN_W], outputRange: [0, 1], extrapolate: 'clamp' }),
          }]} />
          <View style={styles.tabBtn}>
            <Animated.Text style={[styles.tabBtnText, {
              color: scrollX.interpolate({
                inputRange: [2*SCREEN_W, 3*SCREEN_W, 4*SCREEN_W],
                outputRange: [Colors.caption, '#FFF', Colors.caption],
                extrapolate: 'clamp',
              }),
            }]}>全部</Animated.Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── 横滑分页内容 ── */}
      <Animated.ScrollView
        ref={pageScrollRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onPageScroll}
        onMomentumScrollEnd={onMomentumEnd}
        decelerationRate="fast"
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {pageData.map((data, idx) => (
          <View style={styles.pageWrap} key={idx}>
            {data.length === 0 ? (
              <EmptyState
                icon="book-outline"
                title={idx === 0 ? '没有待上课程' : idx === 2 ? '没有已收款记录' : idx === 1 ? '没有待收款记录' : '还没有课程记录'}
                subtitle={idx === 3 ? '点击右下角按钮记录第一节课' : undefined}
                buttonLabel={idx === 3 ? '添加课程' : undefined}
                onButtonPress={idx === 3 ? openAddModal : undefined}
              />
            ) : (
              <FlatList
                ref={(el) => { flatListRefs.current[idx] = el; }}
                data={data}
                renderItem={({ item }) => renderLesson({ item }, idx)}
                keyExtractor={(item) => item.id.toString()}
                nestedScrollEnabled
                contentContainerStyle={[{ padding: spacing.xl, paddingBottom: 100, paddingTop: 0 }]}
                onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
                scrollEventThrottle={16}
                initialNumToRender={15}
                windowSize={10}
                getItemLayout={(_, index) => {
                  const h = itemHeightRef.current;
                  return { length: h, offset: h * index, index };
                }}
                onScrollToIndexFailed={(info) => {
                  const retryInterval = setInterval(() => {
                    if (info.index < data.length) {
                      clearInterval(retryInterval);
                      flatListRefs.current[idx]?.scrollToIndex({ index: info.index, animated: true });
                    }
                  }, 50);
                  setTimeout(() => clearInterval(retryInterval), 1000);
                }}
                ListHeaderComponent={
                  <>
                    {idx === 0 && cpl.visible && (
                      <Animated.View style={[styles.batchBtnWrap, { marginBottom: spacing.md, transform:[{ translateY: cpl.translateY }], opacity: cpl.opacity, maxHeight: cpl.height }]}>
                        <TouchableOpacity style={[styles.batchBtn, { backgroundColor:Colors.dangerLight, borderColor:Colors.danger+'30' }]} activeOpacity={0.75} onPress={handleBatchComplete}>
                          <Ionicons name="time-outline" size={iconSize.lg} color={Colors.danger} />
                          <Text style={[styles.batchBtnText, { color:Colors.danger }]}>一键确认下课（{schedulableCount}节）</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                    {idx === 1 && coll.visible && (
                      <Animated.View style={[styles.batchBtnWrap, { marginBottom: spacing.md, transform:[{ translateY: coll.translateY }], opacity: coll.opacity, maxHeight: coll.height }]}>
                        <TouchableOpacity style={[styles.batchBtn, { backgroundColor:Colors.paidLight, borderColor:Colors.paid+'30' }]} activeOpacity={0.75} onPress={handleBatchCollect}>
                          <Ionicons name="wallet-outline" size={iconSize.lg} color={Colors.paid} />
                          <Text style={[styles.batchBtnText, { color:Colors.paid }]}>一键收款（{collectableCount}节）</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                  </>
                }
              />
            )}
          </View>
        ))}
      </Animated.ScrollView>


      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopBtn}
          activeOpacity={0.7}
          onPress={() => flatListRefs.current[FILTER_INDEX[filterStatus]]?.scrollToOffset({ offset: 0, animated: true })}
        >
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
                <ShredderStrip
                  key={`portal-shred-${strip.index}`}
                  index={strip.index}
                  cardWidth={shredPortal.cardW}
                  cardHeight={shredPortal.cardH}
                  fallDist={strip.fallDist}
                  driftX={strip.driftX}
                  rotateDeg={strip.rotateDeg}
                  delay={strip.delay}
                  onDone={shatterMgr.onStripDone}
                >
                  <View style={[styles.shredInner, { width: shredPortal.cardW, borderLeftWidth: 4, borderLeftColor: pBorderColor }]}>
                    {renderCardContent(portalLesson, false)}
                  </View>
                </ShredderStrip>
              ))}
            </View>
          </View>
        );
      })()}

      <BottomSheet visible={modalVisible} onClose={() => { setModalVisible(false); setEditingLesson(null); setSelectedSubjectId(null); setCurrentSubjects([]); setLessonRate(''); }} title={editingLesson ? '编辑课程' : '添加课程'}>

        {/* ── 重要信息区（学生/科目 + 日期/时段） ── */}
        <View style={styles.formCardWrapper}>
          <Text style={[styles.formLabel, { marginTop: 0 }]}>选择学生 / 科目</Text>
          <View style={styles.formRow}>
            <View style={styles.formHalf}>
              <DropdownSelect
                options={students.map(s => ({
                  label: s.name,
                  value: s.id,
                  leftIcon: <StudentAvatar name={s.name} size={iconSize.avatar.sm} />,
                }))}
                selectedValue={selectedStudentId}
                onSelect={(id) => setSelectedStudentId(id)}
                placeholder="请选择学生"
              />
            </View>
            <View style={styles.formHalf}>
              <DropdownSelect
                key={selectedStudentId}
                options={currentSubjects.map(sub => ({
                  label: sub.subject,
                  value: sub.id,
                  subtitle: `${sub.hourlyRate}元/小时`,
                }))}
                selectedValue={selectedSubjectId}
                onSelect={(id) => { setSelectedSubjectId(id); const sub = currentSubjects.find(s => s.id === id); if (sub) setLessonRate(sub.hourlyRate.toString()); }}
                placeholder="选择科目"
                disabled={currentSubjects.length <= 1}
              />
            </View>
          </View>

          <Text style={[styles.formLabel]}>上课日期 / 时段</Text>
          <View style={styles.formRow}>
            <View style={styles.formHalf}>
              <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={iconSize.md} color={Colors.primary} />
                <Text style={[styles.datePickerText, !date && styles.datePickerPlaceholder]}>
                  {date ? date.slice(5) : '选择日期'}
                </Text>
                <Animated.View style={{ transform: [{ rotate: calArrowRot.interpolate({ inputRange: [0,1], outputRange: ["0deg", "180deg"] }) }] }}><Ionicons name="chevron-down" size={iconSize.sm} color={Colors.caption} /></Animated.View>
              </TouchableOpacity>
            </View>
            <View style={styles.formHalf}>
              <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
                <Ionicons name="time-outline" size={iconSize.md} color={Colors.primary} />
                <Text style={[styles.datePickerText, !timeSlot && styles.datePickerPlaceholder]}>
                {timeSlot || '选择时段'}
              </Text>
              <Animated.View style={{ transform: [{ rotate: timeArrowRot.interpolate({ inputRange: [0,1], outputRange: ["0deg", "180deg"] }) }] }}><Ionicons name="chevron-down" size={iconSize.sm} color={Colors.caption} /></Animated.View>
            </TouchableOpacity>
          </View>
        </View>
        </View>

        <View style={styles.formRow}>
          <View style={styles.formHalf}>
            <Text style={[styles.formLabel]}>课时（小时）</Text>
            <TextInput style={styles.input} placeholder="如 1.5" value={duration} onChangeText={setDuration} keyboardType="numeric" placeholderTextColor={Colors.caption} />
          </View>
          <View style={styles.formHalf}>
            <Text style={[styles.formLabel]}>课时费（元/小时）</Text>
            <TextInput
              style={[styles.input, styles.rateInput]}
              placeholder="如 75"
              value={lessonRate}
              onChangeText={setLessonRate}
              keyboardType="numeric"
              placeholderTextColor={Colors.caption}
            />
          </View>
        </View>

        <View style={styles.amountPreview}>
          <Text style={[styles.amountPreviewLabel]}>预计课时费</Text>
          <Text style={[styles.amountPreviewValue]}>{calculateAmount().toFixed(0)}元</Text>
        </View>

        <Text style={[styles.formLabel]}>备注（可选）</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="添加备注..." value={notes} onChangeText={setNotes} multiline placeholderTextColor={Colors.caption} />

        <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave}>
          <Text style={[styles.saveButtonText]}>{editingLesson ? '更新课程' : '添加课程'}</Text>
        </TouchableOpacity>
      </BottomSheet>

      <CalendarPicker
        visible={showCalendar}
        value={date}
        onConfirm={setDate}
        onClose={() => setShowCalendar(false)}
      />

      <TimeRangePicker
        visible={showTimePicker}
        onConfirm={(sh, sm, eh, em) => {
          const slot = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}-${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
          setTimeSlot(slot);
        }}
        onClose={() => setShowTimePicker(false)}
      />

      {confirmDialog && (
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, Shadows.floating, { borderRadius: BorderRadius.card, maxWidth: isTablet ? 500 : 400 }]}>
            <Text style={[styles.confirmTitle]}>{confirmDialog.title}</Text>
            <Text style={[styles.confirmMessage]}>{confirmDialog.message}</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmDialog(null)}>
                <Text style={[styles.confirmCancelText]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmOkBtn} onPress={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}>
                <Text style={[styles.confirmOkText]}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default LessonScreen;
