/**
 * ── animations.ts ───────────────────────────────────────────────────────────
 * 通用动画 Hooks 模块：为 UI 组件提供可复用的 Animated 动画逻辑。
 * 包含：淡入（useFadeIn）、滑入（useSlideUp）、缩放（useScale）、
 * 脉冲（usePulse）、弹跳（useBounce）五个 Hook。
 * ────────────────────────────────────────────────────────────────────────────
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import { Animated } from 'react-native';

/**
 * 淡入动画 Hook：元素从透明 + 下方滑入到完全不透明 + 原位。
 * @param duration - 动画时长（毫秒，默认 400）
 * @param delay - 延迟启动时间（毫秒，默认 0）
 * @param slideDistance - 起始偏移距离（px，默认 20）
 */
export function useFadeIn(duration = 400, delay = 0, slideDistance = 20) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return { opacity, translateY };
}

/**
 * 向上滑入动画 Hook：元素从下方滑入并逐渐变透明到不透明。
 * @param duration - 动画时长（毫秒，默认 400）
 * @param delay - 延迟启动时间（毫秒，默认 0）
 * @param distance - 起始偏移距离（px，默认 30）
 */
export function useSlideUp(duration = 400, delay = 0, distance = 30) {
  const translateY = useRef(new Animated.Value(distance)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return { translateY, opacity };
}

/**
 * 缩放动画 Hook：提供缩小（scaleDown）和还原（scaleUp）两个方法。
 * 常用于按钮触摸反馈。
 * @param duration - 动画时长（毫秒，默认 300）
 */
export function useScale(duration = 300) {
  const scale = useRef(new Animated.Value(1)).current;

  const scaleDown = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const scaleUp = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return { scale, scaleDown, scaleUp };
}

/**
 * 脉冲动画 Hook：元素在 1x ~ 1.08x 之间循环缩放，产生呼吸效果。
 * @param duration - 单次完整脉冲周期（毫秒，默认 2000）
 */
export function usePulse(duration = 2000) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return { pulse };
}

/**
 * 弹跳动画 Hook：点击时先缩小再弹回原尺寸，同时触发可选回调。
 * @param onPress - 弹跳结束后执行的回调
 */
export function useBounce(onPress?: () => void) {
  const scale = useRef(new Animated.Value(1)).current;

  const bounce = () => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.9,
        useNativeDriver: true,
        speed: 60,
        bounciness: 6,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 60,
        bounciness: 8,
      }),
    ]).start();
    onPress?.();
  };

  return { scale, bounce };
}

/**
 * 下拉进入动画 Hook：元素从上方滑入 + 淡入。
 * 调用 trigger() 触发动画，可用于条件渲染时让元素"掉下来"。
 * @param translateFrom - 起始偏移距离（px，默认 -20）
 * @param speed - 弹簧速度（默认 10）
 */
/**
 * 批量操作按钮的入场/退场动画 Hook。
 * 入场：下拉淡入（useNativeDriver=true）；退场：上浮缩小+淡出（useNativeDriver=false）。
 * 首次出现时不重复动画，数据刷新保持可见。
 * @param delayMs - 满足条件后延迟显示的时间（毫秒），默认 0
 */
export function useBatchAnim(delayMs = 0) {
  const anim = useRef(new Animated.Value(0)).current;
  const height = useRef(new Animated.Value(0)).current;
  const hasAnimated = useRef(false);      // 入场动画是否播放过
  const [visible, setVisible] = useState(false);  // 是否在 DOM 中
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 下拉入场（支持延迟） */
  const enter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (delayMs > 0) {
      timerRef.current = setTimeout(() => {
        setVisible(true);
        height.setValue(200);
        if (!hasAnimated.current) {
          hasAnimated.current = true;
          anim.setValue(0);
          Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 6 }).start();
        }
      }, delayMs);
    } else {
      setVisible(true);
      height.setValue(200);
      if (!hasAnimated.current) {
        hasAnimated.current = true;
        anim.setValue(0);
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 6 }).start();
      }
    }
  }, [delayMs]);

  // 组件卸载时清除延迟定时器
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  /** 上浮缩小退场，返回 Promise（立即执行，取消延迟定时器） */
  const exit = useCallback((): Promise<void> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    hasAnimated.current = false;
    return new Promise((resolve) => {
      Animated.parallel([
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(height, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start(() => { setVisible(false); resolve(); });
    });
  }, []);

  /** 取消延迟定时器（切 tab 时用） */
  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });

  return { anim, height, translateY, opacity: anim, visible, enter, exit, cancel, hasAnimated };
}
