import { useRef, useState, useCallback } from 'react';
import { Animated } from 'react-native';

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
const STRIP_COUNT = 8;

export interface StripData {
  left: number; width: number;
  dy: Animated.Value; dx: Animated.Value;
  rot: Animated.Value; opacity: Animated.Value;
  driftX: number; rotate: number; fallDist: number;
}

export function useShatterManager() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const stripsRef = useRef<StripData[]>([]);

  const triggerShatter = useCallback((id: number, onComplete: () => void) => {
    setActiveId(id);
    const strips: StripData[] = [];
    const widthPct = 100 / STRIP_COUNT;

    for (let i = 0; i < STRIP_COUNT; i++) {
      strips.push({
        left: i * widthPct,
        width: widthPct,
        dx: new Animated.Value(0),
        dy: new Animated.Value(0),
        rot: new Animated.Value(0),
        opacity: new Animated.Value(1),
        driftX: (Math.random() - 0.5) * 50,
        rotate: (Math.random() - 0.5) * 30,
        fallDist: 200 + Math.random() * 200,
      });
    }

    stripsRef.current = strips;

    const animations = strips.map((strip, i) => {
      const delay = Math.random() * 60 + i * 18;
      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(strip.dy, { toValue: strip.fallDist, duration: 650, useNativeDriver: false }),
          Animated.timing(strip.dx, { toValue: strip.driftX, duration: 650, useNativeDriver: false }),
          Animated.timing(strip.rot, { toValue: strip.rotate, duration: 650, useNativeDriver: false }),
          Animated.timing(strip.opacity, { toValue: 0, duration: 650, useNativeDriver: false }),
        ]),
      ]);
    });

    Animated.parallel(animations).start(() => {
      setActiveId(null);
      stripsRef.current = [];
      onComplete();
    });
  }, []);

  return { activeId, stripsRef, triggerShatter };
}
