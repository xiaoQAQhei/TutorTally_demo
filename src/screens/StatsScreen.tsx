/**
 * ── 模块功能 ─────────────────────────────────────────────
 * StatsScreen - 统计与分析页面
 *
 * 按月展示家教业务的统计数据，包含：
 * - 月份切换选择器（左右箭头切换）
 * - 顶部统计条（学生数/课时数/时长/收入）
 * - 近 6 月收入趋势柱状图（react-native-gifted-charts）
 * - 本月收款概览（已收比例进度条）
 * - 每个学生的月度账单卡片（点击可查看详细账单）
 */
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-gifted-charts';
import { StudentStats, Student, StudentSubject, Lesson } from '../models';
import { getAllStudents, getLessonsByStudentId, getAllLessons, getSubjectsByStudentId } from '../database';
import EmptyState from '../components/EmptyState';
import StudentBillingDetailScreen from './StudentBillingDetailScreen';
import {
  Colors, FontWeight, BorderRadius, Shadows,
} from '../styles/theme';
import { useResponsive, scale, moderateScale } from '../utils/responsive';

const MONTH_NAMES: Record<string, string> = {
  '01': '1月', '02': '2月', '03': '3月', '04': '4月',
  '05': '5月', '06': '6月', '07': '7月', '08': '8月',
  '09': '9月', '10': '10月', '11': '11月', '12': '12月',
};

/**
 * StatsScreen 组件
 *
 * 统计分析主页，按月份查看汇总数据和学生账单。
 * 月份切换时自动重新计算统计值。
 * 每个学生卡片可点击，弹出 StudentBillingDetailScreen 查看详细月度分布。
 */
