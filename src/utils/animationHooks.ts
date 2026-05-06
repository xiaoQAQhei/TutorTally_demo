import { useRef, useState, useCallback } from 'react';
import { Animated, InteractionManager } from 'react-native';

// Card-primary palette
const CARD_COLORS = ['#6366F1', '#818CF8', '#4F46E5', '#A5B4FC'];

// ---- useSlideManager ----
export function useSlideManager() {
  const values = useRef<Map<number, Animated.Value>>(new Map()).current;

  const getValue = useCallback((id: number) => {
    if (!values.has(id)) values.set(id, new Animated.Value(0));
    return values.get(id)!;
  }, []);

  const triggerSlide = useCallback((id: number) => {
    const anim = getValue(id);
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1, friction: 5, tension: 40, useNativeDriver: true,
    }).start();
  }, [getValue]);

  const getTransform = useCallback((id: number) => {
    const anim = getValue(id);
    return [{
      translateX: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 40, 0] }),
    }];
  }, [getValue]);

  return { triggerSlide, getTransform };
}

// ---- useShatterManager ----
export function useShatterManager() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const fragDataRef = useRef<Array<{
    x: number; y: number; w: number; h: number;
    color: string;
    dx: Animated.Value; dy: Animated.Value;
    rot: Animated.Value; opacity: Animated.Value;
  }>>([]);

  const triggerShatter = useCallback((id: number, onComplete: () => void) => {
    setActiveId(id);
    const frags: typeof fragDataRef.current = [];

    for (let i = 0; i < 8; i++) {
      frags.push({
        x: (i % 4) * 0.24, y: Math.floor(i / 4) * 0.45,
        w: 0.2, h: 0.15,
        color: CARD_COLORS[i % CARD_COLORS.length],
        dx: new Animated.Value(0),
        dy: new Animated.Value(0),
        rot: new Animated.Value(0),
        opacity: new Animated.Value(1),
      });
    }

    fragDataRef.current = frags;

    const animations = frags.map((f, i) => {
      const delay = i * 50;
      const toX = (i % 2 === 0 ? -1 : 1) * (60 + Math.random() * 100);
      const toY = 100 + i * 30 + Math.random() * 100;
      const toRot = (i % 2 === 0 ? -1 : 1) * (1 + Math.random() * 3);

      return Animated.parallel([
        Animated.sequence([Animated.delay(delay), Animated.timing(f.dx, { toValue: toX, duration: 350, useNativeDriver: true })]),
        Animated.sequence([Animated.delay(delay), Animated.timing(f.dy, { toValue: toY, duration: 350, useNativeDriver: true })]),
        Animated.sequence([Animated.delay(delay), Animated.timing(f.rot, { toValue: toRot, duration: 350, useNativeDriver: true })]),
        Animated.sequence([Animated.delay(delay + 250), Animated.timing(f.opacity, { toValue: 0, duration: 150, useNativeDriver: true })]),
      ]);
    });

    Animated.parallel(animations).start(() => {
      setActiveId(null);
      fragDataRef.current = [];
      onComplete();
    });
  }, []);

  return { activeId, fragDataRef, triggerShatter };
}

// ---- triggerAfterRender ----
export function triggerAfterRender(callback: () => void) {
  InteractionManager.runAfterInteractions(() => {
    requestAnimationFrame(() => callback());
  });
}
