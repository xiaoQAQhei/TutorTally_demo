import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LessonStatusColors, StatusTransitions, FontSize, FontWeight, BorderRadius, Spacing } from '../styles/theme';
import { LessonStatus } from '../models';

const StatusIcons: Record<string, 'book' | 'time' | 'checkmark-circle' | 'close-circle' | 'wallet'> = {
  scheduled: 'book', completed: 'time', pendingPayment: 'wallet', paid: 'checkmark-circle', cancelled: 'close-circle',
};

interface StatusBadgeProps {
  status: LessonStatus;
  disabled?: boolean;
  onToggle?: (nextStatus: LessonStatus) => void;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, disabled, onToggle }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const nextStatuses = (StatusTransitions[status] || []) as LessonStatus[];
  const tappable = !disabled && nextStatuses.length > 0 && onToggle;

  // scheduled + class ended → show red "确认下课" CTA badge
  const isConfirmMode = status === 'scheduled' && !disabled;
  const colors = isConfirmMode
    ? { bg: '#FEE2E2', text: '#EF4444' }
    : LessonStatusColors[status];
  const label = isConfirmMode ? '确认下课' : LessonStatusColors[status].label;
  const icon = isConfirmMode ? 'checkmark-circle' as const : StatusIcons[status];

  const handleTap = () => {
    if (!tappable || nextStatuses.length === 0) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.25, useNativeDriver: true, speed: 30, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    onToggle(nextStatuses[0]);
  };

  return (
    <TouchableOpacity activeOpacity={tappable ? 0.75 : 1} onPress={handleTap} disabled={!tappable}>
      <Animated.View style={[styles.badge, { backgroundColor: colors.bg, transform: [{ scale }] }]}>
        <Ionicons name={icon} size={14} color={colors.text} />
        <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.pill, gap: 4 },
  text: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold },
});

export default StatusBadge;
