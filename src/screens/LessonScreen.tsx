import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Lesson, Student } from '../models';
import { addLesson, getAllLessons, updateLesson, deleteLesson, toggleLessonPaid, getAllStudents } from '../database';

const LessonScreen: React.FC = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadLessons();
      loadStudents();
    }, [])
  );

  const loadLessons = async () => {
    const data = await getAllLessons();
    setLessons(data);
  };

  const loadStudents = async () => {
    const data = await getAllStudents();
    setStudents(data);
    if (data.length > 0) {
      setSelectedStudentId(data[0].id);
    }
  };

  const getStudentName = (studentId: number) => {
    const student = students.find((s) => s.id === studentId);
    return student?.name || '未知学生';
  };

  const getStudentRate = (studentId: number) => {
    const student = students.find((s) => s.id === studentId);
    return student?.hourlyRate || 0;
  };

  const calculateAmount = () => {
    if (!selectedStudentId || !duration) return 0;
    return getStudentRate(selectedStudentId) * parseFloat(duration);
  };

  const handleSave = async () => {
    if (!selectedStudentId || !date || !duration) {
      Alert.alert('提示', '请填写完整信息');
      return;
    }

    const amount = calculateAmount();

    if (editingLesson) {
      await updateLesson({
        ...editingLesson,
        studentId: selectedStudentId,
        date,
        duration: parseFloat(duration),
        amount,
        notes,
      });
    } else {
      await addLesson({
        studentId: selectedStudentId,
        date,
        duration: parseFloat(duration),
        amount,
        paid: false,
        notes,
        createdAt: new Date().toISOString(),
      });
    }

    setModalVisible(false);
    setEditingLesson(null);
    setSelectedStudentId(students[0]?.id || null);
    setDate('');
    setDuration('');
    setNotes('');
    loadLessons();
  };

  const handleTogglePaid = async (lesson: Lesson) => {
    await toggleLessonPaid(lesson.id, !lesson.paid);
    loadLessons();
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      '确认删除',
      '确定要删除这条课程记录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteLesson(id);
            loadLessons();
          },
        },
      ]
    );
  };

  const handleEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setSelectedStudentId(lesson.studentId);
    setDate(lesson.date);
    setDuration(lesson.duration.toString());
    setNotes(lesson.notes || '');
    setModalVisible(true);
  };

  const renderLesson = ({ item }: { item: Lesson }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.studentName}>{getStudentName(item.studentId)}</Text>
          <Text style={styles.date}>{item.date}</Text>
        </View>
        <TouchableOpacity
          style={[styles.paidBadge, item.paid ? styles.paidBgd : styles.unpaidBgd]}
          onPress={() => handleTogglePaid(item)}
        >
          <Text style={item.paid ? styles.paidText : styles.unpaidText}>{item.paid ? '已收款' : '待收款'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>课时</Text>
          <Text style={styles.value}>{item.duration} 小时</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>金额</Text>
          <Text style={styles.value}>¥{item.amount.toFixed(2)}</Text>
        </View>
        {item.notes && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>备注</Text>
            <Text style={styles.value}>{item.notes}</Text>
          </View>
        )}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(item)}>
          <Ionicons name="pencil" size={20} color="#4CAF50" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item.id)}>
          <Ionicons name="trash" size={20} color="#f44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={lessons}
        renderItem={renderLesson}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
      />

      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingLesson ? '编辑课程' : '添加课程'}</Text>
            <TouchableOpacity onPress={() => {
              setModalVisible(false);
              setEditingLesson(null);
            }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.label}>选择学生</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowStudentPicker(true)}>
              <Text style={selectedStudentId ? styles.pickerText : styles.pickerPlaceholder}>
                {selectedStudentId ? getStudentName(selectedStudentId) : '请选择学生'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="上课日期（YYYY-MM-DD）"
              value={date}
              onChangeText={setDate}
            />
            <TextInput
              style={styles.input}
              placeholder="课时（小时）"
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
            />
            <View style={styles.amountRow}>
              <Text style={styles.label}>课时费</Text>
              <Text style={styles.amountText}>¥{calculateAmount().toFixed(2)}</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="备注（可选）"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showStudentPicker} animationType="fade" transparent>
        <TouchableOpacity style={styles.pickerOverlay} onPress={() => setShowStudentPicker(false)}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>选择学生</Text>
              <TouchableOpacity onPress={() => setShowStudentPicker(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {students.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.pickerItem, selectedStudentId === s.id && styles.pickerItemActive]}
                  onPress={() => {
                    setSelectedStudentId(s.id);
                    setShowStudentPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, selectedStudentId === s.id && styles.pickerItemTextActive]}>
                    {s.name}
                  </Text>
                  {selectedStudentId === s.id && (
                    <Ionicons name="checkmark" size={20} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  list: {
    paddingBottom: 100,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  date: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  paidBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  paidBgd: {
    backgroundColor: '#E8F5E9',
  },
  unpaidBgd: {
    backgroundColor: '#FFEBEE',
  },
  paidText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  unpaidText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f44336',
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#999',
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 16,
  },
  actionButton: {
    padding: 8,
  },
  addButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    backgroundColor: '#2196F3',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    padding: 16,
  },
  pickerButton: {
    height: 48,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '80%',
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerItemActive: {
    backgroundColor: '#E8F5E9',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  pickerItemTextActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  input: {
    height: 48,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 12,
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LessonScreen;
