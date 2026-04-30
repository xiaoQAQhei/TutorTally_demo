import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StudentStats } from '../models';
import { getAllStudents, getLessonsByStudentId } from '../database';

const StatsScreen: React.FC = () => {
  const [stats, setStats] = useState<StudentStats[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalStudents: 0,
    totalLessons: 0,
    totalHours: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
  });

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );

  const loadStats = async () => {
    const students = await getAllStudents();
    const studentStats: StudentStats[] = [];

    let totalLessons = 0;
    let totalHours = 0;
    let totalAmount = 0;
    let paidAmount = 0;

    for (const student of students) {
      const lessons = await getLessonsByStudentId(student.id);
      const studentTotalHours = lessons.reduce((sum, lesson) => sum + lesson.duration, 0);
      const studentTotalAmount = lessons.reduce((sum, lesson) => sum + lesson.amount, 0);
      const studentPaidAmount = lessons.filter((l) => l.paid).reduce((sum, lesson) => sum + lesson.amount, 0);

      studentStats.push({
        student,
        totalLessons: lessons.length,
        totalHours: studentTotalHours,
        totalAmount: studentTotalAmount,
        paidAmount: studentPaidAmount,
        pendingAmount: studentTotalAmount - studentPaidAmount,
      });

      totalLessons += lessons.length;
      totalHours += studentTotalHours;
      totalAmount += studentTotalAmount;
      paidAmount += studentPaidAmount;
    }

    setStats(studentStats);
    setTotalStats({
      totalStudents: students.length,
      totalLessons,
      totalHours,
      totalAmount,
      paidAmount,
      pendingAmount: totalAmount - paidAmount,
    });
  };

  const renderStatCard = (icon: string, label: string, value: string | number, color: string) => (
    <View style={styles.statCard}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );

  const renderStudentRow = ({ item }: { item: StudentStats }) => (
    <View style={styles.tableRow}>
      <View style={styles.tableCellName}>
        <Text style={styles.cellName}>{item.student.name}</Text>
        <Text style={styles.cellSubject}>{item.student.subject}</Text>
      </View>
      <View style={styles.tableCell}>
        <Text style={styles.cellValue}>{item.totalLessons}节</Text>
      </View>
      <View style={styles.tableCell}>
        <Text style={styles.cellValue}>{item.totalHours.toFixed(1)}h</Text>
      </View>
      <View style={styles.tableCell}>
        <Text style={styles.cellValue}>¥{item.totalAmount.toFixed(0)}</Text>
      </View>
      <View style={styles.tableCell}>
        <Text style={styles.cellValuePaid}>¥{item.paidAmount.toFixed(0)}</Text>
      </View>
      <View style={styles.tableCell}>
        <Text style={item.pendingAmount > 0 ? styles.cellValuePending : styles.cellValuePaid}>
          ¥{item.pendingAmount.toFixed(0)}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.statsGrid}>
          {renderStatCard('users', '学生数', totalStats.totalStudents, '#4CAF50')}
          {renderStatCard('book-open', '总课时', totalStats.totalLessons + '节', '#2196F3')}
          {renderStatCard('clock', '总时长', totalStats.totalHours.toFixed(1) + 'h', '#FF9800')}
          {renderStatCard('wallet', '总收入', '¥' + totalStats.totalAmount.toFixed(0), '#9C27B0')}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>已收款</Text>
              <Text style={styles.summaryValuePaid}>¥{totalStats.paidAmount.toFixed(0)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>待收款</Text>
              <Text style={styles.summaryValuePending}>¥{totalStats.pendingAmount.toFixed(0)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tableContainer}>
          <Text style={styles.tableTitle}>学生账单汇总</Text>
          <View style={styles.tableHeader}>
            <View style={styles.tableHeaderCellName}>
              <Text style={styles.headerText}>学生</Text>
            </View>
            <View style={styles.tableHeaderCell}>
              <Text style={styles.headerText}>课时</Text>
            </View>
            <View style={styles.tableHeaderCell}>
              <Text style={styles.headerText}>时长</Text>
            </View>
            <View style={styles.tableHeaderCell}>
              <Text style={styles.headerText}>合计</Text>
            </View>
            <View style={styles.tableHeaderCell}>
              <Text style={styles.headerText}>已交</Text>
            </View>
            <View style={styles.tableHeaderCell}>
              <Text style={styles.headerText}>待交</Text>
            </View>
          </View>
          <FlatList
            data={stats}
            renderItem={renderStudentRow}
            keyExtractor={(item) => item.student.id.toString()}
            scrollEnabled={false}
          />
          {stats.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="file-text" size={48} color="#ccc" />
              <Text style={styles.emptyText}>暂无数据</Text>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: '47%',
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
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  summaryValuePaid: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  summaryValuePending: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f44336',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#eee',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
  },
  tableHeaderCellName: {
    width: '25%',
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    width: '15%',
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
  tableBody: {
    maxHeight: 400,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableCellName: {
    width: '25%',
    paddingHorizontal: 8,
  },
  tableCell: {
    width: '15%',
    alignItems: 'center',
  },
  cellName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  cellSubject: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  cellValue: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
  cellValuePaid: {
    fontSize: 13,
    color: '#4CAF50',
    textAlign: 'center',
    fontWeight: '500',
  },
  cellValuePending: {
    fontSize: 13,
    color: '#f44336',
    textAlign: 'center',
    fontWeight: '500',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});

export default StatsScreen;
