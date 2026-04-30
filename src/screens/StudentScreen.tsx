import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Student } from '../models';
import { addStudent, getAllStudents, updateStudent, deleteStudent } from '../database';

const StudentScreen: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [phone, setPhone] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadStudents();
    }, [])
  );

  const loadStudents = async () => {
    const data = await getAllStudents();
    setStudents(data);
  };

  const handleSave = async () => {
    if (!name || !subject || !hourlyRate) {
      Alert.alert('提示', '请填写完整信息');
      return;
    }

    if (editingStudent) {
      await updateStudent({
        ...editingStudent,
        name,
        subject,
        hourlyRate: parseFloat(hourlyRate),
        phone,
      });
    } else {
      await addStudent({
        name,
        subject,
        hourlyRate: parseFloat(hourlyRate),
        phone,
        createdAt: new Date().toISOString(),
      });
    }

    setModalVisible(false);
    setEditingStudent(null);
    setName('');
    setSubject('');
    setHourlyRate('');
    setPhone('');
    loadStudents();
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setName(student.name);
    setSubject(student.subject);
    setHourlyRate(student.hourlyRate.toString());
    setPhone(student.phone || '');
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      '确认删除',
      '确定要删除这个学生吗？相关的课程记录也会被删除。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteStudent(id);
            loadStudents();
          },
        },
      ]
    );
  };

  const renderStudent = ({ item }: { item: Student }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.subject}>{item.subject}</Text>
        </View>
        <View style={styles.rightSection}>
          <Text style={styles.rate}>¥{item.hourlyRate}/小时</Text>
          {item.phone && <Text style={styles.phone}>{item.phone}</Text>}
        </View>
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
        data={students}
        renderItem={renderStudent}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
      />

      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingStudent ? '编辑学生' : '添加学生'}</Text>
            <TouchableOpacity onPress={() => {
              setModalVisible(false);
              setEditingStudent(null);
            }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <TextInput
              style={styles.input}
              placeholder="学生姓名"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="辅导科目"
              value={subject}
              onChangeText={setSubject}
            />
            <TextInput
              style={styles.input}
              placeholder="课时费（元/小时）"
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="联系电话（可选）"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  subject: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  rate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  phone: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
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
    backgroundColor: '#4CAF50',
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
  input: {
    height: 48,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
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

export default StudentScreen;
