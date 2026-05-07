export interface Student {
  id: number;
  name: string;
  phone: string;
  address?: string;
  defaultLocation?: string;
  color?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  _uuid?: string;
}

export interface StudentSubject {
  id: number;
  studentId: number;
  subject: string;
  hourlyRate: number;
  color?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  _uuid?: string;
}

export interface RateHistory {
  id: number;
  studentSubjectId: number;
  oldRate: number;
  newRate: number;
  changedAt: string;
}

export type LessonStatus = 'scheduled' | 'completed' | 'pendingPayment' | 'paid' | 'cancelled';

export interface Lesson {
  id: number;
  studentId: number;
  studentSubjectId?: number;
  date: string;
  timeSlot: string;
  duration: number;
  amount: number;
  manualAmount?: number;
  status: LessonStatus;
  confirmedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  _uuid?: string;
}

export interface Payment {
  id: number;
  lessonId: number;
  amount: number;
  method: string;
  paidAt: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  _uuid?: string;
}

export interface RecurringRule {
  id: number;
  studentId: number;
  studentSubjectId?: number;
  weekdays: string;
  interval: number;
  timeSlot: string;
  duration: number;
  amount?: number;
  startDate: string;
  endDate?: string;
  excludedDates: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  _uuid?: string;
}

export interface StudentStats {
  student: Student;
  subjects: StudentSubject[];
  totalLessons: number;
  totalHours: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
}
