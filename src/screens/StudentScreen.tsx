import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Student, StudentSubject } from '../models';
import { addStudent, getAllStudents, updateStudent, deleteStudent, addSubject, getSubjectsByStudentId, updateSubject, deleteSubject, addRateHistory } from '../database';
import GradientFAB from '../components/GradientFAB';
import BottomSheet from '../components/BottomSheet';
import Toast from '../components/Toast';
import StudentAvatar from '../components/StudentAvatar';
import EmptyState from '../components/EmptyState';
import {
  Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows,
  SubjectColorPalette,
} from '../styles/theme';
import { useResponsive } from '../utils/responsive';

const StudentScreen: React.FC = () => {
  const { maxContentWidth } = useResponsive();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentSubjects, setStudentSubjects] = useState<Record<number, StudentSubject[]>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [editSubjects, setEditSubjects] = useState<{ id?: number; subject: string; hourlyRate: string; color: string }[]>([{ subject: '', hourlyRate: '', color: SubjectColorPalette[0] }]);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({ visible: false, message: '', type: 'success' });

  useFocusEffect(useCallback(() => { loadStudents(); }, []));

  const loadStudents = async () => {
    const students = await getAllStudents();
    setStudents(students);
    const subsMap: Record<number, StudentSubject[]> = {};
    for (const s of students) {
      subsMap[s.id] = await getSubjectsByStudentId(s.id);
    }
    setStudentSubjects(subsMap);
  };

  const handleSave = async () => {
    if (!name || editSubjects.length === 0 || editSubjects.some(s => !s.subject || !s.hourlyRate)) {
      setToast({ visible: true, message: '请填写学生姓名和至少一个科目（含科目名和课时费）', type: 'error' });
      return;
    }
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
    setToast({ visible: true, message: editingStudent ? '学生信息已更新' : '学生已添加', type: 'success' });
  };

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

  const handleDelete = async (id: number) => { await deleteStudent(id); loadStudents(); };

  const openAddModal = () => {
    setEditingStudent(null);
    setName('');
    setPhone('');
    setAddress('');
    setEditSubjects([{ subject: '', hourlyRate: '', color: SubjectColorPalette[0] }]);
    setModalVisible(true);
  };

  const renderStudent = ({ item }: { item: Student }) => {
    const subs = studentSubjects[item.id] || [];
    return (
      <View style={[styles.card, Shadows.standard]}>
        <View style={styles.cardMain}>
          <StudentAvatar name={item.name} color={subs.length > 0 ? (subs[0].color || SubjectColorPalette[0]) : SubjectColorPalette[0]} size={48} />
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
            <Ionicons name="call-outline" size={14} color={Colors.caption} />
            <Text style={styles.phoneText}>{item.phone}</Text>
          </View>
        ) : null}
        {item.address ? (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={Colors.caption} />
            <Text style={styles.addressText} numberOfLines={1}>{item.address}</Text>
          </View>
        ) : null}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(item)}>
            <Ionicons name="pencil" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item.id)}>
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
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
            <TextInput
              style={[styles.input, styles.subjectInput]}
              placeholder="科目名"
              value={sub.subject}
              onChangeText={(v) => { const arr = [...editSubjects]; arr[idx] = { ...arr[idx], subject: v }; setEditSubjects(arr); }}
              placeholderTextColor={Colors.caption}
            />
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
              <Ionicons name="close-circle" size={24} color={editSubjects.length > 1 ? Colors.danger : Colors.divider} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addSubjectBtn} onPress={() => {
          setEditSubjects([...editSubjects, { subject: '', hourlyRate: '', color: SubjectColorPalette[editSubjects.length % SubjectColorPalette.length] }]);
        }}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
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

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, width: '100%', alignSelf: 'center' },
  list: { padding: Spacing.xl, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.card,
    padding: Spacing.lg, marginBottom: Spacing.md,
  },
  cardMain: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1, marginLeft: Spacing.md },
  name: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: 4 },
  subjectTags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  subjectTag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs, borderRadius: BorderRadius.pill },
  subjectTagText: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold },
  subjectTagRate: { fontSize: FontSize.small, color: Colors.caption },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  phoneText: { fontSize: FontSize.caption, color: Colors.caption },
  addressRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  addressText: { fontSize: FontSize.caption, color: Colors.caption, flex: 1 },
  actions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg,
    marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  actionButton: { padding: Spacing.sm },
  formLabel: { fontSize: FontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.body, marginBottom: Spacing.sm, marginTop: Spacing.md },
  input: {
    height: 50, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
    paddingHorizontal: Spacing.md, fontSize: FontSize.body, color: Colors.title,
    backgroundColor: Colors.background,
  },
  subjectEditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  subjectInput: { flex: 1.5 },
  rateInput: { flex: 1 },
  addSubjectBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm },
  addSubjectText: { fontSize: FontSize.caption, color: Colors.primary, fontWeight: FontWeight.medium },
  saveButton: {
    backgroundColor: Colors.paid, height: 52, borderRadius: BorderRadius.button,
    justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl,
  },
  saveButtonText: { color: Colors.white, fontSize: FontSize.body, fontWeight: FontWeight.semiBold },
});

export default StudentScreen;
