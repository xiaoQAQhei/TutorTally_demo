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
}

function buildSpacing(bp: Breakpoint, winWidth: number): ResponsiveSpacing {
  const s = (size: number) => (winWidth / BASE_WIDTH) * size;
  if (bp === 'lg') {
    return {
      xs: s(6), sm: s(12), md: s(16), lg: s(20),
      xl: s(28), xxl: s(32), xxxl: s(40),
    };
  }
  return {
    xs: s(4), sm: s(8), md: s(12), lg: s(16),
    xl: s(20), xxl: s(24), xxxl: s(32),
  };
}

function buildFontSize(bp: Breakpoint, winWidth: number): ResponsiveFontSize {
  const r = (size: number) => {
    const ns = (winWidth / BASE_WIDTH) * size;
    if (Platform.OS === 'ios') return Math.round(PixelRatio.roundToNearestPixel(ns));
    return Math.round(PixelRatio.roundToNearestPixel(ns)) - 1;
  };
  if (bp === 'lg') {
    return {
      h1: r(32), h2: r(26), h3: r(20),
      body: r(17), caption: r(14), small: r(12), amount: r(24),
    };
  }
  return {
    h1: r(28), h2: r(22), h3: r(18),
    body: r(15), caption: r(13), small: r(11), amount: r(20),
  };
}

let _responsiveCache: ResponsiveInfo | null = null;
let _listeners = new Set<() => void>();

function buildResponsiveInfo(win: ScaledSize): ResponsiveInfo {
  const bp = calcBreakpoint(win.width);
  const isTabletDevice = win.width >= BP_MD_MAX;
  return {
    width: win.width,
    height: win.height,
    bp,
    isTablet: isTabletDevice,
    isSmallPhone: win.width < BP_SM_MAX,
    // Dynamic maxContentWidth: 75% of screen on tablet landscape, 600 on tablet portrait
    maxContentWidth: isTabletDevice
      ? Math.round(Math.min(win.width * 0.75, 800))
      : win.width,
    fontScale: win.fontScale ?? PixelRatio.getFontScale(),
    orientation: win.width > win.height ? 'landscape' : 'portrait',
    contentPaddingH:
      bp === 'sm' ? 12 :
      bp === 'md' ? 16 :
      20,
    spacing: buildSpacing(bp, win.width),
    fontSize: buildFontSize(bp, win.width),
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
  // Update the static MAX_CONTENT_WIDTH constant
  const isTabletDevice = _window.width >= BP_MD_MAX;
  (MAX_CONTENT_WIDTH as number) = isTabletDevice
    ? Math.round(Math.min(_window.width * 0.75, 800))
    : _window.width;
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
