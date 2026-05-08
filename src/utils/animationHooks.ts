import { useRef, useState, useCallback } from 'react';
import { Animated, Easing } from 'react-native';

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
    Animated.sequence([
      Animated.timing(anim, { toValue: 35, duration: 200, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [getValue]);

  const getTransform = useCallback((id: number) => {
    const anim = getValue(id);
    return [{ translateX: anim }];
  }, [getValue]);

  return { triggerSlide, getTransform };
}

// ---- useShatterManager ----
export const STRIP_COUNT = 8;
const DURATION = 700;
const EASE = Easing.bezier(0.32, 0, 0.67, 0.95);

export interface StripData {
  left: number; width: number; offsetPx: number;
  dy: Animated.Value; dx: Animated.Value;
  rot: Animated.Value; opacity: Animated.Value;
  driftX: number; rotate: number; fallDist: number;
  delay: number;
}

export function useShatterManager() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const stripsRef = useRef<StripData[]>([]);

  const triggerShatter = useCallback((id: number, cardHeight: number, onComplete: () => void) => {
    setActiveId(id);
    const strips: StripData[] = [];
    const widthPct = 100 / STRIP_COUNT;

    for (let i = 0; i < STRIP_COUNT; i++) {
      strips.push({
        left: i * widthPct,
        width: widthPct,
        offsetPx: i * widthPct,
        dx: new Animated.Value(0),
        dy: new Animated.Value(0),
        rot: new Animated.Value(0),
        opacity: new Animated.Value(1),
        driftX: (Math.random() - 0.5) * 25,
        rotate: (Math.random() - 0.5) * 30,
        fallDist: cardHeight * (0.6 + Math.random() * 0.7),
        delay: Math.random() * 80 + i * 20,
      });
    }

    stripsRef.current = strips;

    strips.forEach((strip) => {
      setTimeout(() => {
        Animated.timing(strip.dy, { toValue: strip.fallDist, duration: DURATION, easing: EASE, useNativeDriver: false }).start();
        Animated.timing(strip.dx, { toValue: strip.driftX, duration: DURATION, easing: EASE, useNativeDriver: false }).start();
        Animated.timing(strip.rot, { toValue: strip.rotate, duration: DURATION, easing: EASE, useNativeDriver: false }).start();
        Animated.timing(strip.opacity, { toValue: 0, duration: DURATION, easing: EASE, useNativeDriver: false }).start();
      }, strip.delay);
    });

    // Cleanup after all strips finish
    const maxDelay = Math.max(...strips.map((s) => s.delay));
    setTimeout(() => {
      setActiveId(null);
      stripsRef.current = [];
      onComplete();
    }, maxDelay + DURATION + 100);
  }, []);

  return { activeId, stripsRef, triggerShatter };
}
