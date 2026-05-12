import { useState, useEffect, useMemo } from 'react';
import { Dimensions, PixelRatio, Platform, ScaledSize } from 'react-native';

// ── Breakpoint system ──────────────────────────────────────────────
export type Breakpoint = 'sm' | 'md' | 'lg';

const BP_SM_MAX = 375;   // small phone (iPhone SE, etc.)
const BP_MD_MAX = 768;   // tablet threshold

function calcBreakpoint(width: number): Breakpoint {
  if (width < BP_SM_MAX) return 'sm';
  if (width < BP_MD_MAX) return 'md';
  return 'lg';
}

// ── Base dimensions (iPhone 11/12/13 as design reference) ──────
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// ── Static getters (initial values) ─────────────────────────────────
let _window: ScaledSize = Dimensions.get('window');
let _screen: ScaledSize = Dimensions.get('screen');

export function getWindow() { return _window; }
export function getScreen() { return _screen; }

/** Scale factor based on current width relative to base */
export const scale = (size: number) => (_window.width / BASE_WIDTH) * size;

/** Scale based on height */
export const verticalScale = (size: number) => (_window.height / BASE_HEIGHT) * size;

/** Moderate scale: dampened on large screens */
export const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

/** Font size: width-scaled + pixel-rounded */
export const rem = (size: number) => {
  const newSize = scale(size);
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
};

/** % of screen width (like CSS vw) */
export const vw = (percent: number) => (_window.width * percent) / 100;

/** % of screen height (like CSS vh) */
export const vh = (percent: number) => (_window.height * percent) / 100;

/**
 * Adaptive size that blends width and height scaling.
 * On tall/narrow screens, gives weight to height to prevent
 * oversized elements from width-only scaling.
 * factor: 0 = width-only, 1 = height-only, default 0.3
 */
export function adaptSize(size: number, factor = 0.3): number {
  const ws = (_window.width / BASE_WIDTH) * size;
  const hs = (_window.height / BASE_HEIGHT) * size;
  return ws * (1 - factor) + hs * factor;
}

/** Current breakpoint (snapshot) */
export function currentBreakpoint(): Breakpoint {
  return calcBreakpoint(_window.width);
}

/** Tablet check (snapshot) */
export function isTablet(): boolean {
  return _window.width >= BP_MD_MAX;
}

/** Max content width for preventing infinite stretch on wide screens */
export function maxContentWidth(): number {
  if (_window.width < BP_MD_MAX) return _window.width;
  return Math.round(Math.min(_window.width * 0.75, 800));
}

// Keep exported constant for non-reactive usage (backward compat)
export const MAX_CONTENT_WIDTH = maxContentWidth();

// ── Reactive Hook ───────────────────────────────────────────────────

/** Breakpoint-aware spacing — larger on tablets */
export interface ResponsiveSpacing {
  xs: number; sm: number; md: number; lg: number;
  xl: number; xxl: number; xxxl: number;
}

/** Breakpoint-aware font sizes — larger on tablets */
export interface ResponsiveFontSize {
  h1: number; h2: number; h3: number;
  body: number; caption: number; small: number; amount: number;
}

/** Breakpoint-aware icon sizes — larger on tablets */
export interface ResponsiveIconSize {
  xs: number; sm: number; md: number; lg: number; xl: number; xxl: number;
  /** Icon container sizes */
  container: { sm: number; md: number; lg: number };
}

export interface ResponsiveInfo {
  width: number;
  height: number;
  bp: Breakpoint;
  isTablet: boolean;
  isSmallPhone: boolean;
  maxContentWidth: number;
  fontScale: number;
  orientation: 'portrait' | 'landscape';
  /** Safe horizontal padding for content containers */
  contentPaddingH: number;
  /** Breakpoint-aware spacing (replaces static Spacing on tablets) */
  spacing: ResponsiveSpacing;
  /** Breakpoint-aware font sizes (replaces static FontSize on tablets) */
  fontSize: ResponsiveFontSize;
  /** Breakpoint-aware icon sizes */
  iconSize: ResponsiveIconSize;
  /** width / height ratio */
  aspectRatio: number;
  /** aspectRatio < 0.52 — ultra-narrow like iPhone SE 1st gen (320x568) */
  isUltraNarrow: boolean;
  /** aspectRatio < 0.58 — narrow like iPhone 12/13 Mini */
  isNarrow: boolean;
  /** aspectRatio > 0.65 — wide like landscape tablets */
  isWide: boolean;
}

function buildSpacing(bp: Breakpoint, winWidth: number, aspectRatio: number): ResponsiveSpacing {
  const s = (size: number) => (winWidth / BASE_WIDTH) * size;
  // Narrow screens: slightly larger vertical spacing for breathing room
  // Wide screens: slightly tighter vertical spacing
  const arFactor = aspectRatio < 0.52 ? 1.12 : aspectRatio < 0.58 ? 1.06 : aspectRatio > 0.65 ? 0.92 : 1;
  if (bp === 'lg') {
    return {
      xs: s(6 * arFactor), sm: s(12 * arFactor), md: s(16 * arFactor), lg: s(15 * arFactor),
      xl: s(28 * arFactor), xxl: s(32 * arFactor), xxxl: s(40 * arFactor),
    };
  }
  return {
    xs: s(4 * arFactor), sm: s(8 * arFactor), md: s(12 * arFactor), lg: s(16 * arFactor),
    xl: s(20 * arFactor), xxl: s(24 * arFactor), xxxl: s(32 * arFactor),
  };
}

