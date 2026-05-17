import { Dimensions, PixelRatio, Platform } from 'react-native';
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;
let _window = Dimensions.get('window');
Dimensions.addEventListener('change', ({ window }) => { _window = window; });
export const scale = (size: number) => (_window.width / BASE_WIDTH) * size;
export const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;
export const rem = (size: number) => { const ns = scale(size); return Platform.OS === 'ios' ? Math.round(PixelRatio.roundToNearestPixel(ns)) : Math.round(PixelRatio.roundToNearestPixel(ns)) - 1; };
