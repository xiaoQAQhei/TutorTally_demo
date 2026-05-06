import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LessonStatusColors, StatusTransitions, FontSize, FontWeight, BorderRadius, Spacing } from '../styles/theme';
import { LessonStatus } from '../models';

const StatusIcons: Record<string, 'book' | 'time' | 'checkmark-circle' | 'close-circle'> = {
  scheduled: 'book', completed: 'time', paid: 'checkmark-circle', cancelled: 'close-circle',
};

interface StatusBadgeProps {
  status: LessonStatus;
  showNextAction?: boolean;
  onToggle?: (nextStatus: LessonStatus) => void;
  allowPaid?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showNextAction, onToggle, allowPaid }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const colors = LessonStatusColors[status];
  const nextStatuses = (StatusTransitions[status] || []) as LessonStatus[];

  const handleTap = (next: LessonStatus) => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.25, useNativeDriver: true, speed: 30, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    onToggle?.(next);
  };

  return (
    <Animated.View style={{ transform: [{ scale }], flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      <View style={[styles.badge, { backgroundColor: colors.bg }]}>
        <Ionicons name={StatusIcons[status]} size={14} color={colors.text} />
        <Text style={[styles.text, { color: colors.text }]}>{colors.label}</Text>
      </View>
      {showNextAction && nextStatuses.map(next => {
        const nc = LessonStatusColors[next];
        if (next === 'paid' && allowPaid === false) return null;
        return (
          <TouchableOpacity key={next} activeOpacity={0.7} onPress={() => handleTap(next)}>
            <View style={[styles.actionBtn, { backgroundColor: nc.bg }]}>
              <Ionicons name={StatusIcons[next]} size={12} color={nc.text} />
              <Text style={[styles.actionText, { color: nc.text }]}>{nc.label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.pill, gap: 4 },
  text: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs, borderRadius: BorderRadius.pill, gap: 4 },
  actionText: { fontSize: 11, fontWeight: FontWeight.medium },
});

export default StatusBadge;
