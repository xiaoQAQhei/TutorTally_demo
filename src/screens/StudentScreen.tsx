import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Student } from '../models';
import { addStudent, getAllStudents, updateStudent, deleteStudent } from '../database';
import GradientFAB from '../components/GradientFAB';
import BottomSheet from '../components/BottomSheet';
import Toast from '../components/Toast';
import StudentAvatar from '../components/StudentAvatar';
import EmptyState from '../components/EmptyState';
import {
  Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows,
  getSubjectColor,
} from '../styles/theme';

const SUBJECTS = ['数学', '英语', '物理', '语文'];

const StudentScreen: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({ visible: false, message: '', type: 'success' });

  useFocusEffect(useCallback(() => { loadStudents(); }, []));

  const loadStudents = async () => { setStudents(await getAllStudents()); };

  const handleSave = async () => {
    if (!name || !subject || !hourlyRate) {
      setToast({ visible: true, message: '请填写学生姓名、科目和课时费', type: 'error' });
      return;
    }
    if (editingStudent) {
      await updateStudent({ ...editingStudent, name, subject, hourlyRate: parseFloat(hourlyRate), phone, address });
    } else {
      await addStudent({ name, subject, hourlyRate: parseFloat(hourlyRate), phone, address, createdAt: new Date().toISOString() });
    }
    setModalVisible(false);
    setEditingStudent(null);
    setName('');
    setSubject('');
    setHourlyRate('');
    setPhone('');
    loadStudents();
    setToast({ visible: true, message: editingStudent ? '学生信息已更新' : '学生已添加', type: 'success' });
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setName(student.name);
    setSubject(student.subject);
    setHourlyRate(student.hourlyRate.toString());
    setPhone(student.phone || '');
    setAddress(student.address || '');
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => { await deleteStudent(id); loadStudents(); };

  const openAddModal = () => {
    setEditingStudent(null);
    setName('');
    setSubject('');
    setHourlyRate('');
    setPhone('');
    setAddress('');
    setModalVisible(true);
  };

  const renderStudent = ({ item }: { item: Student }) => {
    const subjectColor = getSubjectColor(item.subject);
    return (
      <View style={[styles.card, Shadows.standard, { borderLeftWidth: 4, borderLeftColor: subjectColor }]}>
        <View style={styles.cardMain}>
          <StudentAvatar name={item.name} subject={item.subject} size={48} />
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={styles.subjectRow}>
              <View style={[styles.subjectDot, { backgroundColor: subjectColor }]} />
              <Text style={styles.subjectText}>{item.subject}</Text>
            </View>
          </View>
          <View style={styles.rateBox}>
            <Text style={styles.rate}>{item.hourlyRate}元</Text>
            <Text style={styles.rateUnit}>/小时</Text>
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
    <View style={styles.container}>
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

        <Text style={styles.formLabel}>辅导科目</Text>
        <View style={styles.subjectsRow}>
          {SUBJECTS.map((sub) => {
            const subColor = getSubjectColor(sub);
            const active = subject === sub;
            return (
              <TouchableOpacity
                key={sub}
                style={[styles.subjectChip, active && { backgroundColor: subColor + '20', borderColor: subColor }]}
                onPress={() => setSubject(sub)}
              >
                <Text style={[styles.subjectChipText, active && { color: subColor, fontWeight: FontWeight.semiBold }]}>{sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.formLabel}>课时费（元/小时）</Text>
        <TextInput style={styles.input} placeholder="如 150" value={hourlyRate} onChangeText={setHourlyRate} keyboardType="numeric" placeholderTextColor={Colors.caption} />

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
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.xl, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.card,
    padding: Spacing.lg, marginBottom: Spacing.md,
  },
  cardMain: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1, marginLeft: Spacing.md },
  name: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: 4 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },
  subjectText: { fontSize: FontSize.small, color: Colors.caption },
  rateBox: { alignItems: 'flex-end' },
  rate: { fontSize: FontSize.amount, fontWeight: FontWeight.bold, color: Colors.paid },
  rateUnit: { fontSize: FontSize.small, color: Colors.caption, marginTop: 2 },
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
  subjectsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
  subjectChip: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.pill, borderWidth: 1.5, borderColor: Colors.divider,
    backgroundColor: Colors.background,
  },
  subjectChipText: { fontSize: FontSize.caption, color: Colors.body },
  saveButton: {
    backgroundColor: Colors.paid, height: 52, borderRadius: BorderRadius.button,
    justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl,
  },
  saveButtonText: { color: Colors.white, fontSize: FontSize.body, fontWeight: FontWeight.semiBold },
});

export default StudentScreen;
