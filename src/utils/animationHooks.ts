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

  const triggerShatter = useCallback((id: number, cardWidth: number, cardHeight: number, onComplete: () => void) => {
    console.log('[DEBUG triggerShatter] cardWidth:', cardWidth, 'cardHeight:', cardHeight);
    setActiveId(id);
    const strips: StripData[] = [];
    const widthPct = 100 / STRIP_COUNT;

    for (let i = 0; i < STRIP_COUNT; i++) {
      const offsetPx = i * widthPct;
      console.log(`[DEBUG strip ${i}]:`, {
        leftPercent: i * widthPct,
        widthPercent: widthPct,
        offsetPx,
        actualLeftPx: cardWidth * (i * widthPct) / 100,
        actualWidthPx: cardWidth * widthPct / 100,
      });
      strips.push({
        left: i * widthPct,
        width: widthPct,
        offsetPx,
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

    const animations = strips.map((strip) => {
      const midFallDist = strip.fallDist * 0.6;
      const midDriftX = strip.driftX * 0.5;
      const midRotate = strip.rotate * 0.5;
      const midDuration = DURATION * 0.55;
      const finalDuration = DURATION * 0.45;

      return Animated.sequence([
        Animated.delay(strip.delay),
        Animated.sequence([
          Animated.parallel([
            Animated.timing(strip.dy, { toValue: midFallDist, duration: midDuration, easing: EASE, useNativeDriver: false }),
            Animated.timing(strip.dx, { toValue: midDriftX, duration: midDuration, easing: EASE, useNativeDriver: false }),
            Animated.timing(strip.rot, { toValue: midRotate, duration: midDuration, easing: EASE, useNativeDriver: false }),
            Animated.timing(strip.opacity, { toValue: 0.85, duration: midDuration, easing: EASE, useNativeDriver: false }),
          ]),
          Animated.parallel([
            Animated.timing(strip.dy, { toValue: strip.fallDist, duration: finalDuration, easing: EASE, useNativeDriver: false }),
            Animated.timing(strip.dx, { toValue: strip.driftX, duration: finalDuration, easing: EASE, useNativeDriver: false }),
            Animated.timing(strip.rot, { toValue: strip.rotate, duration: finalDuration, easing: EASE, useNativeDriver: false }),
            Animated.timing(strip.opacity, { toValue: 0, duration: finalDuration, easing: EASE, useNativeDriver: false }),
          ]),
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
