import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Lesson, Student } from '../models';
import { getAllLessons, getAllStudents, confirmLesson } from '../database';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { useFadeIn, useBounce } from '../styles/animations';
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
  const { setPendingAction, setPendingFilter, setHighlightLessonId } = useAction();
  const [recentLessons, setRecentLessons] = useState<LessonItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    const lessons = await getAllLessons();
    const studentsData = await getAllStudents();
    setStudents(studentsData);
    const today = new Date().toISOString().split('T')[0];
    const getEndPassed = (l: Lesson): boolean => {
      const endTime = l.timeSlot?.split('-')[1]?.trim();
      if (!endTime) return true;
      return new Date() >= new Date(`${l.date}T${endTime}:00`);
    };

    const upcoming: LessonItem[] = [];
    const confirmable: LessonItem[] = [];
    for (const l of lessons) {
      if (l.confirmedAt) continue;
      if (l.date > today || (l.date === today && !getEndPassed(l))) {
        upcoming.push({ ...l, category: 'upcoming' });
      } else {
        confirmable.push({ ...l, category: 'confirmable' });
      }
    }
    confirmable.sort((a, b) => b.date.localeCompare(a.date));
    upcoming.sort((a, b) => a.date.localeCompare(b.date));
    setRecentLessons([...confirmable, ...upcoming].slice(0, 30));

    const pending = lessons.filter((l) => {
      if (l.paid) return false;
      if (l.confirmedAt) return true;
      if (l.date < today) return true;
      if (l.date === today) return getEndPassed(l);
      return false;
    }).reduce((sum, l) => sum + l.amount, 0);
    setPendingAmount(pending);

    const todayLessons = lessons.filter((l) => l.date === today);
    setTodayEarnings(todayLessons.reduce((sum, l) => sum + l.amount, 0));
  };

  const handleConfirmLesson = async (id: number) => {
    await confirmLesson(id);
    loadData();
  };

  const getStudent = (studentId: number) => students.find((s) => s.id === studentId);
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
      return (
        <View style={[styles.recentItem, !isLast && styles.recentItemBorder]}>
          <View style={[styles.colorBar, { backgroundColor: Colors.danger }]} />
          <TouchableOpacity style={styles.recentContentLeft} activeOpacity={0.6} onPress={navigateToLesson}>
            <View style={styles.recentLeft}>
              <Text style={styles.recentName} numberOfLines={1}>{student?.name || '未知学生'}</Text>
              <Text style={styles.recentDate}>{item.date}</Text>
            </View>
            <View style={styles.recentCenter}>
              {item.timeSlot ? <Text style={styles.recentTimeSlot}>{item.timeSlot}</Text> : null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmRight} activeOpacity={0.7} onPress={() => handleConfirmLesson(item.id)}>
            <Text style={styles.recentAmount}>{item.amount.toFixed(0)}元</Text>
            <View style={styles.confirmBadge}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.danger} />
              <Text style={styles.confirmBadgeText}>确认下课</Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.recentItem, !isLast && styles.recentItemBorder]}
        activeOpacity={0.6}
        onPress={navigateToLesson}
      >
        <View style={[styles.colorBar, { backgroundColor: Colors.primary }]} />
        <View style={styles.recentLeft}>
          <Text style={styles.recentName} numberOfLines={1}>{student?.name || '未知学生'}</Text>
          <Text style={styles.recentDate}>{item.date}</Text>
        </View>
        <View style={styles.recentCenter}>
          {item.timeSlot ? <Text style={styles.recentTimeSlot}>{item.timeSlot}</Text> : null}
        </View>
        <View style={styles.recentRight}>
          <Text style={styles.recentAmount}>{item.amount.toFixed(0)}元</Text>
          <View style={[styles.miniBadge, { backgroundColor: Colors.primaryLight }]}>
            <Text style={[styles.miniBadgeText, { color: Colors.primary }]}>待上</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListHeader = () => (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>待上课程</Text>
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
        {/* Header */}
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
            <Ionicons name="refresh" size={22} color={Colors.title} />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
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

        {/* Upcoming Lessons - independently scrollable */}
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
              title="没有待上课程"
              subtitle="去课程记录添加未来的课程安排"
              buttonLabel="添加课程"
              onButtonPress={() => navigation.navigate('Lessons')}
            />
          }
        />

        {/* Overview Cards */}
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
              label="今日课程收益"
              value={`${todayEarnings.toFixed(0)}元`}
              color={Colors.primary}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const QuickActionButton: React.FC<{
  item: typeof QUICK_ACTIONS[0];
  onPress: () => void;
}> = ({ item, onPress }) => {
  const { scale, bounce } = useBounce(onPress);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={bounce}
      style={[styles.quickAction, { backgroundColor: item.color + '12' }]}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
        <View style={[styles.quickActionIcon, { backgroundColor: item.color + '22' }]}>
          <Ionicons name={item.icon as any} size={20} color={item.color} />
        </View>
        <Text style={styles.quickActionLabel}>{item.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  greeting: { fontSize: FontSize.h1, fontWeight: FontWeight.bold, color: Colors.title },
  date: { fontSize: FontSize.caption, color: Colors.caption, marginTop: Spacing.xs },
  refreshButton: {
    width: 44, height: 44, borderRadius: BorderRadius.iconContainer,
    backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center',
    ...Shadows.subtle,
  },
  quickActionsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  quickAction: {
    flex: 1, paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.card, alignItems: 'center',
  },
  quickActionIcon: {
    width: 40, height: 40, borderRadius: BorderRadius.iconContainer,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xs,
  },
  quickActionLabel: {
    fontSize: FontSize.small, color: Colors.body, fontWeight: FontWeight.medium,
  },
  lessonList: { flex: 1 },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title,
  },
  viewAll: { fontSize: FontSize.caption, color: Colors.primary, fontWeight: FontWeight.semiBold },
  recentItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    backgroundColor: Colors.card,
  },
  recentItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  colorBar: { width: 4, height: 40, borderRadius: 2, marginRight: Spacing.md },
  recentLeft: { maxWidth: 80 },
  recentName: {
    fontSize: FontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title,
    marginBottom: 2,
  },
  recentDate: { fontSize: FontSize.small, color: Colors.caption },
  recentCenter: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.sm },
  recentTimeSlot: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    backgroundColor: Colors.primaryLight || '#EEF0FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  recentRight: { alignItems: 'flex-end' },
  recentAmount: {
    fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.title,
    marginBottom: 4,
  },
  miniBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.pill },
  miniBadgeText: { fontSize: 10, fontWeight: FontWeight.semiBold },
  recentContentLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  confirmRight: {
    alignItems: 'flex-end', paddingVertical: Spacing.sm, paddingLeft: Spacing.lg,
  },
  confirmBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.pill, backgroundColor: '#FEE2E2',
  },
  confirmBadgeText: { fontSize: 10, fontWeight: FontWeight.semiBold, color: Colors.danger },
  overviewRow: {
    flexDirection: 'row', gap: Spacing.md,
    marginTop: Spacing.md, marginBottom: Spacing.md,
  },
  overviewLarge: { flex: 0.55 },
  overviewSmall: { flex: 0.45 },
});

export default HomeScreen;
