import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-gifted-charts';
import { StudentStats, Student, Lesson } from '../models';
import { getAllStudents, getLessonsByStudentId, getAllLessons } from '../database';
import EmptyState from '../components/EmptyState';
import StudentBillingDetailScreen from './StudentBillingDetailScreen';
import {
  Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows,
  getSubjectColor,
} from '../styles/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_AVAIL = SCREEN_WIDTH - Spacing.xl * 2 - Spacing.lg * 2;
const CHART_BAR_W = Math.floor(CHART_AVAIL / 12);
const CHART_GAP = CHART_BAR_W;
const CHART_INITIAL = Math.floor(CHART_BAR_W / 2);
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
      const sPaid = sLessons.filter((l) => l.paid).reduce((sum, l) => sum + l.amount, 0);

      studentStats.push({
        student, totalLessons: sLessons.length, totalHours: sHours,
        totalAmount: sAmount, paidAmount: sPaid,
        pendingAmount: sAmount - sPaid,
      });

      totalLessons += sLessons.length;
      totalHours += sHours;
      totalAmount += sAmount;
      paidAmount += sPaid;

      sLessons.filter((l) => l.date.startsWith(selectedMonth)).forEach((l) => {
        if (l.paid) monthPaid += l.amount;
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
      const mPaid = mLessons.filter((l) => l.paid).reduce((sum, l) => sum + l.amount, 0);
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
        .filter((l) => l.date.startsWith(key) && l.paid)
        .reduce((sum, l) => sum + l.amount, 0);
      months.push({ label: `${mon}月`, value: income });
    }
    return months;
  }, [allLessons, selectedMonth]);

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
      if (l.paid) monthPaid += l.amount;
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{formatSelectedMonth()}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Compact stats bar */}
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

        {/* Bar Chart */}
        <View style={[styles.chartCard, Shadows.standard]}>
          <Text style={styles.chartTitle}>近6月收入趋势</Text>
          <View style={styles.chartWrap}>
            <BarChart
              data={chartData.map((d) => ({
                value: d.value,
                label: d.label,
                frontColor: d.value > 0 ? Colors.primary : Colors.primaryLight,
                topLabelComponent: d.value > 0 ? () => (
                  <Text style={styles.barTopLabel}>{d.value.toFixed(0)}</Text>
                ) : undefined,
              }))}
              barWidth={CHART_BAR_W}
              height={120}
              maxValue={chartMax}
              stepValue={chartStep}
              noOfSections={noOfSections}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={Colors.divider}
              isAnimated
              spacing={CHART_GAP}
              barBorderRadius={4}
              hideRules
              yAxisLabelWidth={0}
              xAxisLabelTextStyle={{ fontSize: 12, color: Colors.caption, fontWeight: '500' }}
              initialSpacing={CHART_INITIAL}
            />
          </View>
        </View>

        {/* Monthly payment overview */}
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
          const subColor = getSubjectColor(item.student.subject);
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
                  <View style={[styles.studentDot, { backgroundColor: subColor }]} />
                  <View>
                    <Text style={styles.studentName}>{item.student.name}</Text>
                    <Text style={styles.studentSubject}>{item.student.subject} · {item.student.hourlyRate}元/h</Text>
                  </View>
                </View>
                {hasPending && (
                  <View style={styles.pendingTag}>
                    <Text style={styles.pendingTagText}>有待收</Text>
                  </View>
                )}
              </View>
              <View style={styles.studentStats}>
                <Text style={styles.studentStatText}>{item.totalLessons}节 · {item.totalHours.toFixed(1)}h</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.xl, paddingBottom: 100 },

  // Month selector
  monthSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xl, gap: Spacing.lg,
  },
  monthArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  monthLabel: {
    fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
    minWidth: 120, textAlign: 'center',
  },

  // Compact stats bar
  statsBar: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: Colors.card, borderRadius: BorderRadius.card,
    paddingVertical: Spacing.md, marginBottom: Spacing.xl,
  },
  statsBarItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xs },
  statsBarValue: {
    fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.title,
    marginBottom: 2,
  },
  statsBarLabel: { fontSize: FontSize.small, color: Colors.caption },
  statsBarDivider: {
    width: 1, height: 28, backgroundColor: Colors.divider, alignSelf: 'center',
  },

  // Chart
  chartCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.card,
    padding: Spacing.lg, marginBottom: Spacing.xl,
  },
  chartTitle: {
    fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
    marginBottom: Spacing.md,
  },
  chartWrap: { overflow: 'hidden' },
  barTopLabel: {
    fontSize: 10, fontWeight: FontWeight.semiBold, color: Colors.primary,
    marginBottom: 2,
  },

  // Monthly overview
  overviewCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.card,
    padding: Spacing.xl, marginBottom: Spacing.xl,
  },
  overviewTitle: {
    fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
    marginBottom: Spacing.lg,
  },
  progressTrack: {
    height: 8, backgroundColor: Colors.pendingBg, borderRadius: 4,
    marginBottom: Spacing.xl, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: Colors.paid, borderRadius: 4,
  },
  overviewRow: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
  },
  overviewItem: { alignItems: 'center' },
  overviewLabel: { fontSize: FontSize.small, color: Colors.caption, marginTop: 2 },
  overviewValue: { fontSize: FontSize.h2, fontWeight: FontWeight.bold, color: Colors.primary },
  overviewDetail: { fontSize: FontSize.body, fontWeight: FontWeight.semiBold },
  overviewDivider: { width: 1, height: 32, backgroundColor: Colors.divider },

  // Section title
  sectionTitle: {
    fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
    marginBottom: Spacing.md,
  },

  // Student cards
  studentCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.card,
    padding: Spacing.lg, marginBottom: Spacing.md,
  },
  studentCardLast: { marginBottom: 0 },
  studentHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  studentInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  studentDot: { width: 10, height: 10, borderRadius: 5 },
  studentName: {
    fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.title,
  },
  studentSubject: { fontSize: FontSize.small, color: Colors.caption, marginTop: 1 },
  pendingTag: {
    backgroundColor: Colors.dangerBg, paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.pill,
  },
  pendingTagText: { fontSize: 10, fontWeight: FontWeight.semiBold, color: Colors.danger },
  studentStats: { marginBottom: Spacing.md },
  studentStatText: { fontSize: FontSize.caption, color: Colors.caption },
  studentAmounts: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  amountCol: { alignItems: 'center' },
  amountColLabel: { fontSize: FontSize.small, color: Colors.caption, marginBottom: 2 },
  amountColValue: { fontSize: FontSize.amount, fontWeight: FontWeight.bold, color: Colors.title },
  emptyMonth: {
    fontSize: FontSize.caption, color: Colors.caption,
    textAlign: 'center', paddingVertical: Spacing.xxl,
  },
});

export default StatsScreen;
