import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated,
  Dimensions, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../styles/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const BottomSheet: React.FC<BottomSheetProps> = ({ visible, onClose, title, children }) => {
  const sheetHeight = SCREEN_HEIGHT * 0.82;
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1, duration: 300, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: sheetHeight, duration: 250, useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0, duration: 250, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { height: sheetHeight, transform: [{ translateY }] }]}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.title} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.card + 4,
    borderTopRightRadius: BorderRadius.card + 4,
    ...Shadows.floating,
  },
  handleContainer: { alignItems: 'center', paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.divider },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  title: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },
  closeButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.divider, justifyContent: 'center', alignItems: 'center',
  },
  content: { flex: 1, padding: Spacing.xl },
});

export default BottomSheet;
