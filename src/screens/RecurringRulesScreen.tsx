import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { RecurringRule, Student, StudentSubject, Lesson } from '../models';
import { getAllRecurringRules, addRecurringRule, updateRecurringRule, deleteRecurringRule, getAllStudents, getSubjectsByStudentId, addLesson } from '../database';
import BottomSheet from '../components/BottomSheet';
import GradientFAB from '../components/GradientFAB';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows, SubjectColorPalette } from '../styles/theme';
import { useResponsive, scale } from '../utils/responsive';

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

const RecurringRulesScreen: React.FC = () => {
  const { maxContentWidth, spacing, fontSize, isTablet } = useResponsive();
  const icSm = isTablet ? 18 : 14;
  const icMd = isTablet ? 22 : 18;
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [interval, setInterval] = useState('1');
  const [timeSlot, setTimeSlot] = useState('');
  const [duration, setDuration] = useState('2');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({ visible: false, message: '', type: 'success' });

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    setRules(await getAllRecurringRules());
    setStudents(await getAllStudents());
  };

  const loadSubjectsForStudent = async (studentId: number) => {
    const subs = await getSubjectsByStudentId(studentId);
    setSubjects(subs);
    if (subs.length > 0) setSelectedSubjectId(subs[0].id);
  };

  const getStudentName = (id: number) => students.find(s => s.id === id)?.name || '未知';
  const getSubjectName = (id?: number) => subjects.find(s => s.id === id)?.subject || '';

  const generateCourses = (rule: RecurringRule) => {
    const start = new Date(rule.startDate);
    const end = rule.endDate ? new Date(rule.endDate) : new Date(Date.now() + 30 * 86400000);
    const excluded = JSON.parse(rule.excludedDates || '[]') as string[];
    const weekdays = JSON.parse(rule.weekdays) as number[];
    const courses: Omit<Lesson, 'id' | '_uuid'>[] = [];
    const cursor = new Date(Math.max(start.getTime(), Date.now()));
    while (cursor <= end) {
      const dayOfWeek = cursor.getDay() === 0 ? 7 : cursor.getDay();
      const dateStr = cursor.toISOString().split('T')[0];
      if (weekdays.includes(dayOfWeek) && !excluded.includes(dateStr)) {
        courses.push({
          studentId: rule.studentId, studentSubjectId: rule.studentSubjectId,
          date: dateStr, timeSlot: rule.timeSlot, duration: rule.duration,
          amount: rule.amount || 0, status: 'scheduled' as const, confirmedAt: null,
          notes: rule.notes || '', createdAt: new Date().toISOString(),
        });
      }
      cursor.setDate(cursor.getDate() + (rule.interval === 2 ? 7 : 1));
    }
    return courses;
  };

  const handleGenerate = async (rule: RecurringRule) => {
    const courses = generateCourses(rule);
    for (const c of courses) {
      await addLesson(c);
    }
    setToast({ visible: true, message: `已生成 ${courses.length} 节课程`, type: 'success' });
  };

  const handleSave = async () => {
    if (!selectedStudentId || selectedWeekdays.length === 0 || !timeSlot || !startDate) {
      setToast({ visible: true, message: '请填写必填项', type: 'error' }); return;
    }
    const ruleData = {
      studentId: selectedStudentId, studentSubjectId: selectedSubjectId || undefined,
      weekdays: JSON.stringify(selectedWeekdays), interval: parseInt(interval) || 1,
      timeSlot, duration: parseFloat(duration) || 2,
      amount: amount ? parseFloat(amount) : undefined,
      startDate, endDate: endDate || undefined, excludedDates: '[]', notes,
      createdAt: new Date().toISOString(),
    };
    if (editingRule) {
      await updateRecurringRule({ ...editingRule, ...ruleData, updatedAt: new Date().toISOString() } as RecurringRule);
    } else {
      await addRecurringRule(ruleData as any);
    }
    setModalVisible(false); resetForm(); loadData();
    setToast({ visible: true, message: editingRule ? '规则已更新' : '规则已添加', type: 'success' });
  };

  const resetForm = () => {
    setEditingRule(null); setSelectedStudentId(null); setSelectedSubjectId(null);
    setSelectedWeekdays([]); setInterval('1'); setTimeSlot(''); setDuration('2');
    setAmount(''); setStartDate(''); setEndDate(''); setNotes(''); setSubjects([]);
  };

  const renderRule = ({ item }: { item: RecurringRule }) => {
    const weekdays = JSON.parse(item.weekdays || '[]') as number[];
    return (
      <View style={[styles.card, Shadows.standard]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.ruleStudent, { fontSize: fontSize.h3 }]}>{getStudentName(item.studentId)}</Text>
            <Text style={[styles.ruleSubtext, { fontSize: fontSize.small }]}>{getSubjectName(item.studentSubjectId) || '未指定科目'}</Text>
          </View>
          <TouchableOpacity onPress={() => handleGenerate(item)}>
            <View style={styles.generateBtn}>
              <Ionicons name="flash" size={icSm} color={Colors.white} />
              <Text style={[styles.generateBtnText, { fontSize: fontSize.small }]}>生成</Text>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.weekdayRow}>
          {[1,2,3,4,5,6,7].map(d => (
            <View key={d} style={[styles.weekdayDot, weekdays.includes(d) && { backgroundColor: Colors.primary }]}>
              <Text style={[styles.weekdayDotText, { fontSize: fontSize.small }, weekdays.includes(d) && { color: Colors.white }]}>{WEEKDAY_LABELS[d-1]}</Text>
            </View>
          ))}
        </View>
        <View style={styles.ruleInfo}>
          <Text style={[styles.ruleInfoText, { fontSize: fontSize.caption }]}>{item.timeSlot} · {item.duration}h · {item.interval === 2 ? '隔周' : '每周'}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => { setEditingRule(item); setSelectedStudentId(item.studentId); loadSubjectsForStudent(item.studentId); setSelectedSubjectId(item.studentSubjectId || null); setSelectedWeekdays(JSON.parse(item.weekdays)); setInterval(item.interval.toString()); setTimeSlot(item.timeSlot); setDuration(item.duration.toString()); setAmount(item.amount?.toString() || ''); setStartDate(item.startDate); setEndDate(item.endDate || ''); setNotes(item.notes || ''); setModalVisible(true); }}>
            <Ionicons name="pencil" size={icMd} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { deleteRecurringRule(item.id); loadData(); }}>
            <Ionicons name="trash-outline" size={icMd} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { maxWidth: maxContentWidth }]}>
      <FlatList data={rules} renderItem={renderRule} keyExtractor={item => item.id.toString()} contentContainerStyle={[styles.list, { padding: spacing.xl }]}
        ListEmptyComponent={<EmptyState icon="repeat-outline" title="没有周期规则" subtitle="创建规则自动排课" buttonLabel="创建规则" onButtonPress={() => { resetForm(); setModalVisible(true); }} />}
      />
      <GradientFAB icon="add" onPress={() => { resetForm(); setModalVisible(true); }} color={Colors.pending} />
      <BottomSheet visible={modalVisible} onClose={() => { setModalVisible(false); resetForm(); }} title={editingRule ? '编辑周期规则' : '创建周期规则'}>
        <Text style={styles.formLabel}>学生</Text>
        <View style={styles.chipRow}>
          {students.map(s => (
            <TouchableOpacity key={s.id} style={[styles.chip, selectedStudentId === s.id && { backgroundColor: Colors.primary, borderColor: Colors.primary }]} onPress={() => { setSelectedStudentId(s.id); loadSubjectsForStudent(s.id); }}>
              <Text style={[styles.chipText, { fontSize: fontSize.caption }, selectedStudentId === s.id && { color: Colors.white }]}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {subjects.length > 0 && (
          <>
            <Text style={[styles.formLabel, { fontSize: fontSize.caption }]}>科目</Text>
            <View style={styles.chipRow}>
              {subjects.map(sub => (
                <TouchableOpacity key={sub.id} style={[styles.chip, selectedSubjectId === sub.id && { backgroundColor: Colors.primary, borderColor: Colors.primary }]} onPress={() => setSelectedSubjectId(sub.id)}>
                  <Text style={[styles.chipText, { fontSize: fontSize.caption }, selectedSubjectId === sub.id && { color: Colors.white }]}>{sub.subject}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        <Text style={styles.formLabel}>星期</Text>
        <View style={styles.chipRow}>
          {[1,2,3,4,5,6,7].map(d => (
            <TouchableOpacity key={d} style={[styles.weekdayChip, selectedWeekdays.includes(d) && { backgroundColor: Colors.primary, borderColor: Colors.primary }]} onPress={() => { setSelectedWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); }}>
              <Text style={[styles.chipText, { fontSize: fontSize.caption }, selectedWeekdays.includes(d) && { color: Colors.white }]}>{WEEKDAY_LABELS[d-1]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.formLabel}>频率</Text>
        <View style={styles.chipRow}>
          {[{v:'1',l:'每周'},{v:'2',l:'隔周'}].map(o => (
            <TouchableOpacity key={o.v} style={[styles.chip, interval === o.v && { backgroundColor: Colors.primary, borderColor: Colors.primary }]} onPress={() => setInterval(o.v)}>
              <Text style={[styles.chipText, { fontSize: fontSize.caption }, interval === o.v && { color: Colors.white }]}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.formLabel}>时间段</Text>
        <TextInput style={styles.input} placeholder="如 14:00-16:00" value={timeSlot} onChangeText={setTimeSlot} placeholderTextColor={Colors.caption} />
        <View style={styles.formRow}>
          <View style={styles.formHalf}>
            <Text style={[styles.formLabel, { fontSize: fontSize.caption }]}>课时（小时）</Text>
            <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholderTextColor={Colors.caption} />
          </View>
          <View style={styles.formHalf}>
            <Text style={[styles.formLabel, { fontSize: fontSize.caption }]}>费用（可选）</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="自动计算" placeholderTextColor={Colors.caption} />
          </View>
        </View>
        <Text style={styles.formLabel}>开始日期</Text>
        <TextInput style={styles.input} placeholder="如 2026-05-10" value={startDate} onChangeText={setStartDate} placeholderTextColor={Colors.caption} />
        <Text style={styles.formLabel}>结束日期（可选）</Text>
        <TextInput style={styles.input} placeholder="留空则持续生成" value={endDate} onChangeText={setEndDate} placeholderTextColor={Colors.caption} />
        <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave}>
          <Text style={[styles.saveButtonText, { fontSize: fontSize.body }]}>{editingRule ? '更新规则' : '创建规则'}</Text>
        </TouchableOpacity>
      </BottomSheet>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast({ ...toast, visible: false })} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, width: '100%', alignSelf: 'center' },
  list: { paddingBottom: 100 },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: Spacing.lg, marginBottom: Spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  ruleStudent: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },
  ruleSubtext: { fontSize: FontSize.small, color: Colors.caption, marginTop: 2 },
  generateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.paid, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.pill, gap: 4 },
  generateBtnText: { fontSize: FontSize.small, color: Colors.white, fontWeight: FontWeight.semiBold },
  weekdayRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
  weekdayDot: { width: scale(30), height: scale(30), borderRadius: scale(15), backgroundColor: Colors.divider, justifyContent: 'center', alignItems: 'center' },
  weekdayDotText: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold, color: Colors.caption },
  ruleInfo: { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing.md },
  ruleInfoText: { fontSize: FontSize.caption, color: Colors.body },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider },
  formLabel: { fontSize: FontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.body, marginBottom: Spacing.sm, marginTop: Spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xs },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.pill, borderWidth: 1.5, borderColor: Colors.divider, backgroundColor: Colors.background },
  chipText: { fontSize: FontSize.caption, color: Colors.body },
  weekdayChip: { width: scale(36), height: scale(36), borderRadius: scale(18), borderWidth: 1.5, borderColor: Colors.divider, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  input: { height: scale(50), borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button, paddingHorizontal: Spacing.md, fontSize: FontSize.body, color: Colors.title, backgroundColor: Colors.background },
  formRow: { flexDirection: 'row', gap: Spacing.md },
  formHalf: { flex: 1 },
  saveButton: { backgroundColor: Colors.primary, height: scale(52), borderRadius: BorderRadius.button, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl },
  saveButtonText: { color: Colors.white, fontSize: FontSize.body, fontWeight: FontWeight.semiBold },
});

export default RecurringRulesScreen;
