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

export const SubjectColors: Record<string, string> = {
  '数学': Colors.subjectMath,
  '英语': Colors.subjectEnglish,
  '物理': Colors.subjectPhysics,
  '语文': Colors.subjectChinese,
};

export const StatusColors = {
  paid: { bg: Colors.paidBg, text: Colors.paid, label: '已收款' },
  unpaid: { bg: Colors.pendingBg, text: Colors.pending, label: '待收款' },
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
  return SubjectColors[subject] || Colors.primary;
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const FontSize = {
  h1: 28,
  h2: 22,
  h3: 18,
  body: 15,
  caption: 13,
  small: 11,
  amount: 20,
} as const;

export const FontWeight = {
  bold: '700' as const,
  semiBold: '600' as const,
  medium: '500' as const,
  regular: '400' as const,
};

export const BorderRadius = {
  card: 16,
  smallCard: 12,
  button: 12,
  pill: 24,
  iconContainer: 14,
  full: 9999,
} as const;

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
} as const;
