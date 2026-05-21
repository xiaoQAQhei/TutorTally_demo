/**
 * ── animations.ts ───────────────────────────────────────────────────────────
 * 通用动画 Hooks 模块：为 UI 组件提供可复用的 Reanimated 动画逻辑。
 * 包含：淡入（useFadeIn）、滑入（useSlideUp）、缩放（useScale）、
 * 脉冲（usePulse）、弹跳（useBounce）五个 Hook。
 * ────────────────────────────────────────────────────────────────────────────
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  cancelAnimation,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

/**
 * 淡入动画 Hook：元素从透明 + 下方滑入到完全不透明 + 原位。
 * @param duration - 动画时长（毫秒，默认 400）
 * @param delay - 延迟启动时间（毫秒，默认 0）
 * @param slideDistance - 起始偏移距离（px，默认 20）
 */
export function useFadeIn(duration = 400, delay = 0, slideDistance = 20) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(slideDistance);

  useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withTiming(1, { duration });
      translateY.value = withTiming(0, { duration });
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
  const translateY = useSharedValue(distance);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      translateY.value = withTiming(0, { duration });
      opacity.value = withTiming(1, { duration });
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
  const scale = useSharedValue(1);

  const scaleDown = () => {
    scale.value = withSpring(0.95, { dampingRatio: 0.5 });
  };

  const scaleUp = () => {
    scale.value = withSpring(1, { dampingRatio: 0.5 });
  };

  return { scale, scaleDown, scaleUp };
}

/**
 * 脉冲动画 Hook：元素在 1x ~ 1.08x 之间循环缩放，产生呼吸效果。
 * @param duration - 单次完整脉冲周期（毫秒，默认 2000）
 */
export function usePulse(duration = 2000) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: duration / 2 }),
        withTiming(1, { duration: duration / 2 }),
      ),
      -1, // 无限循环
    );
    return () => {
      cancelAnimation(pulse); // 组件卸载时停止循环动画
    };
  }, []);

  return { pulse };
}

/**
 * 弹跳动画 Hook：点击时先缩小再弹回原尺寸，同时触发可选回调。
 * @param onPress - 弹跳结束后执行的回调
 */
export function useBounce(onPress?: () => void) {
  const scale = useSharedValue(1);

  const bounce = () => {
    scale.value = withSequence(
      withSpring(0.9, { dampingRatio: 0.5 }),
      withSpring(1, { dampingRatio: 0.5 }),
    );
    onPress?.();
  };

  return { scale, bounce };
}

/**
 * 批量操作按钮的入场/退场动画 Hook。
 * 入场：下拉淡入（useNativeDriver=true）；退场：上浮缩小+淡出（useNativeDriver=false）。
 * 首次出现时不重复动画，数据刷新保持可见。
 * @param delayMs - 满足条件后延迟显示的时间（毫秒），默认 0
 */
export function useBatchAnim(delayMs = 0) {
  const anim = useSharedValue(0);          // opacity
  const height = useSharedValue(0);         // scaleY (0→1)
  const hasAnimated = useRef(false);        // 入场动画是否播放过
  const [visible, setVisible] = useState(false); // 是否在 DOM 中
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // visible 变为 true 后触发入场动画（确保组件已渲染再启动）
  useEffect(() => {
    if (visible && !hasAnimated.current) {
      hasAnimated.current = true;
      anim.value = 0;
      height.value = 0;
      // height 改为 0→1 驱动 scaleY（原生驱动兼容），透明度同步展开
      anim.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
      height.value = withTiming(1, { duration: 2000, easing: Easing.out(Easing.cubic) });
    }
  }, [visible]);

  /** 下拉淡入入场（只在满足条件时设 visible=true，动画由 useEffect 触发） */
  const enter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const doEnter = () => setVisible(true);
    if (delayMs > 0) {
      timerRef.current = setTimeout(doEnter, delayMs);
    } else {
      doEnter();
    }
  }, [delayMs]);

  // 组件卸载时清除延迟定时器
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  /** 淡出退场，返回 Promise */
  const exit = useCallback((): Promise<void> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    hasAnimated.current = false;
    return new Promise((resolve) => {
      // 用 runOnJS 在动画完成回调中切换 JS 线程状态
      anim.value = withTiming(0, { duration: 200 }, (finished) => {
        runOnJS(setVisible)(false);
        runOnJS(resolve)();
      });
      height.value = withTiming(0, { duration: 200 });
    });
  }, []);

  /** 取消延迟定时器（切 tab 时用） */
  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // translateY 由 anim 派生：0→1 映射到 -20→0
  const translateY = useDerivedValue(() =>
    interpolate(anim.value, [0, 1], [-20, 0])
  );

  return { anim, height, translateY, opacity: anim, visible, enter, exit, cancel, hasAnimated };
}
