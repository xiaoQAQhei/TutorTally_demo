/**
 * ── 模块功能 ─────────────────────────────────────────────
 * RecurringRulesScreen - 周期课程规则管理页面
 *
 * 管理周期性排课规则：创建、编辑、删除规则。
 * 每条规则指定：学生、科目、星期、频率（每周/隔周）、时间段、课时、费用。
 * 支持一键生成未来课程（从开始日期到结束日期，按规则自动排课）。
 * 可排除特定日期（excludedDates 字段，当前未暴露 UI）。
 */
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { RecurringRule, Student, StudentSubject, Lesson } from '../models';
import { getAllRecurringRules, addRecurringRule, updateRecurringRule, deleteRecurringRule, getAllStudents, getSubjectsByStudentId, addLesson } from '../database';
import BottomSheet from '../components/BottomSheet';
import GradientFAB from '../components/GradientFAB';
import CalendarPicker from '../components/CalendarPicker';
import TimeRangePicker from '../components/TimeRangePicker';
import { useToast } from '../contexts/ToastContext';
import EmptyState from '../components/EmptyState';
import { Colors, FontWeight, BorderRadius, Shadows, SubjectColorPalette } from '../styles/theme';
import { useResponsive, scale } from '../utils/responsive';

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

/**
 * RecurringRulesScreen 组件
 *
 * 周期排课规则管理：列表展示已有规则，提供创建/编辑/删除操作，
 * 以及一键生成未来课程的功能。
 */
