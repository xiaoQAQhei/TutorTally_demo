import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Student, StudentSubject, Lesson } from '../models';
import { getLessonsByStudentId, getSubjectsByStudentId } from '../database';
import {
  Colors, FontWeight, BorderRadius, Shadows, LessonStatusColors,
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
  const { maxContentWidth, spacing, fontSize, isTablet, iconSize } = useResponsive();

  // ═══════════════ 样式 ═══════════════
  const styles = useMemo(() => ({
    // ═══════════════ 页面容器 ═══════════════
    container: { flex: 1, backgroundColor: Colors.background, width: '100%' as const, alignSelf: 'center' as const },

    // ═══════════════ 顶部栏 ═══════════════
    header: {
      flexDirection: 'row' as const, alignItems: 'center' as const,
      backgroundColor: Colors.card, paddingTop: 50, paddingBottom: spacing.md,
      paddingHorizontal: spacing.lg, ...Shadows.subtle,
    },
    closeBtn: { width: 40, height: 40, justifyContent: 'center' as const, alignItems: 'center' as const },
    headerCenter: { flex: 1, alignItems: 'center' as const },
    headerTitle: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },
    headerSubRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: spacing.xs },
    subjectDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
    headerSub: { fontSize: fontSize.small, color: Colors.caption },
    scrollContent: { padding: spacing.xl },

    // ═══════════════ 汇总卡片（三列数字）═══════════════
    summaryRow: { flexDirection: 'row' as const, gap: spacing.sm, marginBottom: spacing.xl },
    summaryCard: {
      flex: 1, borderRadius: BorderRadius.smallCard,
      padding: spacing.md, alignItems: 'center' as const,
    },
    summaryLabel: { fontSize: fontSize.small, color: Colors.caption, marginBottom: spacing.xs },
    summaryValue: { fontSize: fontSize.amount, fontWeight: FontWeight.bold, marginBottom: 2 },
    summarySub: { fontSize: fontSize.small, color: Colors.caption },

    // ═══════════════ 分月列表 ═══════════════
    sectionTitle: {
      fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
      marginBottom: spacing.md,
    },
    monthCard: {
      backgroundColor: Colors.card, borderRadius: BorderRadius.card,
      padding: spacing.lg, marginBottom: spacing.md,
    },
    monthHeader: {
      flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const,
      paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider,
      marginBottom: spacing.sm,
    },
    monthLabel: { fontSize: fontSize.body, fontWeight: FontWeight.bold, color: Colors.title },
    monthStats: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs },
    monthStat: { fontSize: fontSize.small, color: Colors.caption },
    monthSep: { fontSize: fontSize.small, color: Colors.divider },
    monthAmount: { fontSize: fontSize.body, fontWeight: FontWeight.semiBold },

    // ═══════════════ 课程行 ═══════════════
    lessonRow: {
      flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const,
      paddingVertical: spacing.sm,
    },
    lessonLeft: { flex: 1 },
    lessonDate: { fontSize: fontSize.caption, color: Colors.title, fontWeight: FontWeight.medium },
    lessonNotes: { fontSize: fontSize.small, color: Colors.caption, marginTop: 2 },
    lessonRight: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md },
    lessonDuration: { fontSize: fontSize.small, color: Colors.caption },
    lessonAmount: { fontSize: fontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title },

    // ═══════════════ 状态徽章 ═══════════════
    inlineBadgeBase: {
      paddingHorizontal: spacing.sm, paddingVertical: 2,
      borderRadius: BorderRadius.pill,
    },
    inlineBadgeText: { fontSize: fontSize.small, fontWeight: FontWeight.semiBold },

    // ═══════════════ 空状态 ═══════════════
    emptyState: { padding: 40, alignItems: 'center' as const },
    emptyText: { fontSize: fontSize.body, color: Colors.caption, marginTop: spacing.md },
  }), [spacing, fontSize, iconSize]);

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
            <Ionicons name="chevron-back" size={iconSize.lg} color={Colors.title} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{student.name}</Text>
            <View style={styles.headerSubRow}>
              <View style={[styles.subjectDot, { backgroundColor: subjectColor }]} />
              <Text style={styles.headerSub}>{subjects?.[0]?.subject || '未分类'} · {subjects?.[0]?.hourlyRate || 0}元/h</Text>
            </View>
          </View>
          <View style={styles.closeBtn} />
        </View>

        <FlatList
          data={monthlyGroups}
          keyExtractor={(item) => item.month}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={
            <>
              {/* Summary Cards */}
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, { backgroundColor: Colors.primaryLight }]}>
                  <Text style={styles.summaryLabel}>总收入</Text>
                  <Text style={[styles.summaryValue, { color: Colors.primary }]}>{totalAmount.toFixed(0)}元</Text>
                  <Text style={styles.summarySub}>{totalHours.toFixed(1)}h / {lessons.length}节</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: Colors.paidLight }]}>
                  <Text style={styles.summaryLabel}>已收款</Text>
                  <Text style={[styles.summaryValue, { color: Colors.paid }]}>{paidAmount.toFixed(0)}元</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: Colors.pendingLight }]}>
                  <Text style={styles.summaryLabel}>待收款</Text>
                  <Text style={[styles.summaryValue, { color: Colors.pending }]}>{pendingAmount.toFixed(0)}元</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>月度分布</Text>
            </>
          }
          renderItem={({ item }) => (
            <View style={[styles.monthCard, Shadows.subtle]}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthLabel}>{formatMonth(item.month)}</Text>
                <View style={styles.monthStats}>
                  <Text style={styles.monthStat}>{item.lessons.length}节</Text>
                  <Text style={styles.monthSep}>·</Text>
                  <Text style={styles.monthStat}>{item.hours.toFixed(1)}h</Text>
                  <Text style={styles.monthSep}>·</Text>
                  <Text style={[styles.monthAmount, { color: Colors.primary }]}>{item.total.toFixed(0)}元</Text>
                </View>
              </View>
              {item.lessons.map((l) => (
                <View key={l.id} style={styles.lessonRow}>
                  <View style={styles.lessonLeft}>
                    <Text style={styles.lessonDate}>{l.date}</Text>
                    {l.notes ? <Text style={styles.lessonNotes} numberOfLines={1}>{l.notes}</Text> : null}
                  </View>
                  <View style={styles.lessonRight}>
                    <Text style={styles.lessonDuration}>{l.duration.toFixed(1)}h</Text>
                    <Text style={styles.lessonAmount}>{l.amount.toFixed(0)}元</Text>
                    <View style={[styles.inlineBadgeBase, { backgroundColor: LessonStatusColors[l.status]?.bg || Colors.card }]}>
                      <Text style={[styles.inlineBadgeText, { color: LessonStatusColors[l.status]?.text || Colors.caption }]}>
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
              <Text style={styles.emptyText}>暂无课程记录</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
};

export default StudentBillingDetailScreen;
