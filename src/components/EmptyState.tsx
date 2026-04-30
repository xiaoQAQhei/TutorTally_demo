import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../styles/theme';
import { useFadeIn } from '../styles/animations';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  buttonLabel?: string;
  onButtonPress?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  buttonLabel,
  onButtonPress,
}) => {
  const { opacity, translateY } = useFadeIn();

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon as any} size={56} color={Colors.caption} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {buttonLabel && onButtonPress ? (
        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={onButtonPress}>
          <Ionicons name="add-circle-outline" size={18} color={Colors.white} />
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl * 2,
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.divider,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.semiBold,
    color: Colors.title,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.caption,
    color: Colors.caption,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  buttonText: {
    color: Colors.white,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semiBold,
  },
});

export default EmptyState;
