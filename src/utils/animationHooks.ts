import { useRef, useState, useCallback } from 'react';
import { Animated } from 'react-native';

// ---- useSlideManager ----
export function useSlideManager() {
  const values = useRef<Map<number, Animated.Value>>(new Map()).current;
  const sliding = useRef<Set<number>>(new Set()).current;

  const getValue = useCallback((id: number) => {
    if (!values.has(id)) values.set(id, new Animated.Value(0));
    return values.get(id)!;
  }, []);

  const triggerSlide = useCallback((id: number) => {
    sliding.add(id);
    const anim = getValue(id);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1, duration: 350, useNativeDriver: true,
    }).start(() => { sliding.delete(id); });
  }, [getValue]);

  const isSliding = useCallback((id: number) => sliding.has(id), []);

  const getTransform = useCallback((id: number) => {
    const anim = getValue(id);
    return [{
      translateX: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 35, 0] }),
    }];
  }, [getValue]);

  return { triggerSlide, isSliding, getTransform };
}

// ---- useShatterManager ----
const FRAG_COLORS = ['#6366F1', '#818CF8', '#4F46E5', '#A5B4FC'];

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
        color: FRAG_COLORS[i],
        dx: new Animated.Value(0),
        dy: new Animated.Value(0),
        rot: new Animated.Value(0),
        opacity: new Animated.Value(1),
      });
    }

    fragDataRef.current = frags;

    const animations = frags.map((f, i) => {
      const delay = i * 50;
      return Animated.parallel([
        Animated.sequence([Animated.delay(delay), Animated.timing(f.dx, { toValue: (i % 2 === 0 ? -1 : 1) * (60 + Math.random() * 100), duration: 350, useNativeDriver: true })]),
        Animated.sequence([Animated.delay(delay), Animated.timing(f.dy, { toValue: 100 + i * 30 + Math.random() * 100, duration: 350, useNativeDriver: true })]),
        Animated.sequence([Animated.delay(delay), Animated.timing(f.rot, { toValue: (i % 2 === 0 ? -1 : 1) * (1 + Math.random() * 3), duration: 350, useNativeDriver: true })]),
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
