import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Student, StudentSubject, Lesson } from '../models';
import { getLessonsByStudentId, getSubjectsByStudentId } from '../database';
import {
  Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows, LessonStatusColors,
} from '../styles/theme';
import { useResponsive } from '../utils/responsive';

interface Props {
  student: Student | null;
  visible: boolean;
  onClose: () => void;
}

interface MonthlyGroup {
  month: string;
  lessons: Lesson[];
  total: number;
  hours: number;
}

const MONTH_NAMES: Record<string, string> = {
  '01': '1月', '02': '2月', '03': '3月', '04': '4月',
  '05': '5月', '06': '6月', '07': '7月', '08': '8月',
  '09': '9月', '10': '10月', '11': '11月', '12': '12月',
};

const StudentBillingDetailScreen: React.FC<Props> = ({ student, visible, onClose }) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const { maxContentWidth, spacing, fontSize, isTablet } = useResponsive();
  const icLg = isTablet ? 26 : 20;

  useEffect(() => {
    if (student) {
      getLessonsByStudentId(student.id).then(setLessons);
      getSubjectsByStudentId(student.id).then(setSubjects);
    }
  }, [student]);

  if (!student) return null;

  const subjectColor = subjects?.[0]?.color || Colors.primary;

  const totalAmount = lessons.reduce((s, l) => s + l.amount, 0);
  const paidAmount = lessons.filter((l) => l.status === 'paid').reduce((s, l) => s + l.amount, 0);
  const pendingAmount = totalAmount - paidAmount;
  const totalHours = lessons.reduce((s, l) => s + l.duration, 0);

  const monthlyGroups: MonthlyGroup[] = (() => {
    const map: Record<string, MonthlyGroup> = {};
    lessons.forEach((l) => {
      const month = l.date.substring(0, 7);
      if (!map[month]) map[month] = { month, lessons: [], total: 0, hours: 0 };
      map[month].lessons.push(l);
      map[month].total += l.amount;
      map[month].hours += l.duration;
    });
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
  })();

  const formatMonth = (m: string) => {
    const parts = m.split('-');
    return `${parts[0]}年${MONTH_NAMES[parts[1]] || parts[1] + '月'}`;
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { maxWidth: maxContentWidth }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="chevron-back" size={icLg} color={Colors.title} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { fontSize: fontSize.h3 }]}>{student.name}</Text>
            <View style={styles.headerSubRow}>
              <View style={[styles.subjectDot, { backgroundColor: subjectColor }]} />
              <Text style={[styles.headerSub, { fontSize: fontSize.small }]}>{subjects?.[0]?.subject || '未分类'} · {subjects?.[0]?.hourlyRate || 0}元/h</Text>
            </View>
          </View>
          <View style={styles.closeBtn} />
        </View>

        <FlatList
          data={monthlyGroups}
          keyExtractor={(item) => item.month}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { padding: spacing.xl }]}
          ListHeaderComponent={
            <>
              {/* Summary Cards */}
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, { backgroundColor: Colors.primaryLight }]}>
                  <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>总收入</Text>
                  <Text style={[styles.summaryValue, { color: Colors.primary, fontSize: fontSize.amount }]}>{totalAmount.toFixed(0)}元</Text>
                  <Text style={[styles.summarySub, { fontSize: fontSize.small }]}>{totalHours.toFixed(1)}h / {lessons.length}节</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: Colors.paidLight }]}>
                  <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>已收款</Text>
                  <Text style={[styles.summaryValue, { color: Colors.paid, fontSize: fontSize.amount }]}>{paidAmount.toFixed(0)}元</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: Colors.pendingLight }]}>
                  <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>待收款</Text>
                  <Text style={[styles.summaryValue, { color: Colors.pending, fontSize: fontSize.amount }]}>{pendingAmount.toFixed(0)}元</Text>
                </View>
              </View>

              <Text style={[styles.sectionTitle, { fontSize: fontSize.h3 }]}>月度分布</Text>
            </>
          }
          renderItem={({ item }) => (
            <View style={[styles.monthCard, Shadows.subtle]}>
              <View style={styles.monthHeader}>
                <Text style={[styles.monthLabel, { fontSize: fontSize.body }]}>{formatMonth(item.month)}</Text>
                <View style={styles.monthStats}>
                  <Text style={[styles.monthStat, { fontSize: fontSize.small }]}>{item.lessons.length}节</Text>
                  <Text style={[styles.monthSep, { fontSize: fontSize.small }]}>·</Text>
                  <Text style={[styles.monthStat, { fontSize: fontSize.small }]}>{item.hours.toFixed(1)}h</Text>
                  <Text style={[styles.monthSep, { fontSize: fontSize.small }]}>·</Text>
                  <Text style={[styles.monthAmount, { color: Colors.primary, fontSize: fontSize.body }]}>{item.total.toFixed(0)}元</Text>
                </View>
              </View>
              {item.lessons.map((l) => (
                <View key={l.id} style={styles.lessonRow}>
                  <View style={styles.lessonLeft}>
                    <Text style={[styles.lessonDate, { fontSize: fontSize.caption }]}>{l.date}</Text>
                    {l.notes ? <Text style={[styles.lessonNotes, { fontSize: fontSize.small }]} numberOfLines={1}>{l.notes}</Text> : null}
                  </View>
                  <View style={styles.lessonRight}>
                    <Text style={[styles.lessonDuration, { fontSize: fontSize.small }]}>{l.duration.toFixed(1)}h</Text>
                    <Text style={[styles.lessonAmount, { fontSize: fontSize.body }]}>{l.amount.toFixed(0)}元</Text>
                    <View style={[styles.inlineBadgeBase, { backgroundColor: LessonStatusColors[l.status]?.bg || Colors.card }]}>
                      <Text style={[styles.inlineBadgeText, { color: LessonStatusColors[l.status]?.text || Colors.caption, fontSize: fontSize.small }]}>
                        {LessonStatusColors[l.status]?.label || l.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={isTablet ? 56 : 48} color={Colors.caption} />
              <Text style={[styles.emptyText, { fontSize: fontSize.body }]}>暂无课程记录</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, width: '100%', alignSelf: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, paddingTop: 50, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg, ...Shadows.subtle,
  },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  subjectDot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.xs },
  headerSub: { fontSize: FontSize.small, color: Colors.caption },
  scrollContent: { paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  summaryCard: {
    flex: 1, borderRadius: BorderRadius.smallCard,
    padding: Spacing.md, alignItems: 'center',
  },
  summaryLabel: { fontSize: FontSize.small, color: Colors.caption, marginBottom: Spacing.xs },
  summaryValue: { fontSize: FontSize.amount, fontWeight: FontWeight.bold, marginBottom: 2 },
  summarySub: { fontSize: FontSize.small, color: Colors.caption },
  sectionTitle: {
    fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
    marginBottom: Spacing.md,
  },
  monthCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.card,
    padding: Spacing.lg, marginBottom: Spacing.md,
  },
  monthHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider,
    marginBottom: Spacing.sm,
  },
  monthLabel: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.title },
  monthStats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  monthStat: { fontSize: FontSize.small, color: Colors.caption },
  monthSep: { fontSize: FontSize.small, color: Colors.divider },
  monthAmount: { fontSize: FontSize.body, fontWeight: FontWeight.semiBold },
  lessonRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  lessonLeft: { flex: 1 },
  lessonDate: { fontSize: FontSize.caption, color: Colors.title, fontWeight: FontWeight.medium },
  lessonNotes: { fontSize: FontSize.small, color: Colors.caption, marginTop: 2 },
  lessonRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  lessonDuration: { fontSize: FontSize.small, color: Colors.caption },
  lessonAmount: { fontSize: FontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title },
  inlineBadgeBase: {
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.pill,
  },
  inlineBadgeText: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: FontSize.body, color: Colors.caption, marginTop: Spacing.md },
});

export default StudentBillingDetailScreen;