const RecurringRulesScreen: React.FC = () => {
  const { maxContentWidth, spacing, fontSize, isTablet, iconSize, inputSize } = useResponsive();
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
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const timeArrowRot = useRef(new Animated.Value(0)).current;
  const startArrowRot = useRef(new Animated.Value(0)).current;
  const endArrowRot = useRef(new Animated.Value(0)).current;
  const { showToast } = useToast();

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

  // ── 选择科目时自动填充课时费 ──
  useEffect(() => {
    if (selectedSubjectId && subjects.length > 0) {
      const sub = subjects.find(s => s.id === selectedSubjectId);
      if (sub) setAmount(sub.hourlyRate.toString());
    }
  }, [selectedSubjectId, subjects]);

  // ── 选择器箭头旋转动画 ──
  useEffect(() => {
    Animated.timing(timeArrowRot, { toValue: showTimePicker ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [showTimePicker]);
  useEffect(() => {
    Animated.timing(startArrowRot, { toValue: showCalendar && datePickerMode === 'start' ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [showCalendar, datePickerMode]);
  useEffect(() => {
    Animated.timing(endArrowRot, { toValue: showCalendar && datePickerMode === 'end' ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [showCalendar, datePickerMode]);

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
    showToast(`已生成 ${courses.length} 节课程`, 'success');
  };

  const handleSave = async () => {
    if (!selectedStudentId || selectedWeekdays.length === 0 || !timeSlot || !startDate) {
      showToast('请填写必填项', 'error'); return;
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
    showToast(editingRule ? '规则已更新' : '规则已添加', 'success');
  };

  const resetForm = () => {
    setEditingRule(null); setSelectedStudentId(null); setSelectedSubjectId(null);
    setSelectedWeekdays([]); setInterval('1'); setTimeSlot(''); setDuration('2');
    setAmount(''); setStartDate(''); setEndDate(''); setNotes(''); setSubjects([]);
  };

  const openDatePicker = (mode: 'start' | 'end') => {
    setDatePickerMode(mode);
    setShowCalendar(true);
  };

  const styles = useMemo(() => ({
    container: { flex: 1, backgroundColor: Colors.background, width: '100%' as const, alignSelf: 'center' as const },
    list: { paddingBottom: 100, padding: spacing.xl },
    card: { backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: spacing.lg, marginBottom: spacing.md } as const,
    cardHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: spacing.md } as const,
    ruleStudent: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title } as const,
    ruleSubtext: { fontSize: fontSize.small, color: Colors.caption, marginTop: 2 } as const,
    generateBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: Colors.paid, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: BorderRadius.pill, gap: 4 } as const,
    generateBtnText: { fontSize: fontSize.small, color: Colors.white, fontWeight: FontWeight.semiBold } as const,
    weekdayRow: { flexDirection: 'row' as const, gap: spacing.xs, marginBottom: spacing.sm } as const,
    weekdayDot: { width: scale(30), height: scale(30), borderRadius: scale(15), backgroundColor: Colors.divider, justifyContent: 'center' as const, alignItems: 'center' as const } as const,
    weekdayDotText: { fontSize: fontSize.small, fontWeight: FontWeight.semiBold, color: Colors.caption } as const,
    ruleInfo: { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: spacing.md } as const,
    ruleInfoText: { fontSize: fontSize.caption, color: Colors.body } as const,
    actions: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: spacing.lg, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider } as const,
    formLabel: { fontSize: fontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.body, marginBottom: spacing.sm, marginTop: spacing.md } as const,
    chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm, marginBottom: spacing.xs } as const,
    chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: BorderRadius.pill, borderWidth: 1.5, borderColor: Colors.divider, backgroundColor: Colors.background } as const,
    chipText: { fontSize: fontSize.caption, color: Colors.body } as const,
    weekdayChip: { width: scale(36), height: scale(36), borderRadius: scale(18), borderWidth: 1.5, borderColor: Colors.divider, backgroundColor: Colors.background, justifyContent: 'center' as const, alignItems: 'center' as const } as const,
    input: { height: inputSize.input, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button, paddingHorizontal: spacing.md, fontSize: fontSize.body, color: Colors.title, backgroundColor: Colors.background } as const,
    pickerTouch: { height: inputSize.input, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button, paddingHorizontal: spacing.md, justifyContent: 'center' as const, backgroundColor: Colors.background } as const,
    pickerTouchText: { fontSize: fontSize.body, color: Colors.title } as const,
    pickerPlaceholder: { fontSize: fontSize.body, color: Colors.caption } as const,
    formRow: { flexDirection: 'row' as const, gap: spacing.md } as const,
    formHalf: { flex: 1 } as const,
    saveButton: { backgroundColor: Colors.primary, height: inputSize.saveButton, borderRadius: BorderRadius.button, justifyContent: 'center' as const, alignItems: 'center' as const, marginTop: spacing.xl } as const,
    saveButtonText: { color: Colors.white, fontSize: fontSize.body, fontWeight: FontWeight.semiBold } as const,
  } as const), [spacing, fontSize, iconSize]);

  const renderRule = ({ item }: { item: RecurringRule }) => {
    const weekdays = JSON.parse(item.weekdays || '[]') as number[];
    return (
      <View style={[styles.card, Shadows.standard]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.ruleStudent}>{getStudentName(item.studentId)}</Text>
            <Text style={styles.ruleSubtext}>{getSubjectName(item.studentSubjectId) || '未指定科目'}</Text>
          </View>
          <TouchableOpacity onPress={() => handleGenerate(item)}>
            <View style={styles.generateBtn}>
              <Ionicons name="flash" size={iconSize.xs} color={Colors.white} />
              <Text style={styles.generateBtnText}>生成</Text>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.weekdayRow}>
          {[1,2,3,4,5,6,7].map(d => (
            <View key={d} style={[styles.weekdayDot, weekdays.includes(d) && { backgroundColor: Colors.primary }]}>
              <Text style={[styles.weekdayDotText, weekdays.includes(d) && { color: Colors.white }]}>{WEEKDAY_LABELS[d-1]}</Text>
            </View>
          ))}
        </View>
        <View style={styles.ruleInfo}>
          <Text style={styles.ruleInfoText}>{item.timeSlot} · {item.duration}h · {item.interval === 2 ? '隔周' : '每周'}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => { setEditingRule(item); setSelectedStudentId(item.studentId); loadSubjectsForStudent(item.studentId); setSelectedSubjectId(item.studentSubjectId || null); setSelectedWeekdays(JSON.parse(item.weekdays)); setInterval(item.interval.toString()); setTimeSlot(item.timeSlot); setDuration(item.duration.toString()); setAmount(item.amount?.toString() || ''); setStartDate(item.startDate); setEndDate(item.endDate || ''); setNotes(item.notes || ''); setModalVisible(true); }}>
            <Ionicons name="pencil" size={iconSize.md} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { deleteRecurringRule(item.id); loadData(); }}>
            <Ionicons name="trash-outline" size={iconSize.md} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { maxWidth: maxContentWidth }]}>
      <FlatList data={rules} renderItem={renderRule} keyExtractor={item => item.id.toString()} contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon="repeat-outline" title="没有周期规则" subtitle="创建规则自动排课" buttonLabel="创建规则" onButtonPress={() => { resetForm(); setModalVisible(true); }} />}
      />
      <GradientFAB icon="add" onPress={() => { resetForm(); setModalVisible(true); }} color={Colors.pending} />
      <BottomSheet visible={modalVisible} onClose={() => { setModalVisible(false); resetForm(); }} title={editingRule ? '编辑周期规则' : '创建周期规则'}>
        <Text style={styles.formLabel}>学生</Text>
        <View style={styles.chipRow}>
          {students.map(s => (
            <TouchableOpacity key={s.id} style={[styles.chip, selectedStudentId === s.id && { backgroundColor: Colors.primary, borderColor: Colors.primary }]} onPress={() => { setSelectedStudentId(s.id); loadSubjectsForStudent(s.id); }}>
              <Text style={[styles.chipText, selectedStudentId === s.id && { color: Colors.white }]}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {subjects.length > 0 && (
          <>
            <Text style={styles.formLabel}>科目</Text>
            <View style={styles.chipRow}>
              {subjects.map(sub => (
                <TouchableOpacity key={sub.id} style={[styles.chip, selectedSubjectId === sub.id && { backgroundColor: Colors.primary, borderColor: Colors.primary }]} onPress={() => setSelectedSubjectId(sub.id)}>
                  <Text style={[styles.chipText, selectedSubjectId === sub.id && { color: Colors.white }]}>{sub.subject}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        <Text style={styles.formLabel}>星期</Text>
        <View style={styles.chipRow}>
          {[1,2,3,4,5,6,7].map(d => (
            <TouchableOpacity key={d} style={[styles.weekdayChip, selectedWeekdays.includes(d) && { backgroundColor: Colors.primary, borderColor: Colors.primary }]} onPress={() => { setSelectedWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); }}>
              <Text style={[styles.chipText, selectedWeekdays.includes(d) && { color: Colors.white }]}>{WEEKDAY_LABELS[d-1]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.formLabel}>频率</Text>
        <View style={styles.chipRow}>
          {[{v:'1',l:'每周'},{v:'2',l:'隔周'}].map(o => (
            <TouchableOpacity key={o.v} style={[styles.chip, interval === o.v && { backgroundColor: Colors.primary, borderColor: Colors.primary }]} onPress={() => setInterval(o.v)}>
              <Text style={[styles.chipText, interval === o.v && { color: Colors.white }]}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.formLabel}>时间段</Text>
        <TouchableOpacity style={[styles.pickerTouch, { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]} onPress={() => setShowTimePicker(true)}>
          <Ionicons name="time-outline" size={iconSize.md} color={Colors.primary} />
          <Text style={[{ flex: 1 }, timeSlot ? styles.pickerTouchText : styles.pickerPlaceholder]}>{timeSlot || '选择时间段'}</Text>
          <Animated.View style={{ transform: [{ rotate: timeArrowRot.interpolate({ inputRange: [0,1], outputRange: ["0deg", "180deg"] }) }] }}><Ionicons name="chevron-down" size={iconSize.sm} color={Colors.caption} /></Animated.View>
        </TouchableOpacity>
        <View style={styles.formRow}>
          <View style={styles.formHalf}>
            <Text style={styles.formLabel}>课时（小时）</Text>
            <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholderTextColor={Colors.caption} />
          </View>
          <View style={styles.formHalf}>
            <Text style={styles.formLabel}>费用</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="自动从科目获取" placeholderTextColor={Colors.caption} />
          </View>
        </View>
        <Text style={styles.formLabel}>开始日期</Text>
        <TouchableOpacity style={[styles.pickerTouch, { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]} onPress={() => openDatePicker('start')}>
          <Ionicons name="calendar-outline" size={iconSize.md} color={Colors.primary} />
          <Text style={[{ flex: 1 }, startDate ? styles.pickerTouchText : styles.pickerPlaceholder]}>{startDate || '选择开始日期'}</Text>
          <Ionicons name="chevron-down" size={iconSize.sm} color={Colors.caption} />
        </TouchableOpacity>
        <Text style={styles.formLabel}>结束日期（可选）</Text>
        <TouchableOpacity style={[styles.pickerTouch, { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]} onPress={() => openDatePicker('end')}>
          <Ionicons name="calendar-outline" size={iconSize.md} color={Colors.primary} />
          <Text style={[{ flex: 1 }, endDate ? styles.pickerTouchText : styles.pickerPlaceholder]}>{endDate || '选择结束日期'}</Text>
          <Animated.View style={{ transform: [{ rotate: startArrowRot.interpolate({ inputRange: [0,1], outputRange: ["0deg", "180deg"] }) }] }}><Ionicons name="chevron-down" size={iconSize.sm} color={Colors.caption} /></Animated.View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{editingRule ? '更新规则' : '创建规则'}</Text>
        </TouchableOpacity>
      </BottomSheet>

      <CalendarPicker
        visible={showCalendar}
        value={datePickerMode === 'start' ? startDate : endDate}
        onConfirm={(d) => {
          if (datePickerMode === 'start') setStartDate(d);
          else setEndDate(d);
          setShowCalendar(false);
        }}
        onClose={() => setShowCalendar(false)}
      />

      <TimeRangePicker
        visible={showTimePicker}
        onConfirm={(sh, sm, eh, em) => {
          const slot = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}-${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
          setTimeSlot(slot);
        }}
        onClose={() => setShowTimePicker(false)}
      />
    </View>
  );
};

export default RecurringRulesScreen;
