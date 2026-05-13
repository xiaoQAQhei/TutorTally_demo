/**
 * ── 模块功能 ─────────────────────────────────────────────
 * HomeScreen - 首页/仪表盘
 *
 * 展示今日课程安排、快捷操作按钮和统计概览。
 * 在页面获得焦点时自动刷新数据，支持「确认下课」滑动动画、
 * 待收款总额与今日预计收益统计卡片。
 */
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Animated, DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Lesson, Student } from '../models';
import { getAllLessons, getAllStudents, setLessonStatus } from '../database';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { useFadeIn, useBounce } from '../styles/animations';
import { scale, useResponsive } from '../utils/responsive';
import { useAction } from '../contexts/ActionContext';
import {
  Colors, FontWeight, BorderRadius, Shadows,
} from '../styles/theme';

/** 课程列表项：含 category 区分「即将上课」还是「待确认下课」 */
type LessonItem = Lesson & { category: 'upcoming' | 'confirmable' };

/** HomeScreen 接收的导航属性 */
interface Props {
  navigation: { navigate: (screen: string) => void };
}

/** 快捷操作按钮配置：图标、标签、目标页面、颜色、附加动作 */
const QUICK_ACTIONS: { icon: string; label: string; screen: string; color: string; action: 'addStudent' | 'addLesson' | null }[] = [
  { icon: 'person-add', label: '添加学生', screen: 'Students', color: Colors.paid, action: 'addStudent' },
  { icon: 'book', label: '记录课程', screen: 'Lessons', color: Colors.primary, action: 'addLesson' },
  { icon: 'stats-chart', label: '查看统计', screen: 'Stats', color: Colors.pending, action: null },
];

/**
 * HomeScreen 组件
 *
 * 首页仪表盘，显示今日待上课程和已下课待确认课程，以及统计概览。
 * - useAction() 用于与课程页面的跨页面交互（pending action / filter / highlight）
 * - 页面聚焦时通过 useFocusEffect 自动刷新数据
 */
