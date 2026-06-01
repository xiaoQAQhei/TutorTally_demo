// ── 碎纸机纸条动画（ShredderStrip） ──
/**
 * 用于"删除"动画的单条纸条组件。将一张卡片分割为多条竖条，
 * 每条以不同的延迟和偏移执行下落+旋转+淡出动画。
 * 基于 react-native-reanimated 实现高性能动画。
 */

import React, { useEffect } from 'react';
import { View } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { STRIP_COUNT, DURATION } from '../utils/stripConstants';

/** ShredderStrip 组件属性 */
interface ShredderStripProps {
  index: number;               // 纸条序号（决定横向位置）
  cardWidth: number;           // 原始卡片宽度
  cardHeight: number;          // 原始卡片高度
  fallDist: number;            // 下落距离
  driftX: number;              // 水平偏移量
  rotateDeg: number;           // 旋转角度
  delay: number;               // 动画开始延迟（ms）
  onDone: () => void;          // 动画完成回调
  children: React.ReactNode;   // 卡片内容（每张纸条裁剪显示对应部分）
}

export function ShredderStrip({
  index, cardWidth, cardHeight, fallDist, driftX, rotateDeg, delay, onDone, children,
}: ShredderStripProps) {
  const progress = useSharedValue(0);
  // 每条纸条的宽度 = 卡片总宽 / 纸条数量
  const stripW = cardWidth / STRIP_COUNT;

  // ── 启动动画：延迟后执行下落 → 完成后回调 JS 线程 ──
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: DURATION,
        easing: Easing.bezier(0.32, 0, 0.67, 0.95),
      }, () => {
        // 无条件回调，防 finished=false 导致删除回调永不执行
        runOnJS(onDone)();
      })
    );
  }, []);

  // ── 动画样式：下落 + 水平漂移 + 旋转 + 淡出 ──
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, fallDist]) },
      { translateX: interpolate(progress.value, [0, 1], [0, driftX]) },
      { rotate: `${interpolate(progress.value, [0, 1], [0, rotateDeg])}deg` },
    ],
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
  }));

  return (
    <Reanimated.View
      style={[{
        position: 'absolute',
        top: 0,
        left: index * stripW,
        width: stripW,
        height: cardHeight,
        overflow: 'hidden',
        zIndex: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      }, animatedStyle]}
    >
      {/* 通过负 left 偏移显示卡片对应区域 */}
      <View style={{
        width: cardWidth,
        position: 'absolute',
        top: 0,
        left: -(index * stripW),
      }}>
        {children}
      </View>
    </Reanimated.View>
  );
}
