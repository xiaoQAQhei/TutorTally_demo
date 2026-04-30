import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing } from '../styles/theme';

interface StatusBadgeProps {
  isPaid: boolean;
  isUpcoming?: boolean;
  onToggle: () => void;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ isPaid, isUpcoming, onToggle }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handleToggle = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.25, useNativeDriver: true, speed: 30, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    onToggle();
  };

  const bgColor = isPaid ? Colors.paidBg : isUpcoming ? Colors.primaryLight : Colors.pendingBg;
  const textColor = isPaid ? Colors.paid : isUpcoming ? Colors.primary : Colors.pending;
  const icon = isPaid ? 'checkmark-circle' : isUpcoming ? 'book' : 'time';
  const label = isPaid ? '已收款' : isUpcoming ? '待上课' : '待收款';

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