function buildFontSize(bp: Breakpoint, winWidth: number, aspectRatio: number): ResponsiveFontSize {
  const r = (size: number) => {
    const ns = (winWidth / BASE_WIDTH) * size;
    if (Platform.OS === 'ios') return Math.round(PixelRatio.roundToNearestPixel(ns));
    return Math.round(PixelRatio.roundToNearestPixel(ns)) - 1;
  };
  // Narrow screens: slightly smaller fonts; wide screens: slightly larger
  const arFactor = aspectRatio < 0.52 ? 0.90 : aspectRatio < 0.58 ? 0.95 : aspectRatio > 0.65 ? 1.08 : 1;
  if (bp === 'lg') {
    return {
      h1: r(20 * arFactor), h2: r(16 * arFactor), h3: r(12 * arFactor),
      body: r(9 * arFactor), caption: r(7 * arFactor), small: r(10 * arFactor), amount: r(12 * arFactor),
    };
  }
  return {
    h1: r(28 * arFactor), h2: r(22 * arFactor), h3: r(18 * arFactor),
    body: r(15 * arFactor), caption: r(13 * arFactor), small: r(11 * arFactor), amount: r(20 * arFactor),
  };
}

function buildIconSize(bp: Breakpoint): ResponsiveIconSize {
  if (bp === 'lg') {
    return { xs: 18, sm: 20, md: 22, lg: 26, xl: 30, xxl: 36, container: { sm: 40, md: 48, lg: 60 } };
  }
  return { xs: 14, sm: 16, md: 18, lg: 20, xl: 25, xxl: 28, container: { sm: 32, md: 42, lg: 56 } };
}

let _responsiveCache: ResponsiveInfo | null = null;
let _listeners = new Set<() => void>();

function buildResponsiveInfo(win: ScaledSize): ResponsiveInfo {
  const bp = calcBreakpoint(win.width);
  const isTabletDevice = win.width >= BP_MD_MAX;
  const aspectRatio = win.width / Math.max(win.height, 1);
  return {
    width: win.width,
    height: win.height,
    bp,
    isTablet: isTabletDevice,
    isSmallPhone: win.width < BP_SM_MAX,
    maxContentWidth: win.width,
    fontScale: win.fontScale ?? PixelRatio.getFontScale(),
    orientation: win.width > win.height ? 'landscape' : 'portrait',
    contentPaddingH:
      bp === 'sm' ? 12 :
      bp === 'md' ? 16 :
      20,
    spacing: buildSpacing(bp, win.width, aspectRatio),
    fontSize: buildFontSize(bp, win.width, aspectRatio),
    iconSize: buildIconSize(bp),
    aspectRatio,
    isUltraNarrow: aspectRatio < 0.52,
    isNarrow: aspectRatio < 0.58 && aspectRatio >= 0.52,
    isWide: aspectRatio > 0.65,
  };
}

function notifyListeners() {
  const info = buildResponsiveInfo(_window);
  _responsiveCache = info;
  _listeners.forEach((fn) => fn());
}

Dimensions.addEventListener('change', ({ window: win }) => {
  _window = win;
  _screen = Dimensions.get('screen');
  (MAX_CONTENT_WIDTH as number) = _window.width;
  notifyListeners();
});

/**
 * React hook: returns reactive ResponsiveInfo updated on dimension change.
 */
export function useResponsive(): ResponsiveInfo {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  return _responsiveCache ?? buildResponsiveInfo(_window);
}

/**
 * Returns scaling helpers bound to current dimensions (for use in render).
 * Use these instead of the module-level scale()/rem()/etc. for truly reactive sizing.
 */
export function useScaleHelpers() {
  const { width, height } = useResponsive();

  return useMemo(() => ({
    scale: (size: number) => (width / BASE_WIDTH) * size,
    verticalScale: (size: number) => (height / BASE_HEIGHT) * size,
    moderateScale: (size: number, factor = 0.5) => {
      const s = (width / BASE_WIDTH) * size;
      return size + (s - size) * factor;
    },
    rem: (size: number) => {
      const ns = (width / BASE_WIDTH) * size;
      return Platform.OS === 'ios'
        ? Math.round(PixelRatio.roundToNearestPixel(ns))
        : Math.round(PixelRatio.roundToNearestPixel(ns)) - 1;
    },
    vw: (pct: number) => (width * pct) / 100,
    vh: (pct: number) => (height * pct) / 100,
  }), [width, height]);
}

// ── Responsive value helper (breakpoint-based) ──────────────────────
/**
 * Returns a different value for each breakpoint.
 * Usage: bpValue({ sm: 12, md: 16, lg: 20 })
 */
export function bpValue<T>(values: Partial<Record<Breakpoint, T>> & { default: T }): T {
  const bp = currentBreakpoint();
  return values[bp] ?? values.default;
}