const StatsScreen: React.FC = () => {
  const currentMonth = new Date().toISOString().substring(0, 7);        // 当前月份 "YYYY-MM"
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);      // 用户选择的月份
  const [stats, setStats] = useState<StudentStats[]>([]);                // 所有学生的统计
  const [totalStats, setTotalStats] = useState({                        // 全局汇总统计
    totalStudents: 0, totalLessons: 0, totalHours: 0,
    totalAmount: 0, paidAmount: 0, pendingAmount: 0,
  });
  const [monthStats, setMonthStats] = useState({ paid: 0, pending: 0, total: 0 }); // 选中月份的收款数据
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null); // 选中的学生（查看详细账单）
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);           // 全部课程（用于图表和筛选）
  const [chartCardWidth, setChartCardWidth] = useState(0);              // 柱状图容器宽度（动态计算）
  const { maxContentWidth, isTablet, spacing, fontSize } = useResponsive();

  // ── 响应式样式（随 spacing/fontSize 变化） ──
  const styles = useMemo(() => ({
    // ═══════════════ 页面容器 ═══════════════
    container: { flex: 1, backgroundColor: Colors.background, width: '100%' as const, alignSelf: 'center' as const },
    scrollContent: { paddingBottom: 100 },

    // ═══════════════ 月份选择器 ═══════════════
    monthSelector: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
      marginBottom: spacing.xl, gap: spacing.lg,
    },
    monthArrow: {
      width: scale(36), height: scale(36), borderRadius: scale(18),
      backgroundColor: Colors.primaryLight,
      justifyContent: 'center' as const, alignItems: 'center' as const,
    },
    monthLabel: {
      fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
      minWidth: 120, textAlign: 'center' as const,
    },

    // ═══════════════ 顶部统计条 ═══════════════
    statsBar: {
      flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'stretch' as const,
      backgroundColor: Colors.card, borderRadius: BorderRadius.card,
      paddingVertical: spacing.md, marginBottom: spacing.xl,
    },
    statsBarItem: { flex: 1, flexBasis: 0, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: spacing.xs },
    statsBarValue: {
      fontSize: fontSize.body, fontWeight: FontWeight.bold, color: Colors.title,
      marginBottom: spacing.xs,
    },
    statsBarLabel: { fontSize: fontSize.small, color: Colors.caption },
    statsBarDivider: {
      width: 1, height: 28, backgroundColor: Colors.divider, alignSelf: 'center' as const,
    },

    // ═══════════════ 收入柱状图 ═══════════════
    chartCard: {
      backgroundColor: Colors.card, borderRadius: BorderRadius.card,
      padding: spacing.lg, marginBottom: spacing.xl,
    },
    chartTitle: {
      fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
      marginBottom: spacing.md,
    },
    chartWrap: { overflow: 'hidden' as const },
    barTopLabel: {
      fontSize: fontSize.small, fontWeight: FontWeight.semiBold, color: Colors.primary,
      marginBottom: spacing.xs,
    },

    // ═══════════════ 月度概览卡片 ═══════════════
    overviewCard: {
      backgroundColor: Colors.card, borderRadius: BorderRadius.card,
      padding: spacing.xl, marginBottom: spacing.xl,
    },
    overviewTitle: {
      fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
      marginBottom: spacing.lg,
    },
    progressTrack: {
      height: scale(8), backgroundColor: Colors.pendingBg, borderRadius: scale(4),
      marginBottom: spacing.xl, overflow: 'hidden' as const,
    },
    progressFill: {
      height: '100%' as const, backgroundColor: Colors.paid, borderRadius: scale(4),
    },
    overviewRow: {
      flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'space-around' as const, alignItems: 'center' as const,
      gap: spacing.sm,
    },
    overviewItem: { alignItems: 'center' as const },
    overviewLabel: { fontSize: fontSize.small, color: Colors.caption, marginTop: 2 },
    overviewValue: { fontSize: fontSize.h2, fontWeight: FontWeight.bold, color: Colors.primary },
    overviewDetail: { fontSize: fontSize.body, fontWeight: FontWeight.semiBold },
    overviewDivider: { width: 1, height: 32, backgroundColor: Colors.divider },

    // ═══════════════ 分区标题 ═══════════════
    sectionTitle: {
      fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
      marginBottom: spacing.md,
    },

    // ═══════════════ 学生账单卡片 ═══════════════
    studentCard: {
      backgroundColor: Colors.card, borderRadius: BorderRadius.card,
      padding: spacing.lg, marginBottom: spacing.md,
    },
    studentCardLast: { marginBottom: 0 },
    studentHeader: {
      flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const,
      marginBottom: spacing.sm,
    },
    studentInfo: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    studentDot: { width: scale(10), height: scale(10), borderRadius: scale(5) },
    studentName: { fontSize: fontSize.body, fontWeight: FontWeight.bold, color: Colors.title },
    studentSubject: { fontSize: fontSize.small, color: Colors.caption, marginTop: spacing.xs },
    pendingTag: {
      backgroundColor: Colors.dangerBg, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
      borderRadius: BorderRadius.pill,
    },
    pendingTagText: { fontSize: fontSize.small, fontWeight: FontWeight.semiBold, color: Colors.danger },
    studentStats: { marginBottom: spacing.md },
    studentStatText: { fontSize: fontSize.caption, color: Colors.caption },
    studentAmounts: {
      flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'space-around' as const,
      paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider,
      gap: spacing.sm,
    },
    amountCol: { alignItems: 'center' as const },
    amountColLabel: { fontSize: fontSize.small, color: Colors.caption, marginBottom: 2 },
    amountColValue: { fontSize: fontSize.amount, fontWeight: FontWeight.bold, color: Colors.title },
    emptyMonth: {
      fontSize: fontSize.caption, color: Colors.caption,
      textAlign: 'center' as const, paddingVertical: spacing.xxl,
    },
  }), [spacing, fontSize]);

  const chartAvail = chartCardWidth > 0 ? chartCardWidth - spacing.lg * 2 : 280;

  // ── 页面聚焦时加载统计 ──
  useFocusEffect(useCallback(() => { loadStats(); }, []));

  /**
   * loadStats - 加载全部统计数据
   *
   * 遍历所有学生，计算每个学生的总课程数、总时长、总金额、已收金额。
   * 同时计算选中月份的收款情况。
   * 结果存入 stats、totalStats、monthStats 状态。
   */
  const loadStats = async () => {
    const students = await getAllStudents();
    const lessons = await getAllLessons();
    setAllLessons(lessons);

    const studentStats: StudentStats[] = [];
    let totalLessons = 0, totalHours = 0, totalAmount = 0, paidAmount = 0;
    let monthPaid = 0, monthPending = 0;

    for (const student of students) {
      const sLessons = await getLessonsByStudentId(student.id);
      const sHours = sLessons.reduce((sum, l) => sum + l.duration, 0);
      const sAmount = sLessons.reduce((sum, l) => sum + l.amount, 0);
      const sPaid = sLessons.filter((l) => l.status === 'paid').reduce((sum, l) => sum + l.amount, 0);
      const sSubjects = await getSubjectsByStudentId(student.id);

      studentStats.push({
        student,
        subjects: sSubjects,
        totalLessons: sLessons.length,
        totalHours: sHours,
        totalAmount: sAmount,
        paidAmount: sPaid,
        pendingAmount: sAmount - sPaid,
      });

      totalLessons += sLessons.length;
      totalHours += sHours;
      totalAmount += sAmount;
      paidAmount += sPaid;

      sLessons.filter((l) => l.date.startsWith(selectedMonth)).forEach((l) => {
        if (l.status === 'paid') monthPaid += l.amount;
        else monthPending += l.amount;
      });
    }

    setStats(studentStats);
    setTotalStats({
      totalStudents: students.length, totalLessons, totalHours,
      totalAmount, paidAmount, pendingAmount: totalAmount - paidAmount,
    });
    setMonthStats({ paid: monthPaid, pending: monthPending, total: monthPaid + monthPending });
  };

  /** 基于 selectedMonth 筛选后的学生月度统计数据 */
  const monthFilteredStats = useMemo(() => {
    return stats.map((s) => {
      const mLessons = allLessons.filter(
        (l) => l.studentId === s.student.id && l.date.startsWith(selectedMonth)
      );
      const mAmount = mLessons.reduce((sum, l) => sum + l.amount, 0);
      const mPaid = mLessons.filter((l) => l.status === 'paid').reduce((sum, l) => sum + l.amount, 0);
      return {
        ...s,
        totalLessons: mLessons.length,
        totalHours: mLessons.reduce((sum, l) => sum + l.duration, 0),
        totalAmount: mAmount,
        paidAmount: mPaid,
        pendingAmount: mAmount - mPaid,
      };
    });
  }, [stats, allLessons, selectedMonth]);

  /** 近 6 月收入柱状图数据（仅统计已收款 paid 状态的课程） */
  const chartData = useMemo(() => {
    const months: { label: string; value: number }[] = [];
    const [year, m] = selectedMonth.split('-').map(Number);
    for (let i = 5; i >= 0; i--) {
      let mon = m - i;
      let yr = year;
      if (mon <= 0) { mon += 12; yr -= 1; }
      const key = `${yr}-${String(mon).padStart(2, '0')}`;
      const income = allLessons
        .filter((l) => l.date.startsWith(key) && l.status === 'paid')
        .reduce((sum, l) => sum + l.amount, 0);
      months.push({ label: `${mon}月`, value: income });
    }
    return months;
  }, [allLessons, selectedMonth]);

  // ── 柱状图尺寸计算（根据容器宽度自动适配） ──
  const unitW = chartAvail / (chartData.length * 2);
  const chartBarW = Math.floor(unitW);
  const chartGap = Math.floor(unitW);
  const chartInitial = Math.floor(unitW / 2);

  /** 选中月份的全局汇总（去重学生数、总课时、总时长、总收入等） */
  const monthTotalStats = useMemo(() => {
    const uniqueStudents = new Set(monthFilteredStats.map((s) => s.student.id));
    let lessons = 0, hours = 0, amount = 0, paid = 0;
    monthFilteredStats.forEach((s) => {
      lessons += s.totalLessons;
      hours += s.totalHours;
      amount += s.totalAmount;
      paid += s.paidAmount;
    });
    return { students: uniqueStudents.size, lessons, hours, amount, paid, pending: amount - paid };
  }, [monthFilteredStats]);

  const monthRatio = monthStats.total > 0 ? (monthStats.paid / monthStats.total) * 100 : 0;

  // ── 柱状图 Y 轴自适应刻度算法 ──
  const maxBarValue = Math.max(...chartData.map((d) => d.value), 1);
  /**
   * niceScale - 计算柱状图 Y 轴「漂亮」刻度和最大值
   *
   * 使柱状图的刻度显示更整齐美观（如 0、50、100、150 而非 0、37、74、111）。
   * @param max 数据中的最大值
   * @returns {maxValue, stepValue, noOfSections}
   */
  const niceScale = (max: number) => {
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    const steps = [1, 2, 2.5, 5, 10];
    for (const s of steps) {
      const step = s * magnitude / 5;
      if (max * 1.2 <= step * 4) return { maxValue: step * 4, stepValue: step, noOfSections: 4 };
    }
    const fallback = Math.ceil(max * 1.2 / magnitude) * magnitude;
    return { maxValue: fallback, stepValue: fallback / 4, noOfSections: 4 };
  };
  const { maxValue: chartMax, stepValue: chartStep, noOfSections } = niceScale(maxBarValue);

  /**
   * changeMonth - 切换显示月份（上/下一个月）
   *
   * 更新 selectedMonth 后重新计算该月的收款统计数据。
   * @param delta 偏移量：-1 上个月，+1 下个月
   */
  const changeMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    let newMonth = m + delta;
    let newYear = y;
    if (newMonth > 12) { newMonth = 1; newYear += 1; }
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    const next = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    setSelectedMonth(next);
    setMonthStats({ paid: 0, pending: 0, total: 0 });
    loadFilteredMonth(next);
  };

  /**
   * loadFilteredMonth - 计算指定月份的收款统计
   *
   * 遍历全部课程，筛选出日期匹配该月的记录，按状态统计已收和待收金额。
   * @param month 月份 "YYYY-MM"
   */
  const loadFilteredMonth = async (month: string) => {
    const lessons = allLessons;
    let monthPaid = 0, monthPending = 0;
    lessons.filter((l) => l.date.startsWith(month)).forEach((l) => {
      if (l.status === 'paid') monthPaid += l.amount;
      else monthPending += l.amount;
    });
    setMonthStats({ paid: monthPaid, pending: monthPending, total: monthPaid + monthPending });
  };

  /** 格式化选中月份为中文显示 "2026年5月" */
  const formatSelectedMonth = () => {
    const [y, m] = selectedMonth.split('-');
    return `${y}年${MONTH_NAMES[m]}`;
  };

  // ── 无数据时的空状态 ──
  if (stats.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="stats-chart-outline"
          title="暂无统计数据"
          subtitle="添加学生和课程后将会显示统计信息"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { maxWidth: maxContentWidth }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { padding: spacing.xl }]} showsVerticalScrollIndicator={false}>
        {/* ── 月份选择器（左右箭头切换） ── */}
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{formatSelectedMonth()}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── 紧凑统计条（学生数 / 课时 / 时长 / 收入） ── */}
        <View style={[styles.statsBar, Shadows.subtle]}>
          <View style={styles.statsBarItem}>
            <Text style={styles.statsBarValue}>{monthTotalStats.students}</Text>
            <Text style={styles.statsBarLabel}>学生</Text>
          </View>
          <View style={styles.statsBarDivider} />
          <View style={styles.statsBarItem}>
            <Text style={styles.statsBarValue}>{monthTotalStats.lessons}节</Text>
            <Text style={styles.statsBarLabel}>课时</Text>
          </View>
          <View style={styles.statsBarDivider} />
          <View style={styles.statsBarItem}>
            <Text style={styles.statsBarValue}>{monthTotalStats.hours.toFixed(1)}h</Text>
            <Text style={styles.statsBarLabel}>时长</Text>
          </View>
          <View style={styles.statsBarDivider} />
          <View style={styles.statsBarItem}>
            <Text style={[styles.statsBarValue, { color: Colors.paid }]}>¥{monthTotalStats.amount.toFixed(0)}</Text>
            <Text style={styles.statsBarLabel}>收入</Text>
          </View>
        </View>

        {/* ── 近 6 月收入趋势柱状图 ── */}
        <View style={[styles.chartCard, Shadows.standard]} onLayout={(e: LayoutChangeEvent) => setChartCardWidth(e.nativeEvent.layout.width)}>
          <Text style={styles.chartTitle}>近6月收入趋势</Text>
          <View style={styles.chartWrap}>
            <BarChart
              key={`${selectedMonth}-${chartCardWidth}`}
              data={chartData.map((d) => ({
                value: d.value,
                label: d.label,
                frontColor: d.value > 0 ? Colors.primary : Colors.primaryLight,
                topLabelComponent: d.value > 0 ? () => (
                  <Text style={styles.barTopLabel}>{d.value.toFixed(0)}</Text>
                ) : undefined,
              }))}
              barWidth={chartBarW}
              height={isTablet ? Math.max(chartBarW * 8, 120) : 120}
              maxValue={chartMax}
              stepValue={chartStep}
              noOfSections={noOfSections}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={Colors.divider}
              isAnimated
              spacing={chartGap}
              barBorderRadius={4}
              hideRules
              yAxisLabelWidth={0}
              xAxisLabelTextStyle={{ fontSize: 12, color: Colors.caption, fontWeight: '500' }}
              initialSpacing={chartInitial}
            />
          </View>
        </View>

        {/* ── 月度收款概览（进度条 + 三列数字） ── */}
        <View style={[styles.overviewCard, Shadows.standard]}>
          <Text style={styles.overviewTitle}>收款概览 · 本月</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(monthRatio, 4)}%` }]} />
          </View>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{monthRatio.toFixed(0)}%</Text>
              <Text style={styles.overviewLabel}>已收比例</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>本月已收</Text>
              <Text style={[styles.overviewDetail, { color: Colors.paid }]}>
                {monthStats.paid.toFixed(0)}元
              </Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>本月待收</Text>
              <Text style={[styles.overviewDetail, { color: Colors.pending }]}>
                {monthStats.pending.toFixed(0)}元
              </Text>
            </View>
          </View>
        </View>

        {/* Student billing cards */}
        <Text style={styles.sectionTitle}>学生账单</Text>
        {monthFilteredStats.map((item, index) => {
          const subColor = item.subjects?.[0]?.color || Colors.primary;
          const hasPending = item.pendingAmount > 0;
          return (
            <TouchableOpacity
              key={item.student.id}
              activeOpacity={0.6}
              onPress={() => setSelectedStudent(item.student)}
              style={[styles.studentCard, Shadows.subtle, index === monthFilteredStats.length - 1 && styles.studentCardLast]}
            >
              <View style={styles.studentHeader}>
                <View style={styles.studentInfo}>
                  <View style={[styles.studentDot, { backgroundColor: subColor, width: moderateScale(10), height: moderateScale(10), borderRadius: moderateScale(5) }]} />
                  <View>
                    <Text style={styles.studentName}>{item.student.name}</Text>
                    <Text style={styles.studentSubject}>{item.subjects?.[0]?.subject || '未分类'} · {item.subjects?.[0]?.hourlyRate || 0}元/h</Text>
                  </View>
                </View>
                {hasPending && (
                  <View style={styles.pendingTag}>
                    <Text style={styles.pendingTagText}>有待收</Text>
                  </View>
                )}
              </View>
              <View style={styles.studentStats}>
                <Text style={styles.studentStatText}>本月上了{item.totalLessons}节课，课时为{item.totalHours.toFixed(1)}小时</Text>
              </View>
              <View style={styles.studentAmounts}>
                <View style={styles.amountCol}>
                  <Text style={styles.amountColLabel}>合计</Text>
                  <Text style={styles.amountColValue}>{item.totalAmount.toFixed(0)}元</Text>
                </View>
                <View style={styles.amountCol}>
                  <Text style={styles.amountColLabel}>已收</Text>
                  <Text style={[styles.amountColValue, { color: Colors.paid }]}>{item.paidAmount.toFixed(0)}元</Text>
                </View>
                <View style={styles.amountCol}>
                  <Text style={styles.amountColLabel}>待收</Text>
                  <Text style={[styles.amountColValue, { color: hasPending ? Colors.danger : Colors.caption }]}>
                    {item.pendingAmount.toFixed(0)}元
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        {monthFilteredStats.length === 0 && (
          <Text style={styles.emptyMonth}>本月无课程记录</Text>
        )}
      </ScrollView>

      <StudentBillingDetailScreen
        student={selectedStudent}
        visible={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </View>
  );
};


export default StatsScreen;
