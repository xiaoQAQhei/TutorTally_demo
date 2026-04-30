import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../styles/theme';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error';
  onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ visible, message, type = 'error', onDismiss }) => {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 3 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 100, duration: 200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => onDismiss());
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const iconName = type === 'success' ? 'checkmark-circle' : 'alert-circle';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.wrapper}>
        <Animated.View
          style={[styles.container, { opacity, transform: [{ translateY }] }, type === 'success' ? styles.successBg : styles.errorBg]}
        >
          <Ionicons name={iconName} size={18} color={Colors.white} />
          <Text style={styles.message}>{message}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1, justifyContent: 'flex-end',
    paddingBottom: 70, paddingHorizontal: Spacing.xl,
    marginHorizontal:Spacing.xxl,
  },
  container: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.button,
    gap: Spacing.sm,
    ...Shadows.floating,
  },
  errorBg: { backgroundColor: Colors.danger },
  successBg: { backgroundColor: Colors.paid },
  message: { flex: 1, fontSize: FontSize.body, color: Colors.white, fontWeight: FontWeight.medium },
});

export default Toast;
