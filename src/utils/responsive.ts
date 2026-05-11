import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 基于标准设计稿的尺寸（一般按 iPhone X/11/12 等 375x812 算）
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/**
 * 获取屏幕宽度的百分比尺寸 (类似 CSS 的 vw)
 * @param percent 百分比数值 (0-100)
 */
export const vw = (percent: number) => {
  return (SCREEN_WIDTH * percent) / 100;
};

/**
 * 获取屏幕高度的百分比尺寸 (类似 CSS 的 vh)
 * @param percent 百分比数值 (0-100)
 */
export const vh = (percent: number) => {
  return (SCREEN_HEIGHT * percent) / 100;
};

/**
 * 根据屏幕宽度进行比例缩放
 * 适用于：宽、高、间距(margin/padding)
 * @param size 设计稿上的像素值
 */
export const scale = (size: number) => {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

/**
 * 根据屏幕高度进行比例缩放
 * @param size 设计稿上的像素值
 */
export const verticalScale = (size: number) => {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

/**
 * 缓和缩放：在平板或大屏上不会缩放得过大
 * @param size 设计稿上的像素值
 * @param factor 缩放因子 (默认 0.5)
 */
export const moderateScale = (size: number, factor = 0.5) => {
  return size + (scale(size) - size) * factor;
};

/**
 * 字体缩放 (类似 CSS 的 rem/em，结合了 PixelRatio 以保证文字清晰)
 * 适用于：fontSize, lineHeight
 * @param size 设计稿上的像素值
 */
export const rem = (size: number) => {
  const newSize = scale(size);
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
  }
};

/**
 * 判断当前设备是否为平板尺寸
 */
export const isTablet = () => {
  return SCREEN_WIDTH >= 768;
};

/**
 * 获取内容区域的最大宽度限制
 * 在大屏幕（平板、Web）上防止内容被无限拉长
 */
export const MAX_CONTENT_WIDTH = isTablet() ? 600 : SCREEN_WIDTH;
