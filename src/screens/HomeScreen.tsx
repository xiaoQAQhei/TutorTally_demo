import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Lesson, Student } from '../models';
import { getAllLessons, getAllStudents } from '../database';

interface Props {
  navigation: {
    navigate: (screen: string) => void;
  };
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [recentLessons, setRecentLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const lessons = await getAllLessons();
    const studentsData = await getAllStudents();
    
    setStudents(studentsData);
    setRecentLessons(lessons.slice(0, 5));
    
    const pending = lessons.filter((l) => !l.paid).length;
    setPendingCount(pending);
    
    const today = new Date().toISOString().split('T')[0];
    const todayLessons = lessons.filter((l) => l.date === today && l.paid);
    const earnings = todayLessons.reduce((sum, l) => sum + l.amount, 0);
    setTodayEarnings(earnings);
  };

  const getStudentName = (studentId: number) => {
    const student = students.find((s) => s.id === studentId);
    return student?.name || '未知学生';
  };

  const renderQuickAction = (icon: string, label: string, screen: string, color: string) => (
    <TouchableOpacity
      style={[styles.quickAction, { backgroundColor: color + '15' }]}
      onPress={() => navigation.navigate(screen)}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={24} color="white" />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>你好，老师</Text>
            <Text style={styles.date}>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="user" size={32} color="white" />
          </View>
        </View>

        <View style={styles.overviewCards}>
          <View style={styles.overviewCard}>
            <View style={[styles.overviewIcon, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="alert-circle" size={24} color="#f44336" />
            </View>
            <View>
              <Text style={styles.overviewLabel}>待收款</Text>
              <Text style={[styles.overviewValue, { color: '#f44336' }]}>{pendingCount} 笔</Text>
            </View>
          </View>
          <View style={styles.overviewCard}>
            <View style={[styles.overviewIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="trending-up" size={24} color="#4CAF50" />
            </View>
            <View>
              <Text style={styles.overviewLabel}>今日收入</Text>
              <Text style={styles.overviewValue}>¥{todayEarnings.toFixed(0)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>快捷操作</Text>
          <View style={styles.quickActionsGrid}>
            {renderQuickAction('user-plus', '添加学生', 'Students', '#4CAF50')}
            {renderQuickAction('book-open', '记录课程', 'Lessons', '#2196F3')}
            {renderQuickAction('pie-chart', '查看统计', 'Stats', '#FF9800')}
            {renderQuickAction('file-text', '课程列表', 'Lessons', '#9C27B0')}
          </View>
        </View>

        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>最近课程</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Lessons')}>
              <Text style={styles.viewAll}>查看全部</Text>
            </TouchableOpacity>
          </View>
          {recentLessons.length > 0 ? (
            <View style={styles.recentList}>
              {recentLessons.map((lesson) => (
                <View key={lesson.id} style={styles.recentItem}>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentStudent}>{getStudentName(lesson.studentId)}</Text>
                    <Text style={styles.recentDate}>{lesson.date}</Text>
                  </View>
                  <View style={styles.recentRight}>
                    <Text style={styles.recentAmount}>¥{lesson.amount.toFixed(0)}</Text>
                    <View style={lesson.paid ? styles.recentPaid : styles.recentUnpaid}>
                      <Text style={lesson.paid ? styles.recentPaidText : styles.recentUnpaidText}>
                        {lesson.paid ? '已收' : '待收'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar" size={48} color="#ccc" />
              <Text style={styles.emptyText}>暂无课程记录</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('Lessons')}>
                <Text style={styles.emptyButtonText}>添加课程</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  date: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: '#4CAF50',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overviewCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  overviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overviewLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  quickActions: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAction: {
    width: '47%',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  recentSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAll: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  recentList: {
    gap: 12,
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recentItemLast: {
    borderBottomWidth: 0,
  },
  recentInfo: {
    flex: 1,
  },
  recentStudent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  recentDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  recentRight: {
    alignItems: 'flex-end',
  },
  recentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  recentPaid: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  recentUnpaid: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  recentPaidText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  recentUnpaidText: {
    fontSize: 10,
    color: '#f44336',
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  emptyButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
