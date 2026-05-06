# 家教账单离线增强版 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将家教账单 React Native (Expo) 应用从 v1.0 升级到 v2.0，支持多科目、四态流转、手动金额/部分付款、Excel 导出导入、PDF 账单、周期规则、本地通知、时薪历史、科目颜色系统。

**Architecture:** 分层改造 — P0 数据层（新表结构 + migration + mock）→ P0 工具层（导出/导入/设置页）→ P1 业务流程层（多科目、四态、手动金额、PDF）→ P2 增强层（周期规则、通知、颜色、时薪历史）。每层基于上一层的数据模型，互不阻塞。

**Tech Stack:** React Native 0.72 / Expo 49 / TypeScript / expo-sqlite / react-native-gifted-charts / nanoid / expo-file-system / expo-sharing / expo-print / expo-notifications / expo-document-picker

**Files to create:** `src/utils/export.ts`, `src/utils/import.ts`, `src/utils/pdf.ts`, `src/utils/notifications.ts`, `src/screens/SettingsScreen.tsx`, `src/screens/RecurringRulesScreen.tsx`

**Files to modify:** `src/models/index.ts`, `src/database/index.ts`, `src/styles/theme.ts`, `src/App.tsx`, `src/contexts/ActionContext.tsx`, `src/screens/HomeScreen.tsx`, `src/screens/StudentScreen.tsx`, `src/screens/LessonScreen.tsx`, `src/screens/StatsScreen.tsx`, `src/screens/StudentBillingDetailScreen.tsx`, `src/components/StatusBadge.tsx`, `src/components/StudentAvatar.tsx`

---

### Task 1: 更新数据模型类型定义

**Files:**
- Modify: `src/models/index.ts` (full rewrite)

- [ ] **Step 1: Replace the entire models/index.ts**

```typescript
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

export type LessonStatus = 'scheduled' | 'completed' | 'paid' | 'cancelled';

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
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```
Expected: Zero errors (may fail due to database/index.ts referencing old types — expected, Task 2 fixes it).

- [ ] **Step 3: Commit**

```bash
git add src/models/index.ts
git commit -m "feat: v2.0 data model types — multi-subject, 4-status, payments, recurring"
```

---

### Task 2: 重写数据库层（新表 + migration + CRUD）

**Files:**
- Modify: `src/database/index.ts` (full rewrite)

- [ ] **Step 1: Write the new database layer**

