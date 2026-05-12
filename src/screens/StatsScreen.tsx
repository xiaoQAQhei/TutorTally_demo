import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-gifted-charts';
import { StudentStats, Student, StudentSubject, Lesson } from '../models';
import { getAllStudents, getLessonsByStudentId, getAllLessons, getSubjectsByStudentId } from '../database';
import EmptyState from '../components/EmptyState';
import StudentBillingDetailScreen from './StudentBillingDetailScreen';
import {
  Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows,
} from '../styles/theme';
import { useResponsive, scale, moderateScale } from '../utils/responsive';

const MONTH_NAMES: Record<string, string> = {
  '01': '1月', '02': '2月', '03': '3月', '04': '4月',
  '05': '5月', '06': '6月', '07': '7月', '08': '8月',
  '09': '9月', '10': '10月', '11': '11月', '12': '12月',
};

const StatsScreen: React.FC = () => {
  const currentMonth = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [stats, setStats] = useState<StudentStats[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalStudents: 0, totalLessons: 0, totalHours: 0,
    totalAmount: 0, paidAmount: 0, pendingAmount: 0,
  });
  const [monthStats, setMonthStats] = useState({ paid: 0, pending: 0, total: 0 });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [chartCardWidth, setChartCardWidth] = useState(0);
  const { maxContentWidth, isTablet, spacing, fontSize } = useResponsive();

  const chartAvail = chartCardWidth > 0 ? chartCardWidth - spacing.lg * 2 : 280;

  useFocusEffect(useCallback(() => { loadStats(); }, []));

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

  const unitW = chartAvail / (chartData.length * 2);
  const chartBarW = Math.floor(unitW);
  const chartGap = Math.floor(unitW);
  const chartInitial = Math.floor(unitW / 2);

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

  const maxBarValue = Math.max(...chartData.map((d) => d.value), 1);
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

  const loadFilteredMonth = async (month: string) => {
    const lessons = allLessons;
    let monthPaid = 0, monthPending = 0;
    lessons.filter((l) => l.date.startsWith(month)).forEach((l) => {
      if (l.status === 'paid') monthPaid += l.amount;
      else monthPending += l.amount;
    });
    setMonthStats({ paid: monthPaid, pending: monthPending, total: monthPaid + monthPending });
  };

  const formatSelectedMonth = () => {
    const [y, m] = selectedMonth.split('-');
    return `${y}年${MONTH_NAMES[m]}`;
  };

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
        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { fontSize: fontSize.h3 }]}>{formatSelectedMonth()}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Compact stats bar */}
        <View style={[styles.statsBar, Shadows.subtle]}>
          <View style={styles.statsBarItem}>
            <Text style={[styles.statsBarValue, { fontSize: fontSize.body }]}>{monthTotalStats.students}</Text>
            <Text style={[styles.statsBarLabel, { fontSize: fontSize.small }]}>学生</Text>
          </View>
          <View style={styles.statsBarDivider} />
          <View style={styles.statsBarItem}>
            <Text style={[styles.statsBarValue, { fontSize: fontSize.body }]}>{monthTotalStats.lessons}节</Text>
            <Text style={[styles.statsBarLabel, { fontSize: fontSize.small }]}>课时</Text>
          </View>
          <View style={styles.statsBarDivider} />
          <View style={styles.statsBarItem}>
            <Text style={[styles.statsBarValue, { fontSize: fontSize.body }]}>{monthTotalStats.hours.toFixed(1)}h</Text>
            <Text style={[styles.statsBarLabel, { fontSize: fontSize.small }]}>时长</Text>
          </View>
          <View style={styles.statsBarDivider} />
          <View style={styles.statsBarItem}>
            <Text style={[styles.statsBarValue, { color: Colors.paid }]}>¥{monthTotalStats.amount.toFixed(0)}</Text>
            <Text style={[styles.statsBarLabel, { fontSize: fontSize.small }]}>收入</Text>
          </View>
        </View>

        {/* Bar Chart */}
        <View style={[styles.chartCard, Shadows.standard]} onLayout={(e: LayoutChangeEvent) => setChartCardWidth(e.nativeEvent.layout.width)}>
          <Text style={[styles.chartTitle, { fontSize: fontSize.h3 }]}>近6月收入趋势</Text>
          <View style={styles.chartWrap}>
            <BarChart
              key={`${selectedMonth}-${chartCardWidth}`}
              data={chartData.map((d) => ({
                value: d.value,
                label: d.label,
                frontColor: d.value > 0 ? Colors.primary : Colors.primaryLight,
                topLabelComponent: d.value > 0 ? () => (
                  <Text style={[styles.barTopLabel, { fontSize: fontSize.small }]}>{d.value.toFixed(0)}</Text>
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

        {/* Monthly payment overview */}
        <View style={[styles.overviewCard, Shadows.standard]}>
          <Text style={[styles.overviewTitle, { fontSize: fontSize.h3 }]}>收款概览 · 本月</Text>
          <View style={[styles.progressTrack, { height: scale(8), borderRadius: scale(4) }]}>
            <View style={[styles.progressFill, { width: `${Math.max(monthRatio, 4)}%`, borderRadius: scale(4) }]} />
          </View>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Text style={[styles.overviewValue, { fontSize: fontSize.h2 }]}>{monthRatio.toFixed(0)}%</Text>
              <Text style={[styles.overviewLabel, { fontSize: fontSize.small }]}>已收比例</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={[styles.overviewLabel, { fontSize: fontSize.small }]}>本月已收</Text>
              <Text style={[styles.overviewDetail, { color: Colors.paid, fontSize: fontSize.body }]}>
                {monthStats.paid.toFixed(0)}元
              </Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={[styles.overviewLabel, { fontSize: fontSize.small }]}>本月待收</Text>
              <Text style={[styles.overviewDetail, { color: Colors.pending, fontSize: fontSize.body }]}>
                {monthStats.pending.toFixed(0)}元
              </Text>
            </View>
          </View>
        </View>

        {/* Student billing cards */}
        <Text style={[styles.sectionTitle, { fontSize: fontSize.h3 }]}>学生账单</Text>
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
                    <Text style={[styles.studentName, { fontSize: fontSize.body }]}>{item.student.name}</Text>
                    <Text style={[styles.studentSubject, { fontSize: fontSize.small }]}>{item.subjects?.[0]?.subject || '未分类'} · {item.subjects?.[0]?.hourlyRate || 0}元/h</Text>
                  </View>
                </View>
                {hasPending && (
                  <View style={styles.pendingTag}>
                    <Text style={[styles.pendingTagText, { fontSize: fontSize.small }]}>有待收</Text>
                  </View>
                )}
              </View>
              <View style={styles.studentStats}>
                <Text style={[styles.studentStatText, { fontSize: fontSize.caption }]}>本月上了{item.totalLessons}节课，课时为{item.totalHours.toFixed(1)}小时</Text>
              </View>
              <View style={styles.studentAmounts}>
                <View style={styles.amountCol}>
                  <Text style={[styles.amountColLabel, { fontSize: fontSize.small }]}>合计</Text>
                  <Text style={[styles.amountColValue, { fontSize: fontSize.amount }]}>{item.totalAmount.toFixed(0)}元</Text>
                </View>
                <View style={styles.amountCol}>
                  <Text style={[styles.amountColLabel, { fontSize: fontSize.small }]}>已收</Text>
                  <Text style={[styles.amountColValue, { color: Colors.paid, fontSize: fontSize.amount }]}>{item.paidAmount.toFixed(0)}元</Text>
                </View>
                <View style={styles.amountCol}>
                  <Text style={[styles.amountColLabel, { fontSize: fontSize.small }]}>待收</Text>
                  <Text style={[styles.amountColValue, { color: hasPending ? Colors.danger : Colors.caption, fontSize: fontSize.amount }]}>
                    {item.pendingAmount.toFixed(0)}元
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        {monthFilteredStats.length === 0 && (
          <Text style={[styles.emptyMonth, { fontSize: fontSize.caption }]}>本月无课程记录</Text>
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

const styles = StyleSheet.create({
  // ═══════════════ 页面容器 ═══════════════
  container: { flex: 1, backgroundColor: Colors.background, width: '100%', alignSelf: 'center' },
  scrollContent: { paddingBottom: 100 },                                                            // 滚动区域底部留白

  // ═══════════════ 月份选择器 ═══════════════
  monthSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xl, gap: Spacing.lg,
  },
  monthArrow: {                                                                                     // 左右箭头按钮
    width: scale(36), height: scale(36), borderRadius: scale(18),
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  monthLabel: {                                                                                     // 月份文字 "2026年5月"
    fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
    minWidth: 120, textAlign: 'center',
  },

  // ═══════════════ 顶部统计条（4 项数据）═══════════════
  statsBar: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch',
    backgroundColor: Colors.card, borderRadius: BorderRadius.card,
    paddingVertical: Spacing.md, marginBottom: Spacing.xl,
  },
  statsBarItem: { flex: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xs }, // 单个统计项
  statsBarValue: {                                                                                  // 统计数值
    fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.title,
    marginBottom: 2,
  },
  statsBarLabel: { fontSize: FontSize.small, color: Colors.caption },                              // 统计标签
  statsBarDivider: {                                                                                // 项之间竖线分隔
    width: 1, height: 28, backgroundColor: Colors.divider, alignSelf: 'center',
  },

  // ═══════════════ 收入柱状图 ═══════════════
  chartCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.card,
    padding: Spacing.lg, marginBottom: Spacing.xl,
  },
  chartTitle: {                                                                                     // 图表标题
    fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
    marginBottom: Spacing.md,
  },
  chartWrap: { overflow: 'hidden' },
  barTopLabel: {                                                                                    // 柱顶金额标签
    fontSize: FontSize.small, fontWeight: FontWeight.semiBold, color: Colors.primary,
    marginBottom: 2,
  },

  // ═══════════════ 月度概览卡片（进度条 + 统计）═══════════════
  overviewCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.card,
    padding: Spacing.xl, marginBottom: Spacing.xl,
  },
  overviewTitle: {                                                                                  // "本月收款概览"
    fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
    marginBottom: Spacing.lg,
  },
  progressTrack: {                                                                                  // 进度条轨道
    height: 8, backgroundColor: Colors.pendingBg, borderRadius: 4,
    marginBottom: Spacing.xl, overflow: 'hidden',
  },
  progressFill: {                                                                                   // 进度条填充
    height: '100%', backgroundColor: Colors.paid, borderRadius: 4,
  },
  overviewRow: {                                                                                    // 概览数据行
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', alignItems: 'center',
    gap: Spacing.sm,
  },
  overviewItem: { alignItems: 'center' },                                                           // 单个概览项
  overviewLabel: { fontSize: FontSize.small, color: Colors.caption, marginTop: 2 },                // 标签
  overviewValue: { fontSize: FontSize.h2, fontWeight: FontWeight.bold, color: Colors.primary },    // 数值
  overviewDetail: { fontSize: FontSize.body, fontWeight: FontWeight.semiBold },                    // 明细
  overviewDivider: { width: 1, height: 32, backgroundColor: Colors.divider },                      // 项之间分隔

  // ═══════════════ 分区标题 ═══════════════
  sectionTitle: {
    fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
    marginBottom: Spacing.md,
  },

  // ═══════════════ 学生账单卡片 ═══════════════
  studentCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.card,
    padding: Spacing.lg, marginBottom: Spacing.md,
  },
  studentCardLast: { marginBottom: 0 },                                                             // 最后一张卡片去掉下边距
  studentHeader: {                                                                                  // 卡片头部（学生名 + 待收标签）
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  studentInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },                     // 学生信息（圆点 + 名字）
  studentDot: { width: 10, height: 10, borderRadius: 5 },                                           // 学生颜色圆点
  studentName: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.title },
  studentSubject: { fontSize: FontSize.small, color: Colors.caption, marginTop: 1 },               // 科目名
  pendingTag: {                                                                                     // "待收" 标签
    backgroundColor: Colors.dangerBg, paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.pill,
  },
  pendingTagText: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold, color: Colors.danger },
  studentStats: { marginBottom: Spacing.md },                                                       // 学生统计文字区域
  studentStatText: { fontSize: FontSize.caption, color: Colors.caption },                           // "共 N 课时 · N 小时"
  studentAmounts: {                                                                                 // 金额三列
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around',
    paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider,
    gap: Spacing.sm,
  },
  amountCol: { alignItems: 'center' },                                                              // 单列金额
  amountColLabel: { fontSize: FontSize.small, color: Colors.caption, marginBottom: 2 },            // 列标签（合计/已收/待收）
  amountColValue: { fontSize: FontSize.amount, fontWeight: FontWeight.bold, color: Colors.title }, // 列金额
  emptyMonth: {                                                                                     // 空状态
    fontSize: FontSize.caption, color: Colors.caption,
    textAlign: 'center', paddingVertical: Spacing.xxl,
  },
});

export default StatsScreen;