const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { setPendingAction, setPendingFilter, setHighlightLessonId, confirmBeforeChange } = useAction();
  const [recentLessons, setRecentLessons] = useState<LessonItem[]>([]);   // 今日课程列表
  const [students, setStudents] = useState<Student[]>([]);                 // 所有学生（用于查找姓名）
  const [pendingAmount, setPendingAmount] = useState(0);                  // 待收款总额
  const [todayEarnings, setTodayEarnings] = useState(0);                  // 今日预计收益
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void } | null>(null); // 确认弹窗状态
  const [morphingId, setMorphingId] = useState<number | null>(null);      // 正在执行滑动动画的课程 ID
  const slideAnims = useRef<Map<number, Animated.Value>>(new Map());      // 「确认下课」滑出动画的位移值
  const slideOpAnims = useRef<Map<number, Animated.Value>>(new Map());    // 「确认下课」滑出动画的透明度值

  useFocusEffect(useCallback(() => { loadData(); }, []));

  /**
   * loadData - 加载首页全部数据
   *
   * 1. 自动将已过 scheduled 状态的课程标记为 completed
   * 2. 筛选今日课程：scheduled → upcoming, completed → confirmable
   * 3. 计算待收款总额（paid / cancelled 之外的所有未付课程）
   * 4. 计算今日预计收益
   */
  const loadData = async () => {
    let lessons = await getAllLessons();
    const now = new Date();
    for (const l of lessons) {
      if (l.status === 'scheduled' && l.timeSlot) {
        const endTime = l.timeSlot.split('-')[1]?.trim();
        if (endTime && now >= new Date(`${l.date}T${endTime}:00`)) {
          await setLessonStatus(l.id, 'completed');
        }
      }
    }
    lessons = await getAllLessons();
    const studentsData = await getAllStudents();
    setStudents(studentsData);
    const today = new Date().toISOString().split('T')[0];

    const upcoming: LessonItem[] = [];
    const confirmable: LessonItem[] = [];
    for (const l of lessons) {
      if (l.date !== today) continue;
      if (l.status === 'scheduled') {
        upcoming.push({ ...l, category: 'upcoming' });
      } else if (l.status === 'completed') {
        confirmable.push({ ...l, category: 'confirmable' });
      }
    }
    confirmable.sort((a, b) => a.date.localeCompare(b.date));
    upcoming.sort((a, b) => a.date.localeCompare(b.date));
    setRecentLessons([...confirmable, ...upcoming].slice(0, 30));

    const pending = lessons.filter((l) => {
      if (l.status === 'paid') return false;
      if (l.status === 'pendingPayment') return true;
      if (l.date < today) return l.status !== 'cancelled';
      return false;
    }).reduce((sum, l) => sum + l.amount, 0);
    setPendingAmount(pending);

    const todayLessons = lessons.filter((l) => l.date === today);
    setTodayEarnings(todayLessons.reduce((sum, l) => sum + l.amount, 0));
  };

  /**
   * handleConfirmPayment - 处理「确认下课」点击事件
   *
   * 触发滑动动画（卡片向右滑出），动画结束后将课程状态更新为 pendingPayment（待收款）。
   * 如果 confirmBeforeChange 开启，则先弹确认对话框。
   * @param id 课程 ID
   */
  const handleConfirmPayment = (id: number) => {
    const doConfirm = () => {
      if (!slideAnims.current.has(id)) {
        slideAnims.current.set(id, new Animated.Value(0));
        slideOpAnims.current.set(id, new Animated.Value(1));
      }
      const sx = slideAnims.current.get(id)!;
      const so = slideOpAnims.current.get(id)!;
      sx.setValue(0);
      so.setValue(1);
      setMorphingId(id);
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(sx, { toValue: 400, duration: 350, useNativeDriver: false }),
          Animated.timing(so, { toValue: 0, duration: 350, useNativeDriver: false }),
        ]).start(async () => {
          sx.setValue(0);
          so.setValue(1);
          setMorphingId(null);
          await setLessonStatus(id, 'pendingPayment');
          loadData();
        });
      }, 300);
    };
    if (confirmBeforeChange) {
      setConfirmDialog({ visible: true, title: '确认操作', message: '确定要标记为「待收款」吗？', onConfirm: doConfirm });
    } else {
      doConfirm();
    }
  };

  /** 根据学生 ID 查找学生对象 */
  const getStudent = (studentId: number) => students.find((s) => s.id === studentId);
  const { spacing, fontSize, isTablet, iconSize } = useResponsive();
  const { opacity, translateY } = useFadeIn();

  // ── 样式（响应式，随 spacing/fontSize/iconSize 变化） ──
  const styles = useMemo(() => ({
    // ═══════════════ 页面容器 ═══════════════
    container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, width: '100%' as const, alignSelf: 'center' as const },

    // ═══════════════ 顶部栏 ═══════════════
    header: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: spacing.lg, gap: spacing.md },
    greeting: { fontSize: fontSize.h1, fontWeight: FontWeight.bold, color: Colors.title },           // 问候语
    date: { fontSize: fontSize.caption, color: Colors.caption, marginTop: spacing.xs },              // 日期
    refreshButton: { width: scale(44), height: scale(44), borderRadius: scale(22), backgroundColor: Colors.card, justifyContent: 'center' as const, alignItems: 'center' as const, ...Shadows.subtle },

    // ═══════════════ 快捷操作按钮 ═══════════════
    quickActionsRow: { flexDirection: 'row' as const, gap: spacing.md, marginBottom: spacing.lg },
    quickActionLabel: { fontSize: fontSize.small, color: Colors.body, fontWeight: FontWeight.medium },

    // ═══════════════ 今日课程列表 ═══════════════
    lessonList: { flex: 1 },
    sectionHeaderRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: spacing.md },
    sectionTitle: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },       // "今日待上课"
    viewAll: { fontSize: fontSize.caption, color: Colors.primary, fontWeight: FontWeight.semiBold },  // "查看全部"

    // ═══════════════ 课程卡片 ═══════════════
    recentItem: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: Colors.card, borderRadius: BorderRadius.card },
    recentItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },                   // 分割线
    colorBar: { width: scale(4), height: scale(40), borderRadius: BorderRadius.smallCard, marginRight: spacing.md }, // 左侧色条
    recentLeft: { maxWidth: scale(80) },                                                             // 学生名+日期（限宽）
    recentName: { fontSize: fontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title },    // 学生名
    recentDate: { fontSize: fontSize.small, color: Colors.caption },                                 // 日期
    recentCenter: { flex: 1, alignItems: 'center' as const },                                        // 时间段容器
    recentTimeSlot: { fontSize: fontSize.h2, fontWeight: FontWeight.bold, color: Colors.primary, backgroundColor: Colors.primaryLight, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, borderRadius: BorderRadius.smallCard, overflow: 'hidden' as const }, // 时间段标签
    recentContentLeft: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const },     // 卡片左侧可点击

    // ═══════════════ 右侧（金额 + 状态徽章）═══════════════
    recentRight: { alignItems: 'flex-end' as const },
    recentAmount: { fontSize: fontSize.body, fontWeight: FontWeight.bold, color: Colors.title },     // 金额
    confirmRight: { alignItems: 'flex-end' as const, paddingVertical: spacing.sm, paddingLeft: spacing.lg },
    miniBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: BorderRadius.pill }, // "待上" 徽章
    miniBadgeText: { fontSize: fontSize.small, fontWeight: FontWeight.semiBold },
    confirmBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: BorderRadius.pill, backgroundColor: Colors.dangerLight }, // "确认/待收款" 徽章
    confirmBadgeText: { fontSize: fontSize.small, fontWeight: FontWeight.semiBold, color: Colors.danger },

    // ═══════════════ 底部统计卡片 ═══════════════
    overviewRow: { flexDirection: 'row' as const, gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
    overviewLarge: { flex: 0.5 }, overviewSmall: { flex: 0.5 },

    // ═══════════════ 确认弹窗 ═══════════════
    confirmOverlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.overlay, justifyContent: 'center' as const, alignItems: 'center' as const, zIndex: 200 },
    confirmBox: { backgroundColor: Colors.card, padding: spacing.xxl, width: '80%' as DimensionValue },
    confirmTitle: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: spacing.md, textAlign: 'center' as const },
    confirmMessage: { fontSize: fontSize.body, color: Colors.body, marginBottom: spacing.xl, textAlign: 'center' as const },
    confirmButtons: { flexDirection: 'row' as const, gap: spacing.md },
    confirmCancelBtn: { flex: 1, height: spacing.xxxl, borderRadius: BorderRadius.pill, backgroundColor: Colors.background, justifyContent: 'center' as const, alignItems: 'center' as const },
    confirmCancelText: { fontSize: fontSize.body, color: Colors.caption, fontWeight: FontWeight.medium },
    confirmOkBtn: { flex: 1, height: spacing.xxxl, borderRadius: BorderRadius.pill, backgroundColor: Colors.primary, justifyContent: 'center' as const, alignItems: 'center' as const },
    confirmOkText: { fontSize: fontSize.body, color: Colors.white, fontWeight: FontWeight.semiBold },
  }), [spacing, fontSize, iconSize]);

  /**
   * renderLessonItem - 渲染单个课程卡片
   *
   * 根据 category 区分两种卡片样式：
   * - confirmable（已下课待确认）：显示「确认下课/待收款」徽章，点击触发 morphing 动画
   * - upcoming（待上课）：显示「待上」徽章，仅展示信息
   * @param item 课程项（含 category 分类标记）
   * @param index 列表索引
   */
  const renderLessonItem = ({ item, index }: { item: LessonItem; index: number }) => {
    const student = getStudent(item.studentId);
    const isLast = index === recentLessons.length - 1;
    const navigateToLesson = () => {
      setPendingFilter('upcoming');
      setHighlightLessonId(item.id);
      navigation.navigate('Lessons');
    };

    if (item.category === 'confirmable') {
      const isMorphing = morphingId === item.id;
      if (!slideAnims.current.has(item.id)) {
        slideAnims.current.set(item.id, new Animated.Value(0));
        slideOpAnims.current.set(item.id, new Animated.Value(1));
      }
      const sx = slideAnims.current.get(item.id)!;
      const so = slideOpAnims.current.get(item.id)!;
      const morphBorderColor = isMorphing ? Colors.pending : Colors.danger;
      const morphBadgeBg = isMorphing ? '#FEF3C7' : '#FEE2E2';
      const morphBadgeColor = isMorphing ? Colors.pending : Colors.danger;
      const morphBadgeLabel = isMorphing ? '待收款' : '确认下课';
      return (
        <Animated.View style={[styles.recentItem, !isLast && styles.recentItemBorder, {
          opacity: isMorphing ? so : 1,
          transform: [{ translateX: sx }],
        }]}>
          {/* ── 左侧色条 ── */}
          <View style={[styles.colorBar, { backgroundColor: morphBorderColor }]} />
          <TouchableOpacity style={styles.recentContentLeft} activeOpacity={0.6} onPress={navigateToLesson}>
            {/* ── 学生名 + 日期 ── */}
            <View style={styles.recentLeft}>
              <Text style={styles.recentName} numberOfLines={1}>{student?.name || '未知学生'}</Text>
              <Text style={styles.recentDate}>{item.date}</Text>
            </View>
            {/* ── 时间段 ── */}
            <View style={styles.recentCenter}>
              {item.timeSlot ? <Text style={styles.recentTimeSlot}>{item.timeSlot}</Text> : null}
            </View>
          </TouchableOpacity>
          {/* ── 金额 + 确认徽章 ── */}
          <TouchableOpacity style={styles.confirmRight} activeOpacity={0.7} onPress={() => handleConfirmPayment(item.id)}>
            <Text style={styles.recentAmount}>{item.amount.toFixed(0)}元</Text>
            <View style={[styles.confirmBadge, { backgroundColor: morphBadgeBg }]}>
              <Ionicons name="checkmark-circle" size={iconSize.xs} color={morphBadgeColor} />
              <Text style={[styles.confirmBadgeText, { color: morphBadgeColor }]}>{morphBadgeLabel}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    return (
      <View style={[styles.recentItem, !isLast && styles.recentItemBorder]}>
        {/* ── 左侧色条 ── */}
        <View style={[styles.colorBar, { backgroundColor: Colors.primary }]} />
        <TouchableOpacity style={styles.recentContentLeft} activeOpacity={0.6} onPress={navigateToLesson}>
          {/* ── 学生名 + 日期 ── */}
          <View style={styles.recentLeft}>
            <Text style={styles.recentName} numberOfLines={1}>{student?.name || '未知学生'}</Text>
            <Text style={styles.recentDate}>{item.date}</Text>
          </View>
          {/* ── 时间段 ── */}
          <View style={styles.recentCenter}>
            {item.timeSlot ? <Text style={styles.recentTimeSlot}>{item.timeSlot}</Text> : null}
          </View>
        </TouchableOpacity>
        {/* ── 金额 + 待上徽章 ── */}
        <View style={[styles.recentRight, styles.confirmRight]}>
          <Text style={styles.recentAmount}>{item.amount.toFixed(0)}元</Text>
          <View style={[styles.miniBadge, { backgroundColor: Colors.primaryLight }]}>
            <Text style={[styles.miniBadgeText, { color: Colors.primary }]}>待上</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderListHeader = () => (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>今日待上课</Text>
      <TouchableOpacity onPress={() => {
        setPendingFilter('upcoming');
        navigation.navigate('Lessons');
      }}>
        <Text style={styles.viewAll}>查看全部</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
        {/* ── 顶部栏 ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>🙂你好，老师</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
              })}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={loadData} activeOpacity={0.7}>
            <Ionicons name="refresh" size={iconSize.lg} color={Colors.title} />
          </TouchableOpacity>
        </View>

        {/* ── 快捷操作按钮 ── */}
        <View style={styles.quickActionsRow}>
          {QUICK_ACTIONS.map((item, index) => (
            <QuickActionButton
              key={item.screen + index}
              item={item}
              onPress={() => {
                if (item.action) setPendingAction(item.action);
                navigation.navigate(item.screen);
              }}
            />
          ))}
        </View>

        {/* ── 今日课程列表 ── */}
        <FlatList
          data={recentLessons}
          renderItem={renderLessonItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.lessonList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={
            <EmptyState
              icon="book-outline"
              title="今天没有待上课程"
              subtitle="去课程记录添加未来的课程安排"
              buttonLabel="添加课程"
              onButtonPress={() => { setPendingAction('addLesson'); navigation.navigate('Lessons'); }}
            />
          }
        />

        {/* ── 底部统计卡片 ── */}
        <View style={styles.overviewRow}>
          <View style={styles.overviewLarge}>
            <StatCard
              icon="alert-circle"
              label="待收款总额"
              value={`${pendingAmount.toFixed(0)}元`}
              color={Colors.pending}
              onPress={() => {
                setPendingFilter('unpaid');
                navigation.navigate('Lessons');
              }}
            />
          </View>
          <View style={styles.overviewSmall}>
            <StatCard
              icon="flash"
              label="今日预计收益"
              value={`${todayEarnings.toFixed(0)}元`}
              color={Colors.primary}
            />
          </View>
        </View>
      </Animated.View>

      {/* ── 确认弹窗 ── */}
      {confirmDialog && (
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, Shadows.floating, { borderRadius: BorderRadius.card, maxWidth: isTablet ? 500 : 400 }]}>
            <Text style={styles.confirmTitle}>{confirmDialog.title}</Text>
            <Text style={styles.confirmMessage}>{confirmDialog.message}</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmDialog(null)}>
                <Text style={styles.confirmCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmOkBtn} onPress={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}>
                <Text style={styles.confirmOkText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

/**
 * QuickActionButton - 快捷操作按钮组件
 *
 * 图标 + 标签的垂直布局按钮，带弹跳点击动画。
 * @param item 按钮配置（图标、标签、颜色等）
 * @param onPress 点击回调
 */
const QuickActionButton: React.FC<{
  item: typeof QUICK_ACTIONS[0];
  onPress: () => void;
}> = ({ item, onPress }) => {
  const { scale: bounceScale, bounce } = useBounce(onPress);
  const { spacing, fontSize, iconSize } = useResponsive();

  const btnStyles = useMemo(() => ({
    quickAction: { backgroundColor: item.color + '12', paddingVertical: spacing.lg, flex: 1 as const, borderRadius: BorderRadius.card, alignItems: 'center' as const },
    quickActionIcon: { backgroundColor: item.color + '22', width: iconSize.container.md, height: iconSize.container.md, borderRadius: iconSize.container.md / 2, marginBottom: spacing.xs, justifyContent: 'center' as const, alignItems: 'center' as const },
    quickActionLabel: { fontSize: fontSize.small, color: Colors.body, fontWeight: FontWeight.medium },
  }), [spacing, fontSize, iconSize]);

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={bounce} style={btnStyles.quickAction}>
      <Animated.View style={{ transform: [{ scale: bounceScale }], alignItems: 'center' }}>
        {/* ── 图标容器 ── */}
        <View style={btnStyles.quickActionIcon}>
          <Ionicons name={item.icon as any} size={iconSize.xl} color={item.color} />
        </View>
        {/* ── 按钮标签 ── */}
        <Text style={btnStyles.quickActionLabel}>{item.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default HomeScreen;