```typescript
import { nanoid } from 'nanoid';
import { Student, StudentSubject, RateHistory, Lesson, LessonStatus, Payment, RecurringRule } from '../models';

let db: any = null;
let useMock = false;

try {
  const SQLite = require('expo-sqlite');
  db = SQLite.openDatabase('tutor_bill2.db');
} catch (e) {
  useMock = true;
}

const uid = () => nanoid(12);

const mockStudents: Student[] = [];
const mockSubjects: StudentSubject[] = [];
const mockRateHistory: RateHistory[] = [];
const mockLessons: Lesson[] = [];
const mockPayments: Payment[] = [];
const mockRules: RecurringRule[] = [];
let mockIdCounter = 1;

export const initDatabase = (): Promise<void> => {
  if (useMock) {
    if (mockStudents.length === 0) seedMockData();
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL, phone TEXT, address TEXT,
          defaultLocation TEXT, color TEXT,
          createdAt TEXT NOT NULL, updatedAt TEXT, deletedAt TEXT
        )`
      );
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS student_subjects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          studentId INTEGER NOT NULL, subject TEXT NOT NULL,
          hourlyRate REAL NOT NULL, color TEXT,
          createdAt TEXT NOT NULL, updatedAt TEXT, deletedAt TEXT,
          FOREIGN KEY (studentId) REFERENCES students(id)
        )`
      );
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS rate_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          studentSubjectId INTEGER NOT NULL,
          oldRate REAL NOT NULL, newRate REAL NOT NULL,
          changedAt TEXT NOT NULL,
          FOREIGN KEY (studentSubjectId) REFERENCES student_subjects(id)
        )`
      );
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS lessons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          studentId INTEGER NOT NULL, studentSubjectId INTEGER,
          date TEXT NOT NULL, timeSlot TEXT NOT NULL DEFAULT '',
          duration REAL NOT NULL, amount REAL NOT NULL,
          manualAmount REAL, status TEXT NOT NULL DEFAULT 'scheduled',
          confirmedAt TEXT, notes TEXT,
          createdAt TEXT NOT NULL, updatedAt TEXT, deletedAt TEXT,
          FOREIGN KEY (studentId) REFERENCES students(id),
          FOREIGN KEY (studentSubjectId) REFERENCES student_subjects(id)
        )`
      );
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lessonId INTEGER NOT NULL, amount REAL NOT NULL,
          method TEXT, paidAt TEXT, notes TEXT,
          createdAt TEXT NOT NULL, updatedAt TEXT, deletedAt TEXT,
          FOREIGN KEY (lessonId) REFERENCES lessons(id)
        )`
      );
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS recurring_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          studentId INTEGER NOT NULL, studentSubjectId INTEGER,
          weekdays TEXT NOT NULL, "interval" INTEGER NOT NULL DEFAULT 1,
          timeSlot TEXT NOT NULL, duration REAL NOT NULL,
          amount REAL, startDate TEXT NOT NULL, endDate TEXT,
          excludedDates TEXT, notes TEXT,
          createdAt TEXT NOT NULL, updatedAt TEXT, deletedAt TEXT,
          FOREIGN KEY (studentId) REFERENCES students(id),
          FOREIGN KEY (studentSubjectId) REFERENCES student_subjects(id)
        )`
      );
    }, (error: any) => reject(error), () => resolve());
  });
};

export const migrateFromV1 = async (): Promise<void> => {
  if (useMock) return;
  return new Promise((resolve) => {
    try {
      const oldDb = (require('expo-sqlite') as any).openDatabase('tutor_bill.db');
      oldDb.transaction((tx: any) => {
        tx.executeSql(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='lessons'",
          [],
          (_: any, result: any) => {
            if (result.rows.length === 0) { resolve(); return; }
            tx.executeSql('SELECT * FROM students', [], (_2: any, r2: any) => {
              const oldStudents: any[] = [];
              for (let i = 0; i < r2.rows.length; i++) oldStudents.push(r2.rows.item(i));
              tx.executeSql('SELECT * FROM lessons', [], (_3: any, r3: any) => {
                const oldLessons: any[] = [];
                for (let i = 0; i < r3.rows.length; i++) oldLessons.push(r3.rows.item(i));
                db.transaction((ntx: any) => {
                  for (const s of oldStudents) {
                    const now = new Date().toISOString();
                    ntx.executeSql(
                      'INSERT INTO students (name, phone, address, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
                      [s.name, s.phone || '', s.address || '', s.createdAt || now, now]
                    );
                    ntx.executeSql(
                      'INSERT INTO student_subjects (studentId, subject, hourlyRate, color, createdAt, updatedAt) VALUES (last_insert_rowid(), ?, ?, ?, ?, ?)',
                      [s.subject || '未分类', s.hourlyRate || 75, null, now, now]
                    );
                    const sLessons = oldLessons.filter((l: any) => l.studentId === s.id);
                    for (const l of sLessons) {
                      const status: LessonStatus = l.paid ? 'paid' : (l.confirmedAt ? 'completed' : 'scheduled');
                      ntx.executeSql(
                        'INSERT INTO lessons (studentId, studentSubjectId, date, timeSlot, duration, amount, status, confirmedAt, notes, createdAt, updatedAt) VALUES (last_insert_rowid(), last_insert_rowid(), ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [l.date || '', l.timeSlot || '', l.duration || 1, l.amount || 0, status, l.confirmedAt, l.notes || '', l.createdAt || now, now]
                      );
                    }
                  }
                }, () => {}, () => resolve());
              });
            });
          }
        );
      });
    } catch { resolve(); }
  });
};

// === CRUD: Students ===
export const addStudent = (student: Omit<Student, 'id' | '_uuid'>): Promise<number> => {
  if (useMock) { const s: Student = { id: mockIdCounter++, ...student, _uuid: uid() }; mockStudents.push(s); return Promise.resolve(s.id); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(
        'INSERT INTO students (name, phone, address, defaultLocation, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [student.name, student.phone, student.address || null, student.defaultLocation || null, student.color || null, student.createdAt, student.updatedAt || student.createdAt],
        (_: any, result: any) => resolve(result.insertId)
      );
    }, (e: any) => reject(e));
  });
};

export const getAllStudents = (): Promise<Student[]> => {
  if (useMock) return Promise.resolve(mockStudents.filter(s => !s.deletedAt).map(s => ({ ...s })));
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('SELECT * FROM students WHERE deletedAt IS NULL ORDER BY createdAt DESC', [], (_: any, r: any) => {
        const arr: Student[] = [];
        for (let i = 0; i < r.rows.length; i++) arr.push(r.rows.item(i));
        resolve(arr);
      });
    }, (e: any) => reject(e));
  });
};

export const updateStudent = (student: Student): Promise<void> => {
  if (useMock) { const i = mockStudents.findIndex(x => x.id === student.id); if (i >= 0) mockStudents[i] = { ...student, updatedAt: new Date().toISOString() }; return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(
        'UPDATE students SET name=?, phone=?, address=?, defaultLocation=?, color=?, updatedAt=? WHERE id=?',
        [student.name, student.phone, student.address || null, student.defaultLocation || null, student.color || null, new Date().toISOString(), student.id],
        () => resolve()
      );
    }, (e: any) => reject(e));
  });
};

export const deleteStudent = (id: number): Promise<void> => {
  if (useMock) { const s = mockStudents.find(x => x.id === id); if (s) s.deletedAt = new Date().toISOString(); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('UPDATE students SET deletedAt=? WHERE id=?', [new Date().toISOString(), id], () => resolve());
    }, (e: any) => reject(e));
  });
};

// === CRUD: Student Subjects ===
export const addSubject = (sub: Omit<StudentSubject, 'id' | '_uuid'>): Promise<number> => {
  if (useMock) { const s: StudentSubject = { id: mockIdCounter++, ...sub, _uuid: uid() }; mockSubjects.push(s); return Promise.resolve(s.id); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(
        'INSERT INTO student_subjects (studentId, subject, hourlyRate, color, createdAt, updatedAt) VALUES (?,?,?,?,?,?)',
        [sub.studentId, sub.subject, sub.hourlyRate, sub.color || null, sub.createdAt, sub.createdAt],
        (_: any, r: any) => resolve(r.insertId)
      );
    }, (e: any) => reject(e));
  });
};

export const getSubjectsByStudentId = (studentId: number): Promise<StudentSubject[]> => {
  if (useMock) return Promise.resolve(mockSubjects.filter(s => s.studentId === studentId && !s.deletedAt));
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('SELECT * FROM student_subjects WHERE studentId=? AND deletedAt IS NULL ORDER BY createdAt', [studentId], (_: any, r: any) => {
        const arr: StudentSubject[] = [];
        for (let i = 0; i < r.rows.length; i++) arr.push(r.rows.item(i));
        resolve(arr);
      });
    }, (e: any) => reject(e));
  });
};

export const updateSubject = (sub: StudentSubject): Promise<void> => {
  if (useMock) { const i = mockSubjects.findIndex(x => x.id === sub.id); if (i >= 0) mockSubjects[i] = sub; return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('UPDATE student_subjects SET subject=?, hourlyRate=?, color=?, updatedAt=? WHERE id=?',
        [sub.subject, sub.hourlyRate, sub.color || null, new Date().toISOString(), sub.id], () => resolve());
    }, (e: any) => reject(e));
  });
};

export const deleteSubject = (id: number): Promise<void> => {
  if (useMock) { const s = mockSubjects.find(x => x.id === id); if (s) s.deletedAt = new Date().toISOString(); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('UPDATE student_subjects SET deletedAt=? WHERE id=?', [new Date().toISOString(), id], () => resolve());
    }, (e: any) => reject(e));
  });
};

// === CRUD: Rate History ===
export const addRateHistory = (entry: Omit<RateHistory, 'id'>): Promise<void> => {
  if (useMock) { mockRateHistory.push({ id: mockIdCounter++, ...entry }); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('INSERT INTO rate_history (studentSubjectId, oldRate, newRate, changedAt) VALUES (?,?,?,?)',
        [entry.studentSubjectId, entry.oldRate, entry.newRate, entry.changedAt], () => resolve());
    }, (e: any) => reject(e));
  });
};

export const getRateHistoryBySubjectId = (subjectId: number): Promise<RateHistory[]> => {
  if (useMock) return Promise.resolve(mockRateHistory.filter(r => r.studentSubjectId === subjectId));
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('SELECT * FROM rate_history WHERE studentSubjectId=? ORDER BY changedAt DESC', [subjectId], (_: any, r: any) => {
        const arr: RateHistory[] = [];
        for (let i = 0; i < r.rows.length; i++) arr.push(r.rows.item(i));
        resolve(arr);
      });
    }, (e: any) => reject(e));
  });
};

// === CRUD: Lessons ===
export const addLesson = (lesson: Omit<Lesson, 'id' | '_uuid'>): Promise<number> => {
  if (useMock) { const l: Lesson = { id: mockIdCounter++, ...lesson, _uuid: uid() }; mockLessons.push(l); return Promise.resolve(l.id); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(
        'INSERT INTO lessons (studentId, studentSubjectId, date, timeSlot, duration, amount, manualAmount, status, confirmedAt, notes, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [lesson.studentId, lesson.studentSubjectId || null, lesson.date, lesson.timeSlot, lesson.duration, lesson.amount, lesson.manualAmount || null, lesson.status, lesson.confirmedAt || null, lesson.notes, lesson.createdAt, lesson.createdAt],
        (_: any, r: any) => resolve(r.insertId)
      );
    }, (e: any) => reject(e));
  });
};

export const getAllLessons = (): Promise<Lesson[]> => {
  if (useMock) return Promise.resolve(mockLessons.filter(l => !l.deletedAt).reverse());
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('SELECT * FROM lessons WHERE deletedAt IS NULL ORDER BY date DESC', [], (_: any, r: any) => {
        const arr: Lesson[] = [];
        for (let i = 0; i < r.rows.length; i++) arr.push(r.rows.item(i));
        resolve(arr);
      });
    }, (e: any) => reject(e));
  });
};

export const getLessonsByStudentId = (studentId: number): Promise<Lesson[]> => {
  if (useMock) return Promise.resolve(mockLessons.filter(l => l.studentId === studentId && !l.deletedAt).reverse());
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('SELECT * FROM lessons WHERE studentId=? AND deletedAt IS NULL ORDER BY date DESC', [studentId], (_: any, r: any) => {
        const arr: Lesson[] = [];
        for (let i = 0; i < r.rows.length; i++) arr.push(r.rows.item(i));
        resolve(arr);
      });
    }, (e: any) => reject(e));
  });
};

export const updateLesson = (lesson: Lesson): Promise<void> => {
  if (useMock) { const i = mockLessons.findIndex(x => x.id === lesson.id); if (i >= 0) mockLessons[i] = { ...lesson, updatedAt: new Date().toISOString() }; return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(
        'UPDATE lessons SET studentId=?, studentSubjectId=?, date=?, timeSlot=?, duration=?, amount=?, manualAmount=?, status=?, confirmedAt=?, notes=?, updatedAt=? WHERE id=?',
        [lesson.studentId, lesson.studentSubjectId || null, lesson.date, lesson.timeSlot, lesson.duration, lesson.amount, lesson.manualAmount || null, lesson.status, lesson.confirmedAt || null, lesson.notes, new Date().toISOString(), lesson.id],
        () => resolve()
      );
    }, (e: any) => reject(e));
  });
};

export const setLessonStatus = (id: number, status: LessonStatus): Promise<void> => {
  const now = new Date().toISOString();
  const confirmedAt = (status === 'completed' || status === 'paid') ? now : null;
  if (useMock) {
    const l = mockLessons.find(x => x.id === id);
    if (l) { l.status = status; l.confirmedAt = confirmedAt || l.confirmedAt; l.updatedAt = now; }
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('UPDATE lessons SET status=?, confirmedAt=?, updatedAt=? WHERE id=?',
        [status, confirmedAt || null, now, id], () => resolve());
    }, (e: any) => reject(e));
  });
};

export const deleteLesson = (id: number): Promise<void> => {
  if (useMock) { const l = mockLessons.find(x => x.id === id); if (l) l.deletedAt = new Date().toISOString(); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('UPDATE lessons SET deletedAt=? WHERE id=?', [new Date().toISOString(), id], () => resolve());
    }, (e: any) => reject(e));
  });
};

// === CRUD: Payments ===
export const addPayment = (payment: Omit<Payment, 'id' | '_uuid'>): Promise<number> => {
  if (useMock) { const p: Payment = { id: mockIdCounter++, ...payment, _uuid: uid() }; mockPayments.push(p); return Promise.resolve(p.id); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('INSERT INTO payments (lessonId, amount, method, paidAt, notes, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)',
        [payment.lessonId, payment.amount, payment.method, payment.paidAt, payment.notes || null, payment.createdAt, payment.createdAt],
        (_: any, r: any) => resolve(r.insertId));
    }, (e: any) => reject(e));
  });
};

export const getPaymentsByLessonId = (lessonId: number): Promise<Payment[]> => {
  if (useMock) return Promise.resolve(mockPayments.filter(p => p.lessonId === lessonId && !p.deletedAt));
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('SELECT * FROM payments WHERE lessonId=? AND deletedAt IS NULL ORDER BY createdAt DESC', [lessonId], (_: any, r: any) => {
        const arr: Payment[] = [];
        for (let i = 0; i < r.rows.length; i++) arr.push(r.rows.item(i));
        resolve(arr);
      });
    }, (e: any) => reject(e));
  });
};

export const deletePayment = (id: number): Promise<void> => {
  if (useMock) { const p = mockPayments.find(x => x.id === id); if (p) p.deletedAt = new Date().toISOString(); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('UPDATE payments SET deletedAt=? WHERE id=?', [new Date().toISOString(), id], () => resolve());
    }, (e: any) => reject(e));
  });
};

// === CRUD: Recurring Rules ===
export const addRecurringRule = (rule: Omit<RecurringRule, 'id' | '_uuid'>): Promise<number> => {
  if (useMock) { const r: RecurringRule = { id: mockIdCounter++, ...rule, _uuid: uid() }; mockRules.push(r); return Promise.resolve(r.id); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(
        'INSERT INTO recurring_rules (studentId, studentSubjectId, weekdays, "interval", timeSlot, duration, amount, startDate, endDate, excludedDates, notes, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [rule.studentId, rule.studentSubjectId || null, rule.weekdays, rule.interval, rule.timeSlot, rule.duration, rule.amount || null, rule.startDate, rule.endDate || null, rule.excludedDates || '[]', rule.notes || null, rule.createdAt, rule.createdAt],
        (_: any, r: any) => resolve(r.insertId));
    }, (e: any) => reject(e));
  });
};

export const getAllRecurringRules = (): Promise<RecurringRule[]> => {
  if (useMock) return Promise.resolve(mockRules.filter(r => !r.deletedAt));
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('SELECT * FROM recurring_rules WHERE deletedAt IS NULL ORDER BY createdAt DESC', [], (_: any, r: any) => {
        const arr: RecurringRule[] = [];
        for (let i = 0; i < r.rows.length; i++) arr.push(r.rows.item(i));
        resolve(arr);
      });
    }, (e: any) => reject(e));
  });
};

export const updateRecurringRule = (rule: RecurringRule): Promise<void> => {
  if (useMock) { const i = mockRules.findIndex(x => x.id === rule.id); if (i >= 0) mockRules[i] = { ...rule, updatedAt: new Date().toISOString() }; return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(
        'UPDATE recurring_rules SET studentId=?, studentSubjectId=?, weekdays=?, "interval"=?, timeSlot=?, duration=?, amount=?, startDate=?, endDate=?, excludedDates=?, notes=?, updatedAt=? WHERE id=?',
        [rule.studentId, rule.studentSubjectId || null, rule.weekdays, rule.interval, rule.timeSlot, rule.duration, rule.amount || null, rule.startDate, rule.endDate || null, rule.excludedDates || '[]', rule.notes || null, new Date().toISOString(), rule.id],
        () => resolve());
    }, (e: any) => reject(e));
  });
};

export const deleteRecurringRule = (id: number): Promise<void> => {
  if (useMock) { const r = mockRules.find(x => x.id === id); if (r) r.deletedAt = new Date().toISOString(); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('UPDATE recurring_rules SET deletedAt=? WHERE id=?', [new Date().toISOString(), id], () => resolve());
    }, (e: any) => reject(e));
  });
};

// === Seed mock data ===
function seedMockData() {
  const now = new Date().toISOString();
  const s1: Student = { id: mockIdCounter++, name: '张三', phone: '13800138001', color: '#5B8DEF', createdAt: now, _uuid: uid() };
  const s2: Student = { id: mockIdCounter++, name: '李四', phone: '13800138002', color: '#FF8C6B', createdAt: now, _uuid: uid() };
  const s3: Student = { id: mockIdCounter++, name: '王五', phone: '13800138003', color: '#FF9500', createdAt: now, _uuid: uid() };
  mockStudents.push(s1, s2, s3);

  const sub1: StudentSubject = { id: mockIdCounter++, studentId: s1.id, subject: '数学', hourlyRate: 150, color: '#5B8DEF', createdAt: now, _uuid: uid() };
  const sub2: StudentSubject = { id: mockIdCounter++, studentId: s2.id, subject: '英语', hourlyRate: 200, color: '#FF8C6B', createdAt: now, _uuid: uid() };
  const sub3: StudentSubject = { id: mockIdCounter++, studentId: s3.id, subject: '物理', hourlyRate: 180, color: '#FF9500', createdAt: now, _uuid: uid() };
  mockSubjects.push(sub1, sub2, sub3);

  const dates = ['2026-04-28', '2026-04-29', '2026-04-30', '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-05', '2026-05-07', '2026-05-10', '2026-05-12', '2026-05-15', '2026-05-18', '2026-05-20'];
  for (let i = 0; i < 15; i++) {
    const student = [s1, s2, s3][i % 3];
    const subj = [sub1, sub2, sub3][i % 3];
    const status: LessonStatus = i < 3 ? 'paid' : (i < 6 ? 'completed' : 'scheduled');
    mockLessons.push({
      id: mockIdCounter++, studentId: student.id, studentSubjectId: subj.id,
      date: dates[i % dates.length], timeSlot: '14:00-16:00', duration: 2,
      amount: subj.hourlyRate * 2, status, confirmedAt: i < 6 ? now : null,
      notes: '', createdAt: now, _uuid: uid(),
    });
  }
}
```

