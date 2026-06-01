/**
 * ── 模块功能 ─────────────────────────────────────────────
 * StudentScreen - 学生管理页面
 *
 * 展示所有学生列表，支持添加/编辑/删除学生。
 * 每个学生卡片显示姓名、头像、科目标签（含颜色）、联系方式。
 * 添加/编辑时使用 BottomSheet 表单，支持多科目设置（含科目选择面板）。
 * 修改课时费时会自动记录调价历史。
 */
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Animated as RNAnimated } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAction } from '../contexts/ActionContext';
import { Student, StudentSubject } from '../models';
import { addStudent, getAllStudents, updateStudent, deleteStudent, addSubject, getSubjectsByStudentId, updateSubject, deleteSubject, addRateHistory } from '../database';
import GradientFAB from '../components/GradientFAB';
import BottomSheet from '../components/BottomSheet';
import { useToast } from '../contexts/ToastContext';
import StudentAvatar from '../components/StudentAvatar';
import EmptyState from '../components/EmptyState';
import {
  Colors, FontWeight, BorderRadius, Shadows,
  SubjectColorPalette, DefaultSubjectColors,
} from '../styles/theme';
import { useResponsive, scale } from '../utils/responsive';

/**
 * StudentScreen 组件
 *
 * 学生管理：展示学生列表卡片，提供添加/编辑/删除功能。
 * 编辑表单使用 BottomSheet 弹出，支持多科目选择（含颜色标签），
 * 课时费变更时自动记录调价历史。
 */
