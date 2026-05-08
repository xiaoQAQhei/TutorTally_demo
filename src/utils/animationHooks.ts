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
export const DURATION = 700;

export interface ShatterStripConfig {
  index: number;
  fallDist: number;
  driftX: number;
  rotateDeg: number;
  delay: number;
}

export function useShatterManager() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [stripsData, setStripsData] = useState<ShatterStripConfig[]>([]);
  const onCompleteRef = useRef<(() => void) | null>(null);
  const doneCountRef = useRef(0);

  const triggerShatter = useCallback((id: number, cardHeight: number, onComplete: () => void) => {
    onCompleteRef.current = onComplete;
    doneCountRef.current = 0;
    const strips: ShatterStripConfig[] = [];
    for (let i = 0; i < STRIP_COUNT; i++) {
      strips.push({
        index: i,
        fallDist: cardHeight * (0.6 + Math.random() * 0.7),
        driftX: (Math.random() - 0.5) * 25,
        rotateDeg: (Math.random() - 0.5) * 30,
        delay: Math.random() * 80 + i * 20,
      });
    }
    setStripsData(strips);
    setActiveId(id);
  }, []);

  const onStripDone = useCallback(() => {
    doneCountRef.current++;
    if (doneCountRef.current >= STRIP_COUNT) {
      setActiveId(null);
      setStripsData([]);
      onCompleteRef.current?.();
    }
  }, []);

  return { activeId, stripsData, triggerShatter, onStripDone };
}