- [ ] **Step 2: Install new dependencies**

```
npx expo install expo-file-system expo-sharing expo-print expo-notifications expo-document-picker
```

- [ ] **Step 3: Verify TypeScript compiles**

```
npx tsc --noEmit
```
Expected: Zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/database/index.ts package.json package-lock.json
git commit -m "feat: v2.0 database layer — 6 tables + migration + full CRUD"
```

---

### Task 3: 更新主题 tokens（四态色 + 科目颜色）

**Files:**
- Modify: `src/styles/theme.ts`

- [ ] **Step 1: Add new color definitions to theme.ts**

Replace `StatusColors` with:
```typescript
export const LessonStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: '#EEF2FF', text: '#6366F1', label: '待上课' },
  completed: { bg: '#FFFBEB', text: '#F59E0B', label: '待收款' },
  paid: { bg: '#ECFDF5', text: '#10B981', label: '已收款' },
  cancelled: { bg: '#F3F4F6', text: '#8E8E93', label: '已取消' },
} as const;
```

Replace `SubjectColors` with:
```typescript
export const SubjectColorPalette = [
  '#5B8DEF', '#FF8C6B', '#FF9500', '#4ECDC4',
  '#34C759', '#FF3B6E', '#AF52DE', '#8E8E93',
];

