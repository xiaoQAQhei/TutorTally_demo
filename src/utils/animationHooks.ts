import { useRef, useState, useCallback } from 'react';
import { Animated, InteractionManager } from 'react-native';

// Card-primary palette for shatter fragments
const CARD_COLORS = ['#6366F1', '#818CF8', '#4F46E5', '#A5B4FC', '#6366F1', '#7C3AED'];

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
    Animated.timing(anim, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start();
  }, [getValue]);

  const getTransform = useCallback((id: number) => {
    const anim = getValue(id);
    return [{
      translateX: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 40, 0] }),
    }];
  }, [getValue]);

  const remove = useCallback((id: number) => { values.delete(id); }, []);

  return { triggerSlide, getTransform, remove };
}

// ---- useShatterManager ----
export function useShatterManager() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const fragDataRef = useRef<Array<{
    x: number; y: number; w: number; h: number;
    color: string; delay: number;
    dx: Animated.Value; dy: Animated.Value;
    rot: Animated.Value; opacity: Animated.Value;
  }>>([]);

  const triggerShatter = useCallback((id: number, onComplete: () => void) => {
    setActiveId(id);
    const frags: typeof fragDataRef.current = [];

    for (let i = 0; i < 12; i++) {
      const dx = new Animated.Value(0);
      const dy = new Animated.Value(0);
      const rot = new Animated.Value(0);
      const opacity = new Animated.Value(1);
      const delay = i * 35 + Math.random() * 30;

      frags.push({
        x: (i % 4) * 0.24 + Math.random() * 0.04,
        y: Math.floor(i / 4) * 0.30 + Math.random() * 0.03,
        w: 0.14 + Math.random() * 0.20,
        h: 0.06 + Math.random() * 0.16,
        color: CARD_COLORS[i % CARD_COLORS.length],
        delay, dx, dy, rot, opacity,
      });
    }

    fragDataRef.current = frags;

    // Launch staggered animations
    const animations = frags.map(f => {
      return Animated.parallel([
        Animated.sequence([
          Animated.delay(f.delay),
          Animated.timing(f.dx, { toValue: (Math.random() - 0.5) * 180, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(f.delay),
          Animated.timing(f.dy, { toValue: 80 + Math.random() * 220, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(f.delay),
          Animated.timing(f.rot, { toValue: (Math.random() - 0.5) * 2, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(f.delay + 300),
          Animated.timing(f.opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]),
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

// Wait for next frame after interactions settle
export function triggerAfterRender(callback: () => void) {
  InteractionManager.runAfterInteractions(() => {
    requestAnimationFrame(() => callback());
  });
}
