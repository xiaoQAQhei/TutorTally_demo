// ── 学生头像组件（StudentAvatar） ──
/**
 * 根据学生姓名显示对应的 Emoji 头像，
 * 支持自定义颜色和尺寸。
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getStudentEmoji, BorderRadius } from '../styles/theme';

/** StudentAvatar 组件属性 */
interface StudentAvatarProps {
  name: string;                 // 学生姓名（用于生成 Emoji）
  subject?: string;             // 学科（暂未使用，保留扩展）
  color?: string;               // 背景色，默认 #6366F1
  size?: number;                // 尺寸，默认 44
}

const StudentAvatar: React.FC<StudentAvatarProps> = ({ name, color = '#6366F1', size = 44 }) => {
  // 根据姓名获取对应的 Emoji
  const emoji = getStudentEmoji(name);
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: BorderRadius.iconContainer, backgroundColor: color + '18' }]}>
      <Text style={{ fontSize: size * 0.46 }}>{emoji}</Text>
    </View>
  );
};

const styles = StyleSheet.create({ container: { justifyContent: 'center', alignItems: 'center' } });
export default StudentAvatar;
