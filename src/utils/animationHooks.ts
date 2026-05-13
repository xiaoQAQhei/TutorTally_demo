/**
 * ── animationHooks.ts ──────────────────────────────────────────────────────
 * 动画工具 Hooks 模块：提供课程卡片交互所需的动画逻辑。
 * 包含：水平滑动（useSlideManager）和碎裂消散（useShatterManager）两个 Hook。
 * ────────────────────────────────────────────────────────────────────────────
 */
import { useRef, useState, useCallback } from 'react';
import { Animated, Easing } from 'react-native';

// ── useCancelAnimation ──────────────────────────────────────────────────────
/**
 * 管理课程卡片的"取消"删除线动画。
 * 每张卡片对应一个 Animated.Value（0→1），配合卡片宽度实现删除线从左到右展开效果。
 */
export function useCancelAnimation() {
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const anims = useRef<Map<number, Animated.Value>>(new Map()).current;

  /** 获取或创建指定课程 id 的 Animated.Value */
  const getAnim = useCallback((id: number) => {
    if (!anims.has(id)) anims.set(id, new Animated.Value(0));
    return anims.get(id)!;
  }, []);

  /**
   * 触发取消动画：删除线从 0 展开到卡片宽度。
   * @param id - 课程 id
   * @param onDone - 动画完成后回调（默认 800ms 后触发）
   */
  const trigger = useCallback((id: number, onDone?: () => void) => {
    setCancellingId(id);
    const anim = getAnim(id);
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 350, useNativeDriver: false }).start(() => {
      setTimeout(() => {
        setCancellingId(null);
        onDone?.();
      }, 800);
    });
  }, [getAnim]);

  /** 如果课程已取消但不在动画中，将动画值置为 1（已展开的删除线） */
  const markCancelled = useCallback((id: number) => {
    if (cancellingId !== id) {
      getAnim(id).setValue(1);
    }
  }, [cancellingId]);

  /**
   * 获取删除线的插值样式。
   * @param id - 课程 id
   * @param cardWidth - 卡片宽度
   */
  const getLineStyle = useCallback((id: number, cardWidth: number) => ({
    width: getAnim(id).interpolate({
      inputRange: [0, 1],
      outputRange: [0, cardWidth + 20],
    }),
  }), [getAnim]);

  /**
   * 获取"已取消"标签的透明度插值样式。
   * @param id - 课程 id
   */
  const getLabelStyle = useCallback((id: number) => ({
    opacity: getAnim(id).interpolate({
      inputRange: [0.5, 1],
      outputRange: [0, 1],
    }),
  }), [getAnim]);

  return { cancellingId, trigger, markCancelled, getLineStyle, getLabelStyle };
}

// ── useSlideManager ────────────────────────────────────────────────────────
/**
 * 管理多个卡片的水平滑动动画。
 * 每个卡片通过独立 id 维护一个 Animated.Value，支持触发滑动并获取变换矩阵。
 */
export function useSlideManager() {
  // Map<卡片id, Animated.Value>，缓存在 useRef 中避免重复创建
  const values = useRef<Map<number, Animated.Value>>(new Map()).current;

  /** 获取或创建指定 id 对应的 Animated.Value */
  const getValue = useCallback((id: number) => {
    if (!values.has(id)) values.set(id, new Animated.Value(0));
    return values.get(id)!;
  }, []);

  /**
   * 触发指定卡片的滑动动画：向右滑出再滑回原位。
   * @param id - 卡片唯一标识
   */
  const triggerSlide = useCallback((id: number) => {
    const anim = getValue(id);
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: 35, duration: 200, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [getValue]);

  /** 获取指定卡片的 Animated 变换样式（translateX） */
  const getTransform = useCallback((id: number) => {
    const anim = getValue(id);
    return [{ translateX: anim }];
  }, [getValue]);

  return { triggerSlide, getTransform };
}

// ── useShatterManager ──────────────────────────────────────────────────────
/** 碎裂效果卡片条数（将卡片纵向切割为 8 条） */
export const STRIP_COUNT = 8;
/** 碎裂动画总时长（毫秒） */
export const DURATION = 700;

/** 每个碎片的配置参数 */
export interface ShatterStripConfig {
  index: number;       // 碎片索引（0 ~ STRIP_COUNT-1）
  fallDist: number;    // 下落距离（px）
  driftX: number;      // 水平偏移量（px）
  rotateDeg: number;   // 旋转角度（度）
  delay: number;       // 延迟启动时间（毫秒）
}

/**
 * 管理卡片的"碎裂消散"动画。
 * 将卡片切成多条碎片，每条独立下落、平移和旋转，最终全部消失后触发完成回调。
 */
export function useShatterManager() {
  const [activeId, setActiveId] = useState<number | null>(null);          // 当前正在碎裂的卡片 id
  const [stripsData, setStripsData] = useState<ShatterStripConfig[]>([]); // 碎片配置数组
  const onCompleteRef = useRef<(() => void) | null>(null);                // 全部碎片结束后的回调
  const doneCountRef = useRef(0);                                         // 已完成动画的碎片计数
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 兜底定时器
  const resolvedRef = useRef(false);                                      // 是否已执行完成，防止重复触发

  /** 执行完成：重置状态并调用完成回调 */
  const finish = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null; }
    setActiveId(null);
    setStripsData([]);
    onCompleteRef.current?.();
  }, []);

  /**
   * 触发指定卡片的碎裂动画。
   * @param id - 卡片 id
   * @param cardHeight - 卡片高度，用于计算碎片下落距离
   * @param onComplete - 全部碎片动画完成后的回调
   * @returns 生成的碎片配置数组，供外层渲染使用
   */
  const triggerShatter = useCallback((id: number, cardHeight: number, onComplete: () => void): ShatterStripConfig[] => {
    onCompleteRef.current = onComplete;
    doneCountRef.current = 0;
    resolvedRef.current = false;
    const strips: ShatterStripConfig[] = [];
    // 生成 STRIP_COUNT 条碎片的随机配置
    for (let i = 0; i < STRIP_COUNT; i++) {
      strips.push({
        index: i,
        fallDist: cardHeight * (0.6 + Math.random() * 0.7), // 下落距离 60%~130% 卡片高度
        driftX: (Math.random() - 0.5) * 25,                 // 水平偏移 -12.5~12.5px
        rotateDeg: (Math.random() - 0.5) * 30,              // 旋转 -15°~15°
        delay: Math.random() * 80 + i * 20,                 // 延迟：基础延迟 + 随机抖动
      });
    }
    setStripsData(strips);
    setActiveId(id);
    // Failsafe: 设置兜底定时器，超过最大时长后强制清理
    const maxDelay = Math.max(...strips.map(s => s.delay));
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(finish, maxDelay + DURATION + 300);
    return strips;
  }, [finish]);

  /** 单条碎片动画完成时调用，累计计数达到 STRIP_COUNT 后触发 finish */
  const onStripDone = useCallback(() => {
    if (resolvedRef.current) return;
    doneCountRef.current++;
    if (doneCountRef.current >= STRIP_COUNT) {
      finish();
    }
  }, [finish]);

  return { activeId, stripsData, triggerShatter, onStripDone };
}