const StudentScreen: React.FC = () => {
  const { maxContentWidth, spacing, fontSize, isTablet, iconSize } = useResponsive();
  const { pendingAction, clearAction, confirmBeforeChange } = useAction();  // 消费首页"添加学生"的跳转动作 + 设置中的确认开关

  // ═══════════════ 样式 ═══════════════
  const styles = useMemo(() => ({
    // ═══════════════ 页面容器 ═══════════════
    container: { flex: 1, backgroundColor: Colors.background, width: '100%' as const, alignSelf: 'center' as const },
    list: { paddingBottom: 100 },                                                                     // 列表底部留白（给 FAB 让位）

    // ═══════════════ 学生卡片 ═══════════════
    card: {
      backgroundColor: Colors.card, borderRadius: BorderRadius.card,
      padding: spacing.lg, marginBottom: spacing.md,marginHorizontal: spacing.md,
    },
    cardMain: { flexDirection: 'row' as const, alignItems: 'center' as const },                      // 卡片主体（头像 + 信息）
    info: { flex: 1, marginLeft: spacing.md },                                                       // 学生信息区
    name: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: 4 }, // 学生名

    // ═══════════════ 科目标签 ═══════════════
    subjectTags: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.xs, marginTop: spacing.sm },
    subjectTag: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs, borderRadius: BorderRadius.pill },
    subjectTagText: { fontSize: fontSize.small, fontWeight: FontWeight.semiBold },                   // 科目名
    subjectTagRate: { fontSize: fontSize.small, color: Colors.caption },                             // 课时费
    subjectDot: { width: scale(8), height: scale(8), borderRadius: scale(4) },                      // 科目颜色圆点

    // ═══════════════ 联系方式 ═══════════════
    phoneRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs,
      marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider,
    },
    phoneText: { fontSize: fontSize.caption, color: Colors.caption },                                 // 电话文字
    addressRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs,
      marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider,
    },
    addressText: { fontSize: fontSize.caption, color: Colors.caption, flex: 1 },                      // 地址文字

    // ═══════════════ 操作按钮（编辑 / 删除）═══════════════
    actions: {
      flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: spacing.lg,
      marginTop: spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider,
    },
    actionButton: { padding: spacing.sm },                                                           // 单个操作按钮

    // ═══════════════ 表单 ═══════════════
    formLabel: { fontSize: fontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.body, marginBottom: spacing.sm, marginTop: spacing.md },
    input: {
      height: scale(50), borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
      paddingHorizontal: spacing.md, fontSize: fontSize.body, color: Colors.title,
      backgroundColor: Colors.background,
    },
    subjectEditRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, marginBottom: spacing.sm }, // 科目编辑行
    subjectInput: { flex: 1},                                                        // 科目名输入框
    rateInput: { flex: 2 },                                                             // 课时费输入框
    addSubjectBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs, paddingVertical: spacing.sm }, // 添加科目按钮
    addSubjectText: { fontSize: fontSize.caption, color: Colors.primary, fontWeight: FontWeight.medium },
    subjectChip: {                                                                                   // 科目选择标签
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: BorderRadius.pill, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    subjectChipText: { fontSize: fontSize.small, fontWeight: FontWeight.semiBold },                  // 科目选择文字

    // ═══════════════ 确认弹窗 ═══════════════
    confirmOverlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.overlay, justifyContent: 'center' as const, alignItems: 'center' as const, zIndex: 200 },
    confirmBox: { backgroundColor: Colors.card, padding: spacing.xxl, width: '80%' as const, borderRadius: BorderRadius.card },
    confirmTitle: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: spacing.md, textAlign: 'center' as const },
    confirmMessage: { fontSize: fontSize.body, color: Colors.body, marginBottom: spacing.xl, textAlign: 'center' as const },
    confirmButtons: { flexDirection: 'row' as const, gap: spacing.md },
    confirmCancelBtn: { flex: 1, height: scale(46), borderRadius: scale(23), backgroundColor: Colors.background, justifyContent: 'center' as const, alignItems: 'center' as const },
    confirmCancelText: { fontSize: fontSize.body, color: Colors.caption, fontWeight: FontWeight.medium },
    confirmOkBtn: { flex: 1, height: scale(46), borderRadius: scale(23), backgroundColor: Colors.primary, justifyContent: 'center' as const, alignItems: 'center' as const },
    confirmOkText: { fontSize: fontSize.body, color: Colors.white, fontWeight: FontWeight.semiBold },

    saveButton: {
      backgroundColor: Colors.paid, height: scale(52), borderRadius: BorderRadius.button,
      justifyContent: 'center' as const, alignItems: 'center' as const, marginTop: spacing.xl,
    },
    saveButtonText: { color: Colors.white, fontSize: fontSize.body, fontWeight: FontWeight.semiBold },
  } as const), [spacing, fontSize, iconSize]);

  const [students, setStudents] = useState<Student[]>([]);                           // 学生列表
  const [studentSubjects, setStudentSubjects] = useState<Record<number, StudentSubject[]>>({}); // 学生 -> 科目映射
  const [modalVisible, setModalVisible] = useState(false);                           // 编辑弹窗是否显示
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);        // 正在编辑的学生（null=新增模式）
  const [name, setName] = useState('');                                               // 表单：姓名
  const [phone, setPhone] = useState('');                                             // 表单：电话
  const [address, setAddress] = useState('');                                         // 表单：地址
  const [editSubjects, setEditSubjects] = useState<{ id?: number; subject: string; hourlyRate: string; color: string }[]>([{ subject: '', hourlyRate: '', color: SubjectColorPalette[0] }]); // 表单：科目列表
  const { showToast } = useToast();
  const [pickingSubject, setPickingSubject] = useState<number | null>(null);
  const subArrowRot = useSharedValue(0);                                                                     // 科目选择器箭头旋转
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void } | null>(null); // 确认弹窗
  const [deletingStudentId, setDeletingStudentId] = useState<number | null>(null); // 正在渐隐退出的学生 ID
  const deleteFadeAnim = useRef(new RNAnimated.Value(1)).current;                  // 删除渐隐：1→0

  // ── 页面聚焦时：加载学生数据，并检查首页触发的"添加学生"动作 ──
  useFocusEffect(useCallback(() => {
    loadStudents();
    if (pendingAction === 'addStudent') {
      openAddModal();
      clearAction();
    }
  }, [pendingAction, clearAction]));
  // ── 科目选择器箭头旋转动画（reanimated） ──
  useEffect(() => {
    subArrowRot.value = withTiming(pickingSubject !== null ? 1 : 0, { duration: 200 });
  }, [pickingSubject]);
  const subArrowRotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(subArrowRot.value, [0, 1], [0, 180])}deg` }],
  }));


  /**
   * loadStudents - 加载所有学生及其科目信息
   *
   * 遍历学生列表，为每个学生加载对应的科目数据，
   * 结果存入 students 和 studentSubjects 两个状态。
   */
  const loadStudents = async () => {
    const students = await getAllStudents();
    setStudents(students);
    const subsMap: Record<number, StudentSubject[]> = {};
    for (const s of students) {
      subsMap[s.id] = await getSubjectsByStudentId(s.id);
    }
    setStudentSubjects(subsMap);
  };

  /**
   * handleSave - 保存学生信息（新增或更新）
   *
   * 校验必填项（姓名 + 至少一个有效科目），
   * 新增时创建学生记录及科目，更新时先记录调价历史再更新。
   */
  const handleSave = async () => {
    const missing: string[] = [];
    if (!name) missing.push('姓名');
    if (editSubjects.length === 0) missing.push('至少一个科目');
    else {
      editSubjects.forEach((s, i) => {
        if (!s.subject) missing.push(`科目${i + 1}名称`);
        if (!s.hourlyRate) missing.push(`科目${i + 1}课时费`);
      });
    }
    if (missing.length > 0) { showToast(`请填写：${missing.join('、')}`, 'error'); return; }
    if (editingStudent) {
      await updateStudent({ ...editingStudent, name, phone, address, updatedAt: new Date().toISOString() } as any);
      for (const es of editSubjects) {
        if (es.id) {
          const oldSub = (studentSubjects[editingStudent.id] || []).find(s => s.id === es.id);
          if (oldSub && oldSub.hourlyRate !== parseFloat(es.hourlyRate)) {
            await addRateHistory({ studentSubjectId: es.id, oldRate: oldSub.hourlyRate, newRate: parseFloat(es.hourlyRate), changedAt: new Date().toISOString() });
          }
          await updateSubject({ id: es.id, studentId: editingStudent.id, subject: es.subject, hourlyRate: parseFloat(es.hourlyRate), color: es.color, createdAt: oldSub?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() } as any);
        } else {
          await addSubject({ studentId: editingStudent.id, subject: es.subject, hourlyRate: parseFloat(es.hourlyRate), color: es.color, createdAt: new Date().toISOString() });
        }
      }
    } else {
      const newId = await addStudent({ name, phone, address, createdAt: new Date().toISOString() });
      for (const es of editSubjects) {
        await addSubject({ studentId: newId, subject: es.subject, hourlyRate: parseFloat(es.hourlyRate), color: es.color, createdAt: new Date().toISOString() });
      }
    }
    setModalVisible(false);
    setEditingStudent(null);
    setName(''); setPhone(''); setAddress('');
    setEditSubjects([{ subject: '', hourlyRate: '', color: SubjectColorPalette[0] }]);
    loadStudents();
    showToast(editingStudent ? '学生信息已更新' : '学生已添加', 'success');
  };

  /**
   * handleEdit - 打开编辑学生弹窗
   *
   * 填充学生已有信息到表单状态，同时加载该学生的科目数据。
   * @param student 要编辑的学生对象
   */
  const handleEdit = async (student: Student) => {
    setEditingStudent(student);
    setName(student.name);
    setPhone(student.phone || '');
    setAddress(student.address || '');
    const subs = await getSubjectsByStudentId(student.id);
    if (subs.length > 0) {
      setEditSubjects(subs.map(s => ({ id: s.id, subject: s.subject, hourlyRate: s.hourlyRate.toString(), color: s.color || SubjectColorPalette[0] })));
    } else {
      setEditSubjects([{ subject: '', hourlyRate: '', color: SubjectColorPalette[0] }]);
    }
    setModalVisible(true);
  };

  /**
   * handleDelete - 执行删除学生操作
   *
   * 删除后重新加载列表，关闭确认弹窗。
   * @param id 学生 ID
   */
  const handleDelete = async (id: number) => {
    // 渐隐动画（useNativeDriver: true 原生驱动），完成后执行删除
    setDeletingStudentId(id);
    RNAnimated.timing(deleteFadeAnim, {
      toValue: 0, duration: 500, useNativeDriver: true,
    }).start(async () => {
      await deleteStudent(id);
      setDeletingStudentId(null);
      deleteFadeAnim.setValue(1);
      loadStudents();
      setConfirmDialog(null);
    });
  };

  /**
   * confirmDelete - 弹出删除确认对话框
   *
   * 设置 confirmDialog 状态，用户确认后执行 handleDelete。
   * @param id 学生 ID
   * @param name 学生姓名（用于提示信息）
   */
  const confirmDelete = (id: number, name: string) => {
    // 关联设置中的"状态变更前提醒"开关：关则直接删除，开则弹窗确认
    if (!confirmBeforeChange) {
      handleDelete(id);
      return;
    }
    setConfirmDialog({
      visible: true,
      title: '删除学生',
      message: `确定要删除"${name}"吗？该学生的所有课程记录也将被删除。`,
      onConfirm: () => handleDelete(id),
    });
  };

  /** 打开新增学生弹窗，清空所有表单字段 */
  const openAddModal = () => {
    setEditingStudent(null);
    setName('');
    setPhone('');
    setAddress('');
    setEditSubjects([{ subject: '', hourlyRate: '', color: SubjectColorPalette[0] }]);
    setModalVisible(true);
  };

  /**
   * renderStudent - 渲染单个学生卡片
   *
   * 卡片包含：头像、姓名、科目标签（颜色圆点 + 科目名 + 课时费）、
   * 联系方式（电话/地址）、编辑/删除操作按钮。
   * @param item 学生对象
   */
  const renderStudent = ({ item }: { item: Student }) => {
    const subs = studentSubjects[item.id] || [];
    return (
      <RNAnimated.View style={[styles.card, Shadows.standard, { opacity: deletingStudentId === item.id ? deleteFadeAnim : 1 }]}>
        <View style={styles.cardMain}>
          {/* 头像尺寸：iconSize.avatar.lg（手机48 / 平板52），改大小到 theme.ts 调整 avatar.lg */}
          <StudentAvatar name={item.name} color={subs.length > 0 ? (subs[0].color || SubjectColorPalette[0]) : SubjectColorPalette[0]} size={iconSize.avatar.lg} />
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={styles.subjectTags}>
              {subs.map(sub => (
                <View key={sub.id} style={[styles.subjectTag, { backgroundColor: (sub.color || SubjectColorPalette[0]) + '18' }]}>
                  <View style={[styles.subjectDot, { backgroundColor: sub.color || SubjectColorPalette[0] }]} />
                  <Text style={[styles.subjectTagText, { color: sub.color || SubjectColorPalette[0] }]}>{sub.subject}</Text>
                  <Text style={styles.subjectTagRate}>{sub.hourlyRate}元/h</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        {item.phone ? (
          <View style={styles.phoneRow}>
            <Ionicons name="call-outline" size={iconSize.xs} color={Colors.caption} />
            <Text style={styles.phoneText}>{item.phone}</Text>
          </View>
        ) : null}
        {item.address ? (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={iconSize.xs} color={Colors.caption} />
            <Text style={styles.addressText} numberOfLines={1}>{item.address}</Text>
          </View>
        ) : null}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(item)}>
            <Ionicons name="pencil" size={iconSize.md} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => confirmDelete(item.id, item.name)}>
            <Ionicons name="trash-outline" size={iconSize.md} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </RNAnimated.View>
    );
  };

  return (
    <View style={[styles.container, { maxWidth: maxContentWidth }]}>
      <FlatList
        data={students}
        renderItem={renderStudent}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="还没有添加学生"
            subtitle="点击右下角按钮添加第一个学生"
            buttonLabel="添加学生"
            onButtonPress={openAddModal}
          />
        }
      />

      <GradientFAB icon="add" onPress={openAddModal} color={Colors.paid} />

      <BottomSheet visible={modalVisible} onClose={() => { setModalVisible(false); setEditingStudent(null); }} title={editingStudent ? '编辑学生' : '添加学生'}>
        <Text style={styles.formLabel}>学生姓名</Text>
        <TextInput style={styles.input} placeholder="输入姓名" value={name} onChangeText={setName} placeholderTextColor={Colors.caption} />

        <Text style={styles.formLabel}>科目与课时费</Text>
        {editSubjects.map((sub, idx) => (
          <View key={idx} style={styles.subjectEditRow}>
            <TouchableOpacity
              style={[styles.input, styles.subjectInput, { flexDirection: 'row', alignItems: 'center' }]}
              onPress={() => setPickingSubject(idx)}
            >
              <Text style={[{ flex: 1 }, sub.subject ? { color: Colors.title, fontSize: fontSize.body, fontWeight: FontWeight.medium } : { color: Colors.caption, fontSize: fontSize.body }]}>
                {sub.subject || '选择科目'}
              </Text>
              <Animated.View style={subArrowRotStyle}><Ionicons name="chevron-down" size={iconSize.sm} color={Colors.caption} /></Animated.View>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, styles.rateInput]}
              placeholder="元/h"
              value={sub.hourlyRate}
              onChangeText={(v) => { const arr = [...editSubjects]; arr[idx] = { ...arr[idx], hourlyRate: v }; setEditSubjects(arr); }}
              keyboardType="numeric"
              placeholderTextColor={Colors.caption}
            />
            <TouchableOpacity onPress={() => {
              if (editSubjects.length > 1) setEditSubjects(editSubjects.filter((_, i) => i !== idx));
            }}>
              <Ionicons name="close-circle" size={iconSize.lg} color={editSubjects.length > 1 ? Colors.danger : Colors.divider} />
            </TouchableOpacity>
          </View>
        ))}
        {/* ── 科目选择面板 ── */}
        {pickingSubject !== null && (
          <View style={{ flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm, marginBottom: spacing.md }}>
            {Object.entries(DefaultSubjectColors).map(([subject, color]) => (
              <TouchableOpacity
                key={subject}
                style={[styles.subjectChip, { backgroundColor: color + '18' }]}
                onPress={() => {
                  const arr = [...editSubjects];
                  arr[pickingSubject] = { ...arr[pickingSubject], subject, color };
                  setEditSubjects(arr);
                  setPickingSubject(null);
                }}
              >
                <Text style={[styles.subjectChipText, { color }]}>{subject}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.subjectChip, { borderWidth: 1, borderColor: Colors.divider, borderStyle: 'dashed' as const }]}
              onPress={() => {
                const arr = [...editSubjects];
                arr[pickingSubject] = { ...arr[pickingSubject], subject: '', color: SubjectColorPalette[pickingSubject % SubjectColorPalette.length] };
                setEditSubjects(arr);
                setPickingSubject(null);
              }}
            >
              <Ionicons name="create-outline" size={iconSize.xs} color={Colors.caption} />
              <Text style={[styles.subjectChipText, { color: Colors.caption }]}>手动输入</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={styles.addSubjectBtn} onPress={() => {
          setEditSubjects([...editSubjects, { subject: '', hourlyRate: '', color: SubjectColorPalette[editSubjects.length % SubjectColorPalette.length] }]);
        }}>
          <Ionicons name="add-circle-outline" size={iconSize.lg} color={Colors.primary} />
          <Text style={styles.addSubjectText}>添加科目</Text>
        </TouchableOpacity>

        <Text style={styles.formLabel}>联系电话（可选）</Text>
        <TextInput style={styles.input} placeholder="输入电话" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={Colors.caption} />

        <Text style={styles.formLabel}>上课地址（可选）</Text>
        <TextInput style={styles.input} placeholder="如 幸福小区3号楼201" value={address} onChangeText={setAddress} placeholderTextColor={Colors.caption} />

        <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{editingStudent ? '更新学生' : '添加学生'}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* ── 确认弹窗 ── */}
      {confirmDialog?.visible && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>{confirmDialog.title}</Text>
            <Text style={styles.confirmMessage}>{confirmDialog.message}</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmDialog(null)}>
                <Text style={styles.confirmCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmOkBtn} onPress={confirmDialog.onConfirm}>
                <Text style={styles.confirmOkText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    </View>
  );
};

export default StudentScreen;
