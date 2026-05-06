import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getStudentEmoji, BorderRadius } from '../styles/theme';

interface StudentAvatarProps {
  name: string;
  subject?: string;
  color?: string;
  size?: number;
}

const StudentAvatar: React.FC<StudentAvatarProps> = ({ name, color = '#6366F1', size = 44 }) => {
  const emoji = getStudentEmoji(name);
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: BorderRadius.iconContainer, backgroundColor: color + '18' }]}>
      <Text style={{ fontSize: size * 0.46 }}>{emoji}</Text>
    </View>
  );
};

const styles = StyleSheet.create({ container: { justifyContent: 'center', alignItems: 'center' } });
export default StudentAvatar;
