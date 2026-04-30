import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StudentStats, Student } from '../models';
import { getAllStudents, getLessonsByStudentId } from '../database';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import StudentBillingDetailScreen from './StudentBillingDetailScreen';
import {
  Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows,
  getSubjectColor,
} from '../styles/theme';

const StatsScreen: React.FC = () => {
  const [stats, setStats] = useState<StudentStats[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalStudents: 0, totalLessons: 0, totalHours: 0,
    totalAmount: 0, paidAmount: 0, pendingAmount: 0,
  });
  const [monthStats, setMonthStats] = useState({ paid: 0, pending: 0, total: 0 });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useFocusEffect(useCallback(() => { loadStats(); }, []));

  const loadStats = async () => {
    const students = await getAllStudents();
    const studentStats: StudentStats[] = [];
    let totalLessons = 0, totalHours = 0, totalAmount = 0, paidAmount = 0;
    let monthPaid = 0, monthPending = 0;
    const thisMonth = new Date().toISOString().substring(0, 7);

    for (const student of students) {
      const lessons = await getLessonsByStudentId(student.id);
      const sHours = lessons.reduce((sum, l) => sum + l.duration, 0);
      const sAmount = lessons.reduce((sum, l) => sum + l.amount, 0);
      const sPaid = lessons.filter((l) => l.paid).reduce((sum, l) => sum + l.amount, 0);

      studentStats.push({
        student, totalLessons: lessons.length, totalHours: sHours,
        totalAmount: sAmount, paidAmount: sPaid,
        pendingAmount: sAmount - sPaid,
      });

      totalLessons += lessons.length;
      totalHours += sHours;
      totalAmount += sAmount;
      paidAmount += sPaid;

      // Monthly calculation
      lessons.filter((l) => l.date.startsWith(thisMonth)).forEach((l) => {
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

  const paidRatio = totalStats.totalAmount > 0
    ? (totalStats.paidAmount / totalStats.totalAmount) * 100
    : 0;
  const monthRatio = monthStats.total > 0
    ? (monthStats.paid / monthStats.total) * 100
    : 0;

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
        {/* Stats grid 2x2 */}
        <View style={styles.statsGrid}>
          <View style={styles.gridItem}>
            <StatCard icon="people" label="学生数" value={totalStats.totalStudents} color={Colors.primary} />
          </View>
          <View style={styles.gridItem}>
            <StatCard icon="book" label="总课时" value={`${totalStats.totalLessons}节`} color={Colors.subjectEnglish} />
          </View>
          <View style={styles.gridItem}>
            <StatCard icon="time" label="总时长" value={`${totalStats.totalHours.toFixed(1)}h`} color={Colors.pending} />
          </View>
          <View style={styles.gridItem}>
            <StatCard icon="wallet" label="总收入" value={`${totalStats.totalAmount.toFixed(0)}元`} color={Colors.paid} />
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
              <Text style={styles.overviewLabel}>本月已收</Text>
              <Text style={[styles.overviewValue, { color: Colors.paid }]}>
                {monthStats.paid.toFixed(0)}元
              </Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>本月待收</Text>
              <Text style={[styles.overviewValue, { color: Colors.pending }]}>
                {monthStats.pending.toFixed(0)}元
              </Text>
            </View>
          </View>
        </View>

        {/* Student table */}
        <View style={[styles.tableCard, Shadows.standard]}>
          <Text style={styles.tableTitle}>学生账单汇总</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.cellName]}>学生</Text>
            <Text style={styles.th}>课时</Text>
            <Text style={styles.th}>时长</Text>
            <Text style={styles.th}>合计</Text>
            <Text style={styles.th}>已交</Text>
            <Text style={styles.th}>待交</Text>
          </View>
          {stats.map((item, index) => {
            const subColor = getSubjectColor(item.student.subject);
            const isPending = item.pendingAmount > 0;
            return (
              <TouchableOpacity
                key={item.student.id}
                activeOpacity={0.6}
                onPress={() => setSelectedStudent(item.student)}
                style={[
                  styles.tableRow,
                  index % 2 === 0 && styles.tableRowZebra,
                  isPending && styles.tableRowPending,
                ]}
              >
                <View style={[styles.td, styles.cellName]}>
                  <View style={styles.cellNameRow}>
                    <View style={[styles.miniDot, { backgroundColor: subColor }]} />
                    <View>
                      <Text style={styles.cellNameText}>{item.student.name}</Text>
                      <Text style={styles.cellSubText}>{item.student.subject}</Text>
                    </View>
                  </View>
                </View>
                <Text style={[styles.td, styles.cellVal]}>{item.totalLessons}节</Text>
                <Text style={[styles.td, styles.cellVal]}>{item.totalHours.toFixed(1)}h</Text>
                <Text style={[styles.td, styles.cellVal]}>{item.totalAmount.toFixed(0)}元</Text>
                <Text style={[styles.td, styles.cellGreen]}>{item.paidAmount.toFixed(0)}元</Text>
                <Text style={[styles.td, isPending ? styles.cellRed : styles.cellZero]}>
                  {item.pendingAmount.toFixed(0)}元
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
  gridItem: { width: '47%', flexGrow: 1 },
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
  overviewLabel: { fontSize: FontSize.caption, color: Colors.caption, marginBottom: Spacing.sm },
  overviewValue: { fontSize: FontSize.h1, fontWeight: FontWeight.bold },
  overviewDivider: { width: 1, height: 40, backgroundColor: Colors.divider },
  tableCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.card, overflow: 'hidden',
  },
  tableTitle: {
    fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  tableHeader: {
    flexDirection: 'row', backgroundColor: Colors.background,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  th: {
    flex: 1, fontSize: FontSize.small, fontWeight: FontWeight.bold,
    color: Colors.caption, textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  tableRowZebra: { backgroundColor: Colors.background },
  tableRowPending: { backgroundColor: Colors.dangerLight },
  td: { flex: 1, textAlign: 'center' },
  cellName: { flex: 1.8, paddingLeft: Spacing.md, alignItems: 'flex-start' as const },
  cellNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  cellNameText: {
    fontSize: FontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.title,
  },
  cellSubText: { fontSize: FontSize.small, color: Colors.caption, marginTop: 1 },
  cellVal: { fontSize: FontSize.small, color: Colors.body },
  cellGreen: {
    fontSize: FontSize.small, color: Colors.paid, fontWeight: FontWeight.semiBold,
  },
  cellRed: {
    fontSize: FontSize.small, color: Colors.danger, fontWeight: FontWeight.semiBold,
  },
  cellZero: { fontSize: FontSize.small, color: Colors.caption },
});

export default StatsScreen;
