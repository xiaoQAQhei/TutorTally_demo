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
import { STRIP_COUNT, DURATION } from '../utils/animationHooks';

interface ShredderStripProps {
  index: number;
  cardWidth: number;
  cardHeight: number;
  fallDist: number;
  driftX: number;
  rotateDeg: number;
  delay: number;
  onDone: () => void;
  children: React.ReactNode;
}

export function ShredderStrip({
  index, cardWidth, cardHeight, fallDist, driftX, rotateDeg, delay, onDone, children,
}: ShredderStripProps) {
  const progress = useSharedValue(0);
  const stripW = cardWidth / STRIP_COUNT;

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: DURATION,
        easing: Easing.bezier(0.32, 0, 0.67, 0.95),
      }, (finished) => {
        if (finished) {
          runOnJS(onDone)();
        }
      })
    );
  }, []);

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
