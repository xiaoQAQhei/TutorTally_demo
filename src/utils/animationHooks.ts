import { useRef, useState, useCallback } from 'react';
import { Animated, Easing, InteractionManager } from 'react-native';

// Paper-toned palette — fragments look like torn receipt paper
const PAPER_SHADES = ['#6366F1', '#818CF8', '#A5B4FC', '#C7D2FE', '#4F46E5', '#7C3AED', '#8B5CF6', '#A78BFA', '#6366F1', '#818CF8', '#9384FB', '#C4B5FD'];

// ---- useSlideManager ----
// "Paper slip" animation — card slides right with natural deceleration, slight rotation and lift
export function useSlideManager() {
  const values = useRef<Map<number, Animated.Value>>(new Map()).current;
  const scaleValues = useRef<Map<number, Animated.Value>>(new Map()).current;

  const getValue = useCallback((id: number) => {
    if (!values.has(id)) values.set(id, new Animated.Value(0));
    return values.get(id)!;
  }, []);

  const getScaleValue = useCallback((id: number) => {
    if (!scaleValues.has(id)) scaleValues.set(id, new Animated.Value(1));
    return scaleValues.get(id)!;
  }, []);

  const triggerSlide = useCallback((id: number) => {
    const anim = getValue(id);
    const scaleAnim = getScaleValue(id);
    anim.setValue(0);
    scaleAnim.setValue(1);

    // Scale pulse: slight lift at peak of slide
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.03, duration: 150, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 30, useNativeDriver: true }),
    ]).start();

    // Slide: spring-driven translateX with bounce-back
    Animated.spring(anim, {
      toValue: 1,
      friction: 5,
      tension: 35,
      useNativeDriver: true,
    }).start();
  }, [getValue, getScaleValue]);

  const getTransform = useCallback((id: number) => {
    const anim = getValue(id);
    const scaleAnim = getScaleValue(id);
    return [
      { translateX: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 35, 0] }) },
      { rotate: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: ['0deg', '3deg', '0deg'] }) },
      { scale: scaleAnim },
    ];
  }, [getValue, getScaleValue]);

  const remove = useCallback((id: number) => { values.delete(id); scaleValues.delete(id); }, []);

  return { triggerSlide, getTransform, remove };
}

// ---- useShatterManager ----
// "Torn paper" animation — card crumples, then fragments flutter down like torn receipt pieces
export function useShatterManager() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const cardScaleRef = useRef(new Animated.Value(1));
  const cardOpacityRef = useRef(new Animated.Value(1));
  const fragDataRef = useRef<Array<{
    x: number; y: number; w: number; h: number;
    color: string; delay: number; duration: number;
    dx: Animated.Value; dy: Animated.Value;
    rot: Animated.Value; opacity: Animated.Value;
  }>>([]);

  const cardScale = cardScaleRef.current;
  const cardOpacity = cardOpacityRef.current;

  const triggerShatter = useCallback((id: number, onComplete: () => void) => {
    setActiveId(id);
    const frags: typeof fragDataRef.current = [];
    cardScale.setValue(1);
    cardOpacity.setValue(1);

    // Phase 1: Card crumple (scale down + opacity drop)
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 0.92, friction: 8, tension: 100, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0.3, duration: 150, useNativeDriver: true }),
    ]).start();

    // Phase 2: Fragments launch after crumple delay
    for (let i = 0; i < 12; i++) {
      const dx = new Animated.Value(0);
      const dy = new Animated.Value(0);
      const rot = new Animated.Value(0);
      const opacity = new Animated.Value(1);
      // Stagger: top-to-bottom wave (fragments higher on card launch first)
      const baseDelay = Math.floor(i / 4) * 30 + (i % 4) * 15 + 120;
      const duration = 350 + Math.random() * 150;

      frags.push({
        x: (i % 4) * 0.24 + Math.random() * 0.04,
        y: Math.floor(i / 4) * 0.30 + Math.random() * 0.03,
        w: 0.12 + Math.random() * 0.22,
        h: 0.05 + Math.random() * 0.18,
        color: PAPER_SHADES[i],
        delay: baseDelay,
        duration,
        dx, dy, rot, opacity,
      });
    }

    fragDataRef.current = frags;

    // Each fragment: spread horizontally + fall with gravity-like easing + spin + fade
    const animations = frags.map(f => {
      const spreadX = (Math.random() - 0.5) * 200;
      const fallY = 120 + Math.random() * 250;
      const spinRad = (Math.random() - 0.5) * 5;

      return Animated.parallel([
        Animated.sequence([
          Animated.delay(f.delay),
          Animated.timing(f.dx, {
            toValue: spreadX,
            duration: f.duration,
            easing: Easing.out(Easing.back(1.2)),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(f.delay),
          Animated.timing(f.dy, {
            toValue: fallY,
            duration: f.duration,
            easing: Easing.in(Easing.cubic), // gravity-like acceleration
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(f.delay),
          Animated.timing(f.rot, {
            toValue: spinRad,
            duration: f.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(f.delay + f.duration * 0.6),
          Animated.timing(f.opacity, {
            toValue: 0,
            duration: f.duration * 0.4,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    Animated.parallel(animations).start(() => {
      setActiveId(null);
      fragDataRef.current = [];
      onComplete();
    });
  }, []);

  return { activeId, fragDataRef, triggerShatter, cardScale, cardOpacity };
}

// Wait for next frame after interactions settle
export function triggerAfterRender(callback: () => void) {
  InteractionManager.runAfterInteractions(() => {
    requestAnimationFrame(() => callback());
  });
}
