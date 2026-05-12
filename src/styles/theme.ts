import { scale, rem, moderateScale } from '../utils/responsive';

export const Colors = {
  // Functional colors
  paid: '#10B981',
  paidLight: '#ECFDF5',
  paidBg: '#D1FAE5',
  pending: '#F59E0B',
  pendingLight: '#FFFBEB',
  pendingBg: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  dangerBg: '#FEE2E2',

  // Primary accent
  primary: '#6366F1',
  primaryLight: '#EEF2FF',
  primaryDark: '#4F46E5',

  // Neutrals
  background: '#F8FAFC',
  card: '#FFFFFF',
  title: '#1A1A2E',
  body: '#4A4A6A',
  caption: '#9A9AB0',
  divider: '#F1F5F9',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(15, 23, 42, 0.5)',

  // Subject colors
  subjectMath: '#6366F1',
  subjectEnglish: '#EC4899',
  subjectPhysics: '#F59E0B',
  subjectChinese: '#10B981',
} as const;

export const SubjectColorPalette = [
  '#5B8DEF', '#FF8C6B', '#FF9500', '#4ECDC4',
  '#34C759', '#FF3B6E', '#AF52DE', '#8E8E93',
];

export const DefaultSubjectColors: Record<string, string> = {
  '数学': '#5B8DEF', '英语': '#FF8C6B', '物理': '#FF9500',
  '化学': '#4ECDC4', '生物': '#34C759', '语文': '#FF3B6E',
  '历史': '#AF52DE',
};

export const LessonStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: '#EEF2FF', text: '#6366F1', label: '待上课' },
  completed: { bg: '#FEE2E2', text: '#EF4444', label: '确认下课' },
  pendingPayment: { bg: '#FFFBEB', text: '#F59E0B', label: '待收款' },
  paid: { bg: '#ECFDF5', text: '#10B981', label: '已收款' },
  cancelled: { bg: '#F3F4F6', text: '#8E8E93', label: '已取消' },
} as const;

export const StudentEmojis = ['🎓', '👧', '👦', '👩‍🎓', '🧑‍🎓', '👨‍🎓', '👩', '👨'];

export function getStudentEmoji(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return StudentEmojis[Math.abs(hash) % StudentEmojis.length];
}

export function getSubjectColor(subject: string): string {
  return DefaultSubjectColors[subject] || SubjectColorPalette[0];
}

// ── Spacing（手机基线，StyleSheet 直接用） ──────────────────
export const Spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(12),
  lg: scale(16),
  xl: scale(20),
  xxl: scale(24),
  xxxl: scale(32),
};

// ── 平板间距（responsive.ts 根据断点选择，当前与手机一致） ──
export const TabletSpacing = {
  xs: scale(-1),
  sm: scale(3),
  md: scale(7),
  lg: scale(11),
  xl: scale(15),
  xxl: scale(19),
  xxxl: scale(27),
};

// ── 字号（手机基线） ──────────────────────────────────────
export const FontSize = {
  h1: rem(28),
  h2: rem(22),
  h3: rem(18),
  body: rem(15),
  caption: rem(13),
  small: rem(11),
  amount: rem(20),
};

// ── 平板字号（当前与手机一致） ────────────────────────────
export const TabletFontSize = {
  h1: rem(23),
  h2: rem(17),
  h3: rem(13),
  body: rem(10),
  caption: rem(8),
  small: rem(8),
  amount: rem(15),
};

// ── 图标尺寸（手机基线） ────────────────────────────────
export const IconSize = {
  xs: 14, sm: 16, md: 18, lg: 20, xl: 25, xxl: 28,
  container: { sm: 32, md: 42, lg: 56 },
  avatar: { sm: 28, md: 40, lg: 48 },
};

// ── 平板图标尺寸（当前与手机一致） ──────────────────────────
export const TabletIconSize = {
  xs: 34, sm: 36, md: 38, lg: 40, xl: 45, xxl: 48,
  container: { sm: 52, md: 62, lg: 76 },
  avatar: { sm: 32, md: 44, lg: 52 },
};

export const FontWeight = {
  bold: '700' as const,
  semiBold: '600' as const,
  medium: '500' as const,
  regular: '400' as const,
};

export const BorderRadius = {
  card: moderateScale(16),
  smallCard: moderateScale(12),
  button: moderateScale(12),
  pill: moderateScale(24),
  iconContainer: moderateScale(14),
  full: 9999,
};

export const Shadows = {
  subtle: {
    shadowColor: Colors.title,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  standard: {
    shadowColor: Colors.title,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  floating: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  topBar: {
    shadowColor: Colors.title,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const StatusTransitions: Record<string, string[]> = {
  scheduled: ['completed', 'cancelled'],
  completed: ['pendingPayment'],
  pendingPayment: ['paid'],
  paid: [],
  cancelled: [],
};
