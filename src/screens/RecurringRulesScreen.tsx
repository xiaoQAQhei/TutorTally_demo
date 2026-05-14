/**
 * ── 模块功能 ─────────────────────────────────────────────
 * RecurringRulesScreen - 周期课程规则管理页面
 *
 * 管理周期性排课规则：创建、编辑、删除规则。
 * 每条规则指定：学生、科目、星期、频率（每周/隔周）、时间段、课时、费用。
 * 支持一键生成未来课程（从开始日期到结束日期，按规则自动排课）。
 * 可排除特定日期（excludedDates 字段，当前未暴露 UI）。
 */
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { RecurringRule, Student, StudentSubject, Lesson } from '../models';
import { getAllRecurringRules, addRecurringRule, updateRecurringRule, deleteRecurringRule, getAllStudents, getSubjectsByStudentId, addLesson } from '../database';
import BottomSheet from '../components/BottomSheet';
import GradientFAB from '../components/GradientFAB';
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
  const [rules, setRules] = useState<RecurringRule[]>([]);                   // 规则列表
  const [students, setStudents] = useState<Student[]>([]);                   // 学生列表（用于选择）
  const [subjects, setSubjects] = useState<StudentSubject[]>([]);            // 选中学生的科目列表
  const [modalVisible, setModalVisible] = useState(false);                   // 编辑弹窗
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null); // 正在编辑的规则
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null); // 表单：选中学生
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null); // 表单：选中科目
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);    // 表单：选中星期（1-7）
  const [interval, setInterval] = useState('1');                              // 表单：频率（1=每周，2=隔周）
  const [timeSlot, setTimeSlot] = useState('');                               // 表单：时间段
  const [duration, setDuration] = useState('2');                              // 表单：课时（小时）
  const [amount, setAmount] = useState('');                                   // 表单：费用（可选）
  const [startDate, setStartDate] = useState('');                             // 表单：开始日期
  const [endDate, setEndDate] = useState('');                                 // 表单：结束日期（可选）
  const [notes, setNotes] = useState('');                                     // 表单：备注
  const { showToast } = useToast();

  // ── 页面聚焦时加载数据 ──
  useFocusEffect(useCallback(() => { loadData(); }, []));

  /**
   * loadData - 加载规则列表和学生列表
   */
  const loadData = async () => {
    setRules(await getAllRecurringRules());
    setStudents(await getAllStudents());
  };

  /**
   * loadSubjectsForStudent - 加载选中学生的科目列表
   *
   * 选择学生后自动加载其科目，并默认选中第一个科目。
   * @param studentId 学生 ID
   */
  const loadSubjectsForStudent = async (studentId: number) => {
    const subs = await getSubjectsByStudentId(studentId);
    setSubjects(subs);
    if (subs.length > 0) setSelectedSubjectId(subs[0].id);
  };

  const getStudentName = (id: number) => students.find(s => s.id === id)?.name || '未知';
  const getSubjectName = (id?: number) => subjects.find(s => s.id === id)?.subject || '';

  /**
   * generateCourses - 根据规则生成未来的课程列表
   *
   * 从开始日期到结束日期（默认未来 30 天），遍历每一天，
   * 如果当天星期匹配规则中的 weekday 且不在排除列表中，生成一条课程。
   * 支持 interval=2 的隔周模式（跳 7 天步进）。
   * @param rule 周期规则
   * @returns 生成的课程数组（不含 id）
   */
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

  /**
   * handleGenerate - 一键生成课程（将规则展开为具体课程并写入数据库）
   *
   * 调用 generateCourses 生成课程数组，逐条写入数据库。
   * @param rule 要展开的周期规则
   */
  const handleGenerate = async (rule: RecurringRule) => {
    const courses = generateCourses(rule);
    for (const c of courses) {
      await addLesson(c);
    }
    showToast(`已生成 ${courses.length} 节课程`, 'success');
  };

  /**
   * handleSave - 保存周期规则（新增或更新）
   *
   * 校验必填项后调用数据库的 addRecurringRule 或 updateRecurringRule。
   */
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

  // 响应式样式：依赖 spacing / fontSize / iconSize 动态计算
  const styles = useMemo(() => ({
    // ═══════════════ 页面容器 ═══════════════
    container: { flex: 1, backgroundColor: Colors.background, width: '100%' as const, alignSelf: 'center' as const },
    list: { paddingBottom: 100, padding: spacing.xl },
    // ═══════════════ 规则卡片 ═══════════════
    card: { backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: spacing.lg, marginBottom: spacing.md } as const,
    cardHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: spacing.md } as const,
    ruleStudent: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title } as const,
    ruleSubtext: { fontSize: fontSize.small, color: Colors.caption, marginTop: 2 } as const,
    // ═══════════════ 一键生成按钮 ═══════════════
    generateBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: Colors.paid, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: BorderRadius.pill, gap: 4 } as const,
    generateBtnText: { fontSize: fontSize.small, color: Colors.white, fontWeight: FontWeight.semiBold } as const,
    // ═══════════════ 星期标签 ═══════════════
    weekdayRow: { flexDirection: 'row' as const, gap: spacing.xs, marginBottom: spacing.sm } as const,
    weekdayDot: { width: scale(30), height: scale(30), borderRadius: scale(15), backgroundColor: Colors.divider, justifyContent: 'center' as const, alignItems: 'center' as const } as const,
    weekdayDotText: { fontSize: fontSize.small, fontWeight: FontWeight.semiBold, color: Colors.caption } as const,
    // ═══════════════ 规则信息 ═══════════════
    ruleInfo: { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: spacing.md } as const,
    ruleInfoText: { fontSize: fontSize.caption, color: Colors.body } as const,
    // ═══════════════ 操作按钮（编辑 / 删除）═══════════════
    actions: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: spacing.lg, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider } as const,
    // ═══════════════ 表单 ═══════════════
    formLabel: { fontSize: fontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.body, marginBottom: spacing.sm, marginTop: spacing.md } as const,
    chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm, marginBottom: spacing.xs } as const,
    chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: BorderRadius.pill, borderWidth: 1.5, borderColor: Colors.divider, backgroundColor: Colors.background } as const,
    chipText: { fontSize: fontSize.caption, color: Colors.body } as const,
    weekdayChip: { width: scale(36), height: scale(36), borderRadius: scale(18), borderWidth: 1.5, borderColor: Colors.divider, backgroundColor: Colors.background, justifyContent: 'center' as const, alignItems: 'center' as const } as const,
    input: { height: inputSize.input, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button, paddingHorizontal: spacing.md, fontSize: fontSize.body, color: Colors.title, backgroundColor: Colors.background } as const,
    formRow: { flexDirection: 'row' as const, gap: spacing.md } as const,
    formHalf: { flex: 1 } as const,
    saveButton: { backgroundColor: Colors.primary, height: inputSize.saveButton, borderRadius: BorderRadius.button, justifyContent: 'center' as const, alignItems: 'center' as const, marginTop: spacing.xl } as const,
    saveButtonText: { color: Colors.white, fontSize: fontSize.body, fontWeight: FontWeight.semiBold } as const,
  } as const), [spacing, fontSize, iconSize]);

  /**
   * renderRule - 渲染单条规则卡片
   *
   * 卡片展示：学生名、科目、星期分布（圆点阵列）、时间段·时长·频率、
   * 一键生成按钮、编辑/删除操作。
   * @param item 周期规则
   */
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
        <TextInput style={styles.input} placeholder="如 14:00-16:00" value={timeSlot} onChangeText={setTimeSlot} placeholderTextColor={Colors.caption} />
        <View style={styles.formRow}>
          <View style={styles.formHalf}>
            <Text style={styles.formLabel}>课时（小时）</Text>
            <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholderTextColor={Colors.caption} />
          </View>
          <View style={styles.formHalf}>
            <Text style={styles.formLabel}>费用（可选）</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="自动计算" placeholderTextColor={Colors.caption} />
          </View>
        </View>
        <Text style={styles.formLabel}>开始日期</Text>
        <TextInput style={styles.input} placeholder="如 2026-05-10" value={startDate} onChangeText={setStartDate} placeholderTextColor={Colors.caption} />
        <Text style={styles.formLabel}>结束日期（可选）</Text>
        <TextInput style={styles.input} placeholder="留空则持续生成" value={endDate} onChangeText={setEndDate} placeholderTextColor={Colors.caption} />
        <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{editingRule ? '更新规则' : '创建规则'}</Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
};

export default RecurringRulesScreen;