export const DefaultSubjectColors: Record<string, string> = {
  '数学': '#5B8DEF', '英语': '#FF8C6B', '物理': '#FF9500',
  '化学': '#4ECDC4', '生物': '#34C759', '语文': '#FF3B6E',
  '历史': '#AF52DE',
};

export function getSubjectColor(subject: string): string {
  return DefaultSubjectColors[subject] || SubjectColorPalette[0];
}

export const StatusTransitions: Record<string, string[]> = {
  scheduled: ['completed', 'cancelled'],
  completed: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/theme.ts
git commit -m "feat: expand theme — 4-status colors, 8-subject palette, transitions"
```

---

### Task 4: 更新 StatusBadge 支持四态

**Files:**
- Modify: `src/components/StatusBadge.tsx`

- [ ] **Step 1: Rewrite StatusBadge**

```typescript
import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LessonStatusColors, StatusTransitions, FontSize, FontWeight, BorderRadius, Spacing } from '../styles/theme';
import { LessonStatus } from '../models';

const StatusIcons: Record<string, 'book' | 'time' | 'checkmark-circle' | 'close-circle'> = {
  scheduled: 'book', completed: 'time', paid: 'checkmark-circle', cancelled: 'close-circle',
};

interface StatusBadgeProps {
  status: LessonStatus;
  showNextAction?: boolean;
  onToggle?: (nextStatus: LessonStatus) => void;
  allowPaid?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showNextAction, onToggle, allowPaid }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const colors = LessonStatusColors[status];
  const nextStatuses = StatusTransitions[status] || [];

  const handleTap = (next: LessonStatus) => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.25, useNativeDriver: true, speed: 30, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    onToggle?.(next);
  };

  return (
    <Animated.View style={{ transform: [{ scale }], flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      <View style={[styles.badge, { backgroundColor: colors.bg }]}>
        <Ionicons name={StatusIcons[status]} size={14} color={colors.text} />
        <Text style={[styles.text, { color: colors.text }]}>{colors.label}</Text>
      </View>
      {showNextAction && nextStatuses.map(next => {
        const nc = LessonStatusColors[next];
        if (next === 'paid' && allowPaid === false) return null;
        return (
          <TouchableOpacity key={next} activeOpacity={0.7} onPress={() => handleTap(next)}>
            <View style={[styles.actionBtn, { backgroundColor: nc.bg }]}>
              <Ionicons name={StatusIcons[next]} size={12} color={nc.text} />
              <Text style={[styles.actionText, { color: nc.text }]}>{nc.label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.pill, gap: 4 },
  text: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs, borderRadius: BorderRadius.pill, gap: 4 },
  actionText: { fontSize: 11, fontWeight: FontWeight.medium },
});

export default StatusBadge;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StatusBadge.tsx
git commit -m "feat: StatusBadge v2 — 4 statuses + next-action buttons with animation"
```

---

### Task 5: 更新 StudentAvatar 组件

**Files:**
- Modify: `src/components/StudentAvatar.tsx`

- [ ] **Step 1: Make subject/color optional**

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getStudentEmoji, BorderRadius } from '../styles/theme';

interface StudentAvatarProps {
  name: string;
  subject?: string;
  color?: string;
  size?: number;
}

const StudentAvatar: React.FC<StudentAvatarProps> = ({ name, color = '#6366F1', size = 44 }) => {
  const emoji = getStudentEmoji(name);
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: BorderRadius.iconContainer, backgroundColor: color + '18' }]}>
      <Text style={{ fontSize: size * 0.46 }}>{emoji}</Text>
    </View>
  );
};

const styles = StyleSheet.create({ container: { justifyContent: 'center', alignItems: 'center' } });
export default StudentAvatar;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StudentAvatar.tsx
git commit -m "feat: StudentAvatar — accepts direct color prop, subject optional"
```

---

### Task 6: 创建 SettingsScreen

**Files:**
- Create: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Write SettingsScreen**

```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../styles/theme';
import Toast from '../components/Toast';
import { exportAllToExcel } from '../utils/export';
import { pickAndImportCsv } from '../utils/import';
import { generateStudentPdf } from '../utils/pdf';

type ExportMode = 'all' | 'month' | 'student' | null;

interface Props {
  onNavigateToRecurringRules?: () => void;
  onNavigateToStudentSelect?: (mode: 'pdf' | 'export') => void;
}

const SettingsScreen: React.FC<Props> = ({ onNavigateToRecurringRules, onNavigateToStudentSelect }) => {
  const [exportMode, setExportMode] = useState<ExportMode>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({ visible: false, message: '', type: 'success' });

  const handleExport = async (mode: ExportMode) => {
    setExportMode(null);
    try {
      if (mode === 'all') await exportAllToExcel();
      else if (mode === 'student') { onNavigateToStudentSelect?.('export'); return; }
      // mode === 'month' handled similarly
      setToast({ visible: true, message: '导出成功', type: 'success' });
    } catch (e: any) { setToast({ visible: true, message: `导出失败: ${e.message}`, type: 'error' }); }
  };

  const handleImport = async () => {
    try {
      const result = await pickAndImportCsv();
      setToast({ visible: true, message: `导入完成: ${result.imported} 条记录`, type: 'success' });
      if (result.errors.length > 0) setToast({ visible: true, message: `${result.errors.length} 条错误`, type: 'error' });
    } catch (e: any) { setToast({ visible: true, message: `导入失败: ${e.message}`, type: 'error' }); }
  };

  const menuItems = [
    { icon: 'download-outline', label: '导出数据', subtitle: '按全部/月份/学生导出 Excel', onPress: () => setExportMode('all'), color: Colors.paid },
    { icon: 'upload-outline', label: '导入数据', subtitle: '从 Excel 文件恢复数据', onPress: handleImport, color: Colors.primary },
    { icon: 'document-text-outline', label: '导出 PDF 账单', subtitle: '按学生 + 月份生成正式账单', onPress: () => onNavigateToStudentSelect?.('pdf'), color: Colors.pending },
    { icon: 'repeat-outline', label: '周期课程规则', subtitle: '管理自动排课规则', onPress: () => onNavigateToRecurringRules?.(), color: '#AF52DE' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>数据管理</Text>
        {menuItems.map((item, i) => (
          <TouchableOpacity key={i} style={[styles.menuItem, Shadows.subtle]} activeOpacity={0.7} onPress={item.onPress}>
            <View style={[styles.iconBox, { backgroundColor: item.color + '14' }]}>
              <Ionicons name={item.icon as any} size={22} color={item.color} />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuSub}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.caption} />
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>关于</Text>
        <View style={[styles.aboutCard, Shadows.subtle]}>
          <Text style={styles.aboutApp}>家教账单 v2.0</Text>
          <Text style={styles.aboutDesc}>个人离线家教课程账单管理工具</Text>
          <View style={styles.aboutDivider} />
          <Text style={styles.aboutDesc}>数据安全：所有数据仅存储在您的设备上</Text>
        </View>
      </ScrollView>

      {exportMode && (
        <View style={styles.overlay}>
          <View style={[styles.exportModal, Shadows.floating]}>
            <Text style={styles.modalTitle}>选择导出范围</Text>
            {[
              { key: 'all' as ExportMode, label: '全部数据', icon: 'server-outline' },
              { key: 'month' as ExportMode, label: '按月份', icon: 'calendar-outline' },
              { key: 'student' as ExportMode, label: '按学生', icon: 'person-outline' },
            ].map(opt => (
              <TouchableOpacity key={opt.key} style={styles.exportOption} onPress={() => handleExport(opt.key)}>
                <Ionicons name={opt.icon as any} size={20} color={Colors.primary} />
                <Text style={styles.exportOptionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setExportMode(null)}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast({ ...toast, visible: false })} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.xl },
  sectionTitle: { fontSize: FontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.caption, marginBottom: Spacing.md, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.md },
  iconBox: { width: 44, height: 44, borderRadius: BorderRadius.iconContainer, justifyContent: 'center', alignItems: 'center' },
  menuText: { flex: 1 },
  menuLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title },
  menuSub: { fontSize: FontSize.small, color: Colors.caption, marginTop: 2 },
  aboutCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: Spacing.xl, alignItems: 'center' },
  aboutApp: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },
  aboutDesc: { fontSize: FontSize.small, color: Colors.caption, marginTop: Spacing.xs },
  aboutDivider: { width: 40, height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.md },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center' },
  exportModal: { backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: Spacing.xl, width: '80%' },
  modalTitle: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: Spacing.lg, textAlign: 'center' },
  exportOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  exportOptionText: { fontSize: FontSize.body, color: Colors.title },
  cancelBtn: { marginTop: Spacing.lg, alignItems: 'center', paddingVertical: Spacing.sm },
  cancelBtnText: { fontSize: FontSize.body, color: Colors.caption },
});

export default SettingsScreen;
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: SettingsScreen — export/import/PDF entry points + about section"
```

---

### Task 7: 将设置页接入 App 导航

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add Settings tab and navigation**

```typescript
import SettingsScreen from './screens/SettingsScreen';
import { migrateFromV1 } from './database';

// Add to TAB_ICONS:
'Settings': ['settings', 'settings-outline'],

// In useEffect, add migration:
await initDatabase();
await migrateFromV1();
setIsLoading(false);

// Add Tab.Screen:
<Tab.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add Settings tab + v1 migration on startup"
```

---

### Task 8: Excel 导出工具

**Files:**
- Create: `src/utils/export.ts`

- [ ] **Step 1: Write export utility**

```typescript
import { nanoid } from 'nanoid';
import { Student, StudentSubject, Lesson, Payment, RecurringRule, RateHistory } from '../models';
import { getAllStudents, getSubjectsByStudentId, getAllLessons, getPaymentsByLessonId, getAllRecurringRules, getRateHistoryBySubjectId } from '../database';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

function escapeCsv(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function jsonToCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const lines = rows.map(row => keys.map(k => escapeCsv(row[k])).join(','));
  return [header, ...lines].join('\n');
}

export async function exportAllToExcel(): Promise<string> {
  const students = await getAllStudents();
  const subjects: StudentSubject[] = [];
  for (const s of students) { subjects.push(...(await getSubjectsByStudentId(s.id))); }
  const lessons = await getAllLessons();
  const payments: Payment[] = [];
  for (const l of lessons) { payments.push(...(await getPaymentsByLessonId(l.id))); }
  const rules = await getAllRecurringRules();
  const rateHistory: RateHistory[] = [];
  for (const sub of subjects) { rateHistory.push(...(await getRateHistoryBySubjectId(sub.id))); }

  const withUuid = <T>(items: T[]) => items.map(item => ({ ...item, _uuid: (item as any)._uuid || nanoid(12) }));
  const sheets = [
    `# students\n${jsonToCsv(withUuid(students))}`,
    `# student_subjects\n${jsonToCsv(withUuid(subjects))}`,
    `# lessons\n${jsonToCsv(withUuid(lessons))}`,
    `# payments\n${jsonToCsv(withUuid(payments))}`,
    `# recurring_rules\n${jsonToCsv(withUuid(rules))}`,
    `# rate_history\n${jsonToCsv(rateHistory)}`,
  ];
  const content = sheets.join('\n\n');
  const path = FileSystem.documentDirectory + `tutor_bill_export_${new Date().toISOString().split('T')[0]}.csv`;
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: '导出家教账单数据' });
  return path;
}

export async function exportByMonth(month: string): Promise<string> {
  const allStudents = await getAllStudents();
  const allLessons = await getAllLessons();
  const monthLessons = allLessons.filter(l => l.date.startsWith(month));
  const students = allStudents.filter(s => monthLessons.some(l => l.studentId === s.id));
  const subjects: StudentSubject[] = [];
  for (const s of students) { subjects.push(...(await getSubjectsByStudentId(s.id))); }
  const payments: Payment[] = [];
  for (const l of monthLessons) { payments.push(...(await getPaymentsByLessonId(l.id))); }

  const withUuid = <T>(items: T[]) => items.map(item => ({ ...item, _uuid: (item as any)._uuid || nanoid(12) }));
  const sheets = [
    `# students\n${jsonToCsv(withUuid(students))}`,
    `# student_subjects\n${jsonToCsv(withUuid(subjects))}`,
    `# lessons\n${jsonToCsv(withUuid(monthLessons))}`,
    `# payments\n${jsonToCsv(withUuid(payments))}`,
  ];
  const content = sheets.join('\n\n');
  const path = FileSystem.documentDirectory + `tutor_bill_${month}.csv`;
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: `导出 ${month} 账单` });
  return path;
}

export async function exportByStudent(studentId: number): Promise<string> {
  const students = await getAllStudents();
  const student = students.find(s => s.id === studentId);
  if (!student) throw new Error('Student not found');
  const subjects = await getSubjectsByStudentId(studentId);
  const allLessons = await getAllLessons();
  const sLessons = allLessons.filter(l => l.studentId === studentId);
  const payments: Payment[] = [];
  for (const l of sLessons) { payments.push(...(await getPaymentsByLessonId(l.id))); }
  const rules = (await getAllRecurringRules()).filter(r => r.studentId === studentId);

  const withUuid = <T>(items: T[]) => items.map(item => ({ ...item, _uuid: (item as any)._uuid || nanoid(12) }));
  const sheets = [
    `# students\n${jsonToCsv(withUuid([student]))}`,
    `# student_subjects\n${jsonToCsv(withUuid(subjects))}`,
    `# lessons\n${jsonToCsv(withUuid(sLessons))}`,
    `# payments\n${jsonToCsv(withUuid(payments))}`,
    `# recurring_rules\n${jsonToCsv(withUuid(rules))}`,
  ];
  const content = sheets.join('\n\n');
  const path = FileSystem.documentDirectory + `tutor_bill_${student.name}.csv`;
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: `导出 ${student.name} 账单` });
  return path;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/export.ts
git commit -m "feat: CSV export — all/month/student with UUID columns"
```

---

### Task 9: Excel 导入工具

**Files:**
- Create: `src/utils/import.ts`

- [ ] **Step 1: Write import utility**

```typescript
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { addStudent, addSubject, addLesson, addPayment, addRecurringRule } from '../database';
import { LessonStatus } from '../models';

function parseCsvSection(text: string): Record<string, any>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const row: Record<string, any> = {};
    let current = ''; let inQuotes = false; let colIdx = 0;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = false;
        } else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { row[headers[colIdx] || `col${colIdx}`] = current; current = ''; colIdx++; }
        else current += ch;
      }
    }
    if (colIdx < headers.length) row[headers[colIdx] || `col${colIdx}`] = current;
    return row;
  });
}

function parseSections(text: string): Record<string, Record<string, any>[]> {
  const sections: Record<string, Record<string, any>[]> = {};
  const parts = text.split(/^# /m).filter(Boolean);
  for (const part of parts) {
    const newlineIdx = part.indexOf('\n');
    const name = newlineIdx >= 0 ? part.substring(0, newlineIdx).trim() : part.trim();
    const body = newlineIdx >= 0 ? part.substring(newlineIdx + 1) : '';
    sections[name] = parseCsvSection(body);
  }
  return sections;
}

export async function pickAndImportCsv(): Promise<{ imported: number; errors: string[] }> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'text/*' });
  if (result.canceled) return { imported: 0, errors: [] };

  const file = result.assets[0];
  const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
  const sections = parseSections(content);
  const errors: string[] = [];
  const idMap = new Map<string, number>();

  // Phase 1: students
  for (const row of sections.students || []) {
    try {
      const id = await addStudent({
        name: row.name, phone: row.phone || '', address: row.address || null,
        defaultLocation: row.defaultLocation || null, color: row.color || null,
        createdAt: row.createdAt || new Date().toISOString(), updatedAt: row.updatedAt || undefined,
      });
      if (row._uuid) idMap.set(row._uuid, id);
    } catch (e: any) { errors.push(`Student ${row.name}: ${e.message}`); }
  }

  // Phase 2: subjects
  for (const row of sections.student_subjects || []) {
    try {
      const id = await addSubject({
        studentId: Number(idMap.get(row.studentId) || row.studentId),
        subject: row.subject, hourlyRate: Number(row.hourlyRate), color: row.color || null,
        createdAt: row.createdAt || new Date().toISOString(), updatedAt: row.updatedAt || undefined,
      });
      if (row._uuid) idMap.set(row._uuid, id);
    } catch (e: any) { errors.push(`Subject: ${e.message}`); }
  }

  // Phase 3: lessons
  for (const row of sections.lessons || []) {
    try {
      const id = await addLesson({
        studentId: Number(idMap.get(row.studentId) || row.studentId),
        studentSubjectId: row.studentSubjectId ? Number(idMap.get(row.studentSubjectId) || row.studentSubjectId) : undefined,
        date: row.date, timeSlot: row.timeSlot || '', duration: Number(row.duration),
        amount: Number(row.amount), manualAmount: row.manualAmount ? Number(row.manualAmount) : undefined,
        status: (row.status as LessonStatus) || 'scheduled',
        confirmedAt: row.confirmedAt || null, notes: row.notes || '',
        createdAt: row.createdAt || new Date().toISOString(), updatedAt: row.updatedAt || undefined,
      });
      if (row._uuid) idMap.set(row._uuid, id);
    } catch (e: any) { errors.push(`Lesson: ${e.message}`); }
  }

  // Phase 4: payments
  for (const row of sections.payments || []) {
    try {
      await addPayment({
        lessonId: Number(idMap.get(row.lessonId) || row.lessonId),
        amount: Number(row.amount), method: row.method || 'cash',
        paidAt: row.paidAt || new Date().toISOString(), notes: row.notes || null,
        createdAt: row.createdAt || new Date().toISOString(),
      });
    } catch (e: any) { errors.push(`Payment: ${e.message}`); }
  }

  // Phase 5: recurring_rules
  for (const row of sections.recurring_rules || []) {
    try {
      await addRecurringRule({
        studentId: Number(idMap.get(row.studentId) || row.studentId),
        studentSubjectId: row.studentSubjectId ? Number(idMap.get(row.studentSubjectId) || row.studentSubjectId) : undefined,
        weekdays: row.weekdays || '[]', interval: Number(row.interval) || 1,
        timeSlot: row.timeSlot, duration: Number(row.duration),
        amount: row.amount ? Number(row.amount) : undefined,
        startDate: row.startDate, endDate: row.endDate || null,
        excludedDates: row.excludedDates || '[]', notes: row.notes || null,
        createdAt: row.createdAt || new Date().toISOString(),
      });
    } catch (e: any) { errors.push(`Rule: ${e.message}`); }
  }

  return { imported: idMap.size, errors };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/import.ts
git commit -m "feat: CSV import — UUID matching + ID remapping across 5 tables"
```

---

### Task 10: PDF 账单导出

**Files:**
- Create: `src/utils/pdf.ts`

- [ ] **Step 1: Write PDF utility**

```typescript
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getSubjectsByStudentId, getLessonsByStudentId, getPaymentsByLessonId } from '../database';
import { Student, StudentSubject, Payment } from '../models';

export async function generateStudentPdf(student: Student, month: string): Promise<void> {
  const subjects = await getSubjectsByStudentId(student.id);
  const allLessons = await getLessonsByStudentId(student.id);
  const monthLessons = allLessons.filter(l => l.date.startsWith(month));
  const payments: Payment[] = [];
  for (const l of monthLessons) { payments.push(...(await getPaymentsByLessonId(l.id))); }

  const totalAmount = monthLessons.reduce((sum, l) => sum + l.amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  const lessonRows = monthLessons.map(l => {
    const sub = subjects.find(s => s.id === l.studentSubjectId);
    const paid = payments.filter(p => p.lessonId === l.id).reduce((s, p) => s + p.amount, 0);
    return `<tr><td>${l.date}</td><td>${sub?.subject || '-'}</td><td>${l.timeSlot}</td><td>${l.duration}h</td><td>¥${l.amount.toFixed(0)}</td><td>¥${paid.toFixed(0)}</td><td>${paid >= l.amount ? '已结清' : l.status === 'cancelled' ? '已取消' : '待收'}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, sans-serif; padding: 40px; color: #1A1A2E; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #9A9AB0; font-size: 14px; margin-bottom: 24px; }
    .summary { display: flex; gap: 24px; margin-bottom: 24px; }
    .summary-item { background: #F8FAFC; padding: 16px; border-radius: 12px; flex: 1; text-align: center; }
    .summary-value { font-size: 22px; font-weight: 700; }
    .summary-label { font-size: 13px; color: #9A9AB0; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #F1F5F9; padding: 10px; text-align: left; font-size: 13px; border-bottom: 2px solid #E2E8F0; }
    td { padding: 10px; border-bottom: 1px solid #F1F5F9; font-size: 14px; }
    .footer { margin-top: 32px; text-align: center; color: #9A9AB0; font-size: 12px; }
  </style></head><body>
    <h1>${student.name} - 家教账单</h1>
    <p class="subtitle">${month} | ${subjects.map(s => s.subject).join(', ')}</p>
    <div class="summary">
      <div class="summary-item"><div class="summary-value">${monthLessons.length}节</div><div class="summary-label">课程数</div></div>
      <div class="summary-item"><div class="summary-value">¥${totalAmount.toFixed(0)}</div><div class="summary-label">总额</div></div>
      <div class="summary-item"><div class="summary-value">¥${totalPaid.toFixed(0)}</div><div class="summary-label">已收款</div></div>
      <div class="summary-item"><div class="summary-value" style="color:${totalAmount - totalPaid > 0 ? '#F59E0B' : '#10B981'}">¥${(totalAmount - totalPaid).toFixed(0)}</div><div class="summary-label">待收款</div></div>
    </div>
    <table><thead><tr><th>日期</th><th>科目</th><th>时段</th><th>课时</th><th>金额</th><th>已收</th><th>状态</th></tr></thead><tbody>${lessonRows}</tbody></table>
    <p class="footer">家教账单 v2.0 · ${new Date().toLocaleDateString('zh-CN')}</p>
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `导出 ${student.name} ${month} 账单` });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/pdf.ts
git commit -m "feat: PDF billing export — formatted per-student per-month bill"
```

---

### Task 11: 改造 LessonScreen — 四态流转 + 手动金额 + 收款

**Files:**
- Modify: `src/screens/LessonScreen.tsx` (major rewrite)

- [ ] **Step 1: Rewrite key sections of LessonScreen**

Replace filter logic to use `status` field:
```typescript
const filteredLessons = (() => {
  let filtered: Lesson[];
  if (filterStatus === 'upcoming') {
    filtered = lessons.filter(l => l.status === 'scheduled');
  } else if (filterStatus === 'unpaid') {
    filtered = lessons.filter(l => l.status === 'completed');
  } else if (filterStatus === 'paid') {
    filtered = lessons.filter(l => l.status === 'paid');
  } else {
    filtered = [...lessons];
  }
  filtered.sort((a, b) => b.date.localeCompare(a.date));
  return filtered;
})();
```

Replace StatusBadge usage in renderLesson:
```typescript
<StatusBadge
  status={item.status}
  showNextAction={true}
  onToggle={(nextStatus) => setLessonStatus(item.id, nextStatus).then(loadLessons)}
/>
```

Add manual amount toggle and subject picker to form, replace `paid` with `status` in save logic:
```typescript
// In handleSave, use status instead of paid
await addLesson({
  studentId: selectedStudentId, studentSubjectId: selectedSubjectId || undefined,
  date, timeSlot, duration: parseFloat(duration),
  amount: useManualAmount ? parseFloat(manualAmount) : calculateAmount(),
  manualAmount: useManualAmount ? parseFloat(manualAmount) : undefined,
  status: 'scheduled', confirmedAt: null, notes,
  createdAt: new Date().toISOString(),
});
```

Add payments section below each lesson card:
```typescript
{paymentsForLesson[item.id]?.length > 0 && (
  <View style={styles.paymentSection}>
    <View style={styles.progressBar}>
      <View style={[styles.progressFill, { width: `${Math.min(100, (totalPaid / getEffectiveAmount(item)) * 100)}%` }]} />
    </View>
    {paymentsForLesson[item.id].map((p: Payment) => (...))}
    {totalPaid < getEffectiveAmount(item) && (
      <TouchableOpacity onPress={() => handleAddPayment(item)}>...</TouchableOpacity>
    )}
  </View>
)}
```

- [ ] **Step 2: Run type check**

```
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/LessonScreen.tsx
git commit -m "feat: LessonScreen v2 — 4-status, manual amount, payments, subject picker"
```

---

### Task 12: 改造 StudentScreen — 多科目

**Files:**
- Modify: `src/screens/StudentScreen.tsx`

- [ ] **Step 1: Update for multi-subject support**

Replace single subject/rate fields with subjects array:
```typescript
const [editSubjects, setEditSubjects] = useState<{ subject: string; hourlyRate: string; color?: string }[]>([{ subject: '', hourlyRate: '', color: SubjectColorPalette[0] }]);
```

Student card shows subject tags:
```typescript
<View style={styles.subjectTags}>
  {subs.map(sub => (
    <View key={sub.id} style={[styles.subjectTag, { backgroundColor: (sub.color || Colors.primary) + '18' }]}>
      <View style={[styles.subjectDot, { backgroundColor: sub.color || Colors.primary }]} />
      <Text style={[styles.subjectTagText, { color: sub.color || Colors.primary }]}>{sub.subject}</Text>
      <Text style={styles.subjectTagRate}>{sub.hourlyRate}元/h</Text>
    </View>
  ))}
</View>
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/StudentScreen.tsx
git commit -m "feat: StudentScreen — multi-subject with color-coded tags"
```

---

### Task 13: 周期规则管理

**Files:**
- Create: `src/screens/RecurringRulesScreen.tsx`

- [ ] **Step 1: Write RecurringRulesScreen**

Screen with FlatList of rules, BottomSheet for add/edit form, and generation logic:

```typescript
const generateCourses = (rule: RecurringRule) => {
  const start = new Date(rule.startDate);
  const end = rule.endDate ? new Date(rule.endDate) : new Date(Date.now() + 30 * 86400000);
  const excluded = JSON.parse(rule.excludedDates || '[]') as string[];
  const weekdays = JSON.parse(rule.weekdays) as number[];

  const courses: Omit<Lesson, 'id' | '_uuid'>[] = [];
  const cursor = new Date(Math.max(start.getTime(), Date.now()));
  while (cursor <= end) {
    const dayOfWeek = cursor.getDay() || 7;
    const dateStr = cursor.toISOString().split('T')[0];
    if (weekdays.includes(dayOfWeek) && !excluded.includes(dateStr)) {
      courses.push({
        studentId: rule.studentId, studentSubjectId: rule.studentSubjectId,
        date: dateStr, timeSlot: rule.timeSlot, duration: rule.duration,
        amount: rule.amount || 0, status: 'scheduled', confirmedAt: null,
        notes: rule.notes || '', createdAt: new Date().toISOString(),
      });
    }
    cursor.setDate(cursor.getDate() + (rule.interval === 2 ? 7 : 1));
  }
  return courses;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/RecurringRulesScreen.tsx
git commit -m "feat: recurring rules — weekly/biweekly schedule generation"
```

---

### Task 14: 本地通知

**Files:**
- Create: `src/utils/notifications.ts`

- [ ] **Step 1: Write notification utility**

```typescript
import * as Notifications from 'expo-notifications';
import { getAllLessons } from '../database';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function requestPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const lessons = await getAllLessons();
  const now = new Date();

  for (const l of lessons) {
    if (l.status === 'scheduled') {
      const [sh, sm] = (l.timeSlot?.split('-')[0]?.trim()?.split(':') || []).map(Number);
      const d = new Date(`${l.date}T${String(sh||0).padStart(2,'0')}:${String(sm||0).padStart(2,'0')}:00`);
      const r = new Date(d.getTime() - 30 * 60000);
      if (r > now) { await Notifications.scheduleNotificationAsync({ content: { title: '上课提醒', body: `${l.date} ${l.timeSlot} 有课`, data: { lessonId: l.id } }, trigger: { date: r } }); }
    }
    if (l.status === 'completed') {
      const [eh, em] = (l.timeSlot?.split('-')[1]?.trim()?.split(':') || []).map(Number);
      const d = new Date(`${l.date}T${String(eh||0).padStart(2,'0')}:${String(em||0).padStart(2,'0')}:00`);
      const r = new Date(d.getTime() + 2 * 3600000);
      if (r > now) { await Notifications.scheduleNotificationAsync({ content: { title: '收款提醒', body: '课程已结束，提醒家长付款', data: { lessonId: l.id } }, trigger: { date: r } }); }
    }
  }
}
```

- [ ] **Step 2: Integrate in App.tsx**

```typescript
import { requestPermission, scheduleAllReminders } from './utils/notifications';
// In useEffect after DB init:
requestPermission().then(g => { if (g) scheduleAllReminders(); });
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/notifications.ts src/App.tsx
git commit -m "feat: local notifications — pre-lesson and payment reminders"
```

---

### Task 15: 时薪历史 + 适配 Stats

**Files:**
- Modify: `src/screens/StudentScreen.tsx` (rate history recording)
- Modify: `src/screens/StatsScreen.tsx` (adapt to new model)
- Modify: `src/screens/StudentBillingDetailScreen.tsx` (adapt to new model)
- Modify: `src/screens/HomeScreen.tsx` (adapt to new model)

- [ ] **Step 1: Record rate changes**

In StudentScreen save handler:
```typescript
if (existingSub && existingSub.hourlyRate !== parseFloat(subRow.hourlyRate)) {
  await addRateHistory({ studentSubjectId: existingSub.id, oldRate: existingSub.hourlyRate, newRate: parseFloat(subRow.hourlyRate), changedAt: new Date().toISOString() });
}
```

- [ ] **Step 2: Adapt all screens to use `status` instead of `paid`**

Replace all `l.paid` with `l.status === 'paid'` in StatsScreen, StudentBillingDetailScreen, HomeScreen.

- [ ] **Step 3: Full type check**

```
npx tsc --noEmit
```
Expected: Zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/StudentScreen.tsx src/screens/StatsScreen.tsx src/screens/StudentBillingDetailScreen.tsx src/screens/HomeScreen.tsx src/contexts/ActionContext.tsx
git commit -m "feat: rate history + adapt all screens to v2 data model"
```

---

### Task 16: 最终集成验证

- [ ] **Step 1: Run TypeScript check**

```
npx tsc --noEmit
```
Expected: Zero errors.

- [ ] **Step 2: Verify Expo starts**

```
npx expo start
```
Expected: Bundler starts successfully, app renders in simulator/device.

- [ ] **Step 3: Manual test checklist**

- [ ] App launches and shows loading → tab navigation
- [ ] Settings tab visible with 4 menu items
- [ ] Student form allows adding multiple subjects
- [ ] Lesson card shows 4-status badge with next-action buttons
- [ ] Manual amount toggle works in lesson form
- [ ] Payment section visible on lesson cards
- [ ] Export CSV generates file (check sharing dialog)
- [ ] PDF generates without errors
- [ ] Filter tabs work with new status logic
- [ ] Home screen shows correct upcoming lessons

- [ ] **Step 4: Commit verification fixes**

```bash
git add -A
git commit -m "chore: integration fixes from E2E verification"
```
