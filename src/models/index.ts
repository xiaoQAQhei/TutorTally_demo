export interface Student {
  id: number;
  name: string;
  subject: string;
  hourlyRate: number;
  phone: string;
  address?: string;
  createdAt: string;
}

export interface Lesson {
  id: number;
  studentId: number;
  date: string;
  duration: number;
  amount: number;
  paid: boolean;
  notes: string;
  createdAt: string;
}

export interface Payment {
  id: number;
  lessonId: number;
  amount: number;
  date: string;
  method: string;
  createdAt: string;
}

export interface StudentStats {
  student: Student;
  totalLessons: number;
  totalHours: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
}
