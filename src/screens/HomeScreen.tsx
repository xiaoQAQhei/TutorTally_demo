import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Lesson, Student } from '../models';
import { getAllLessons, getAllStudents, setLessonStatus } from '../database';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { useFadeIn, useBounce } from '../styles/animations';
import { vw, scale, verticalScale, rem, useResponsive } from '../utils/responsive';
import { useAction } from '../contexts/ActionContext';
import {
  Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows,
} from '../styles/theme';

type LessonItem = Lesson & { category: 'upcoming' | 'confirmable' };

interface Props {
  navigation: { navigate: (screen: string) => void };
}

const QUICK_ACTIONS: { icon: string; label: string; screen: string; color: string; action: 'addStudent' | 'addLesson' | null }[] = [
  { icon: 'person-add', label: '添加学生', screen: 'Students', color: Colors.paid, action: 'addStudent' },
  { icon: 'book', label: '记录课程', screen: 'Lessons', color: Colors.primary, action: 'addLesson' },
  { icon: 'stats-chart', label: '查看统计', screen: 'Stats', color: Colors.pending, action: null },
];

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { setPendingAction, setPendingFilter, setHighlightLessonId, confirmBeforeChange } = useAction();
  const [recentLessons, setRecentLessons] = useState<LessonItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [morphingId, setMorphingId] = useState<number | null>(null);
  const slideAnims = useRef<Map<number, Animated.Value>>(new Map());
  const slideOpAnims = useRef<Map<number, Animated.Value>>(new Map());

  useFocusEffect(useCallback(() => { loadData(); }, []));

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

  const getStudent = (studentId: number) => students.find((s) => s.id === studentId);
  const { maxContentWidth, spacing, fontSize, isTablet, iconSize } = useResponsive();
  const { opacity, translateY } = useFadeIn();

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
          {/* 左侧色条 */}
          <View style={[styles.colorBar, { backgroundColor: morphBorderColor }]} />
          <TouchableOpacity style={styles.recentContentLeft} activeOpacity={0.6} onPress={navigateToLesson}>
            {/* 学生名 + 日期 */}
            <View style={styles.recentLeft}>
              <Text style={[styles.recentName, { fontSize: fontSize.body }]} numberOfLines={1}>{student?.name || '未知学生'}</Text>
              <Text style={[styles.recentDate, { fontSize: fontSize.small }]}>{item.date}</Text>
            </View>
            {/* 时间段 */}
            <View style={styles.recentCenter}>
              {item.timeSlot ? <Text style={[styles.recentTimeSlot, { fontSize: fontSize.h2 }]}>{item.timeSlot}</Text> : null}
            </View>
          </TouchableOpacity>
          {/* 金额 + 确认徽章 */}
          <TouchableOpacity style={styles.confirmRight} activeOpacity={0.7} onPress={() => handleConfirmPayment(item.id)}>
            <Text style={[styles.recentAmount, { fontSize: fontSize.body }]}>{item.amount.toFixed(0)}元</Text>
            <View style={[styles.confirmBadge, { backgroundColor: morphBadgeBg }]}>
              <Ionicons name="checkmark-circle" size={iconSize.xs} color={morphBadgeColor} />
              <Text style={[styles.confirmBadgeText, { color: morphBadgeColor, fontSize: fontSize.small }]}>{morphBadgeLabel}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    return (
      <View style={[styles.recentItem, !isLast && styles.recentItemBorder]}>
        {/* 左侧色条 */}
        <View style={[styles.colorBar, { backgroundColor: Colors.primary }]} />
        <TouchableOpacity style={styles.recentContentLeft} activeOpacity={0.6} onPress={navigateToLesson}>
          {/* 学生名 + 日期 */}
          <View style={styles.recentLeft}>
            <Text style={[styles.recentName, { fontSize: fontSize.body }]} numberOfLines={1}>{student?.name || '未知学生'}</Text>
            <Text style={[styles.recentDate, { fontSize: fontSize.small }]}>{item.date}</Text>
          </View>
          {/* 时间段 */}
          <View style={styles.recentCenter}>
            {item.timeSlot ? <Text style={[styles.recentTimeSlot, { fontSize: fontSize.h2 }]}>{item.timeSlot}</Text> : null}
          </View>
        </TouchableOpacity>
        {/* 金额 + 待上徽章 */}
        <View style={[styles.recentRight, styles.confirmRight]}>
          <Text style={[styles.recentAmount, { fontSize: fontSize.body }]}>{item.amount.toFixed(0)}元</Text>
          <View style={[styles.miniBadge, { backgroundColor: Colors.primaryLight }]}>
            <Text style={[styles.miniBadgeText, { color: Colors.primary, fontSize: fontSize.small }]}>待上</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderListHeader = () => (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionTitle, { fontSize: fontSize.h3 }]}>今日待上课</Text>
      <TouchableOpacity onPress={() => {
        setPendingFilter('upcoming');
        navigation.navigate('Lessons');
      }}>
        <Text style={[styles.viewAll, { fontSize: fontSize.caption }]}>查看全部</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
        {/* ===== 顶部栏 ===== */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { fontSize: fontSize.h1 }]}>🙂你好，老师</Text>
            <Text style={[styles.date, { fontSize: fontSize.caption }]}>
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
              })}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={loadData} activeOpacity={0.7}>
            <Ionicons name="refresh" size={iconSize.lg} color={Colors.title} />
          </TouchableOpacity>
        </View>

        {/* ===== 快捷操作按钮 ===== */}
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

        {/* ===== 今日课程列表 ===== */}
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

        {/* ===== 底部统计卡片 ===== */}
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

      {/* ===== 确认弹窗 ===== */}
      {confirmDialog && (
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, Shadows.floating, { borderRadius: BorderRadius.card, maxWidth: isTablet ? 500 : 400 }]}>
            <Text style={[styles.confirmTitle, { fontSize: fontSize.h3 }]}>{confirmDialog.title}</Text>
            <Text style={[styles.confirmMessage, { fontSize: fontSize.body }]}>{confirmDialog.message}</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmDialog(null)}>
                <Text style={[styles.confirmCancelText, { fontSize: fontSize.body }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmOkBtn} onPress={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}>
                <Text style={[styles.confirmOkText, { fontSize: fontSize.body }]}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const QuickActionButton: React.FC<{
  item: typeof QUICK_ACTIONS[0];
  onPress: () => void;
}> = ({ item, onPress }) => {
  const { scale: bounceScale, bounce } = useBounce(onPress);
  const { isTablet, isUltraNarrow, spacing, fontSize, iconSize } = useResponsive();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={bounce}
      style={[styles.quickAction, { backgroundColor: item.color + '12', paddingVertical: isTablet ? spacing.xl : isUltraNarrow ? spacing.sm : spacing.lg }]}
    >
      <Animated.View style={{ transform: [{ scale: bounceScale }], alignItems: 'center' }}>
        {/* 图标容器 */}
        <View style={[styles.quickActionIcon, { backgroundColor: item.color + '22', width: iconSize.container.md, height: iconSize.container.md, borderRadius: iconSize.container.md / 2, marginBottom: spacing.xs }]}>
          <Ionicons name={item.icon as any} size={iconSize.xl} color={item.color} />
        </View>
        {/* 按钮标签 */}
        <Text style={[styles.quickActionLabel, { fontSize: fontSize.small }]}>{item.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // ═══════════════ 整个页面容器 ═══════════════
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, width: '100%', alignSelf: 'center' },

  // ═══════════════ 顶部栏（问候语 + 刷新按钮）═══════════════
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.lg, gap: Spacing.md,
  },
  greeting: { fontSize: FontSize.h1, fontWeight: FontWeight.bold, color: Colors.title },        // 问候文字 "🙂你好，老师"
  date: { fontSize: FontSize.caption, color: Colors.caption, marginTop: Spacing.xs },             // 日期文字
  refreshButton: {                                                                                // 刷新按钮
    width: scale(44), height: scale(44), borderRadius: scale(22),
    backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center',
    ...Shadows.subtle,
  },

  // ═══════════════ 快捷操作按钮（添加学生 / 记录课程 / 查看统计）═══════════════
  quickActionsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },          // 三个按钮的容器
  quickAction: {                                                                                  // 单个按钮
    flex: 1, paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.card, alignItems: 'center',
  },
  quickActionIcon: { justifyContent: 'center', alignItems: 'center' },                            // 图标容器（尺寸走 inline）
  quickActionLabel: { fontSize: FontSize.small, color: Colors.body, fontWeight: FontWeight.medium }, // 按钮标签文字

  // ═══════════════ 今日课程列表 ═══════════════
  lessonList: { flex: 1 },
  sectionHeaderRow: {                                                                             // "今日待上课" 标题行
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },      // "今日待上课" 文字
  viewAll: { fontSize: FontSize.caption, color: Colors.primary, fontWeight: FontWeight.semiBold },// "查看全部" 文字

  // ═══════════════ 课程卡片 ═══════════════
  recentItem: {                                                                                   // 单张卡片
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    backgroundColor: Colors.card,
  },
  recentItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },                  // 卡片之间分割线
  colorBar: { width: scale(4), height: scale(40), borderRadius: scale(2), marginRight: Spacing.md }, // 左侧色条
  recentLeft: { maxWidth: scale(80) },                                                            // 学生名+日期区域（限宽防过长）
  recentName: {                                                                                   // 学生名
    fontSize: FontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title,
    marginBottom: 2,
  },
  recentDate: { fontSize: FontSize.small, color: Colors.caption },                                // 日期
  recentCenter: { flex: 1, alignItems: 'center' },                                                // 时间段容器
  recentTimeSlot: {                                                                               // 时间段标签（如 "10:00-12:00"）
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    backgroundColor: Colors.primaryLight || '#EEF0FF',
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.smallCard,
    overflow: 'hidden',
  },
  recentContentLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },                     // 卡片左侧可点击区域（学生名+时间段）

  // ═══════════════ 卡片右侧（金额 + 状态徽章）═══════════════
  recentRight: { alignItems: 'flex-end' },                                                        // 右侧常规布局
  recentAmount: {                                                                                 // 金额文字 "200元"
    fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.title,
    marginBottom: 4,
  },
  confirmRight: {                                                                                 // 确认下课版右侧
    alignItems: 'flex-end', paddingVertical: Spacing.sm, paddingLeft: Spacing.lg,
  },
  miniBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.pill }, // "待上" 徽章
  miniBadgeText: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold },
  confirmBadge: {                                                                                 // "确认下课" / "待收款" 徽章
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.pill, backgroundColor: '#FEE2E2',
  },
  confirmBadgeText: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold, color: Colors.danger },

  // ═══════════════ 底部统计卡片 ═══════════════
  overviewRow: {                                                                                  // 统计卡片容器
    flexDirection: 'row', gap: Spacing.md,
    marginTop: Spacing.md, marginBottom: Spacing.md,
  },
  overviewLarge: { flex: 0.55 },                                                                  // 左侧卡片（待收款）占 55%
  overviewSmall: { flex: 0.45 },                                                                  // 右侧卡片（今日收益）占 45%

  // ═══════════════ 确认弹窗 ═══════════════
  confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', zIndex: 200 },
  confirmBox: { backgroundColor: Colors.card, padding: Spacing.xxl, width: '80%' },               // 弹窗容器
  confirmTitle: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: Spacing.md, textAlign: 'center' },
  confirmMessage: { fontSize: FontSize.body, color: Colors.body, marginBottom: Spacing.xl, textAlign: 'center' },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },                                       // 按钮行
  confirmCancelBtn: { flex: 1, height: scale(48), borderRadius: scale(24), backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  confirmCancelText: { fontSize: FontSize.body, color: Colors.caption, fontWeight: FontWeight.medium },
  confirmOkBtn: { flex: 1, height: scale(48), borderRadius: scale(24), backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  confirmOkText: { fontSize: FontSize.body, color: Colors.white, fontWeight: FontWeight.semiBold },
});

export default HomeScreen;