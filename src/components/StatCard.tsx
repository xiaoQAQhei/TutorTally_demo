import React from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, BorderRadius, Shadows, Spacing } from '../styles/theme';
import { useFadeIn, useScale } from '../styles/animations';

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
  onPress?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  color = Colors.primary,
  onPress,
}) => {
  const { opacity, translateY } = useFadeIn();
  const { scale, scaleDown, scaleUp } = useScale();

  const content = (
    <Animated.View
      style={[
        styles.card,
        Shadows.subtle,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: Colors.title }]}>{value}</Text>
    </Animated.View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      onPressIn={scaleDown}
      onPressOut={scaleUp}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {content}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.smallCard,
    padding: Spacing.lg,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.iconContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    color: Colors.caption,
    marginBottom: Spacing.xs,
  },
  value: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
  },
});

export default StatCard;
