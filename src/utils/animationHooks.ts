/**
 * ── animationHooks.ts ──────────────────────────────────────────────────────
 * 动画工具 Hooks 模块：提供课程卡片交互所需的动画逻辑。
 * 当前仅保留碎裂消散（useShatterManager），取消动画和滑动动画已迁移至
 * 消费者（LessonScreen）自行使用 react-native-reanimated 管理。
 * ────────────────────────────────────────────────────────────────────────────
 */
import { useRef, useState, useCallback } from 'react';
import { STRIP_COUNT, DURATION } from './stripConstants';

// ── useShatterManager ──────────────────────────────────────────────────────
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
