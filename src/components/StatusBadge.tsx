import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing } from '../styles/theme';

interface StatusBadgeProps {
  isPaid: boolean;
  isUpcoming?: boolean;
  confirmMode?: boolean;
  onToggle: () => void;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ isPaid, isUpcoming, confirmMode, onToggle }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handleToggle = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.25, useNativeDriver: true, speed: 30, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    onToggle();
  };

  let bgColor: string;
  let textColor: string;
  let icon: 'checkmark-circle' | 'book' | 'time';
  let label: string;

  if (confirmMode) {
    bgColor = '#FEE2E2';
    textColor = Colors.danger;
    icon = 'checkmark-circle';
    label = '确认下课';
  } else if (isPaid) {
    bgColor = Colors.paidBg;
    textColor = Colors.paid;
    icon = 'checkmark-circle';
    label = '已收款';
  } else if (isUpcoming) {
    bgColor = Colors.primaryLight;
    textColor = Colors.primary;
    icon = 'book';
    label = '待上课';
  } else {
    bgColor = Colors.pendingBg;
    textColor = Colors.pending;
    icon = 'time';
    label = '待收款';
  }

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={handleToggle}>
      <Animated.View style={[styles.badge, { backgroundColor: bgColor, transform: [{ scale }] }]}>
        <Ionicons name={icon} size={14} color={textColor} />
        <Text style={[styles.text, { color: textColor }]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.pill, gap: 4,
  },
  text: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold },
});

export default StatusBadge;
