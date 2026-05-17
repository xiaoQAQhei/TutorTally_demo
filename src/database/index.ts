/**
 * ── database/index.ts ────────────────────────────────────────────────────────
 * 数据库操作模块：基于 expo-sqlite 的 SQLite CRUD 封装。
 * 在 expo-sqlite 不可用时（如 Web）自动降级为内存 Mock 数据。
 * 提供学生、科目、调价记录、课程、支付、重复规则六类实体的完整 CRUD。
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { nanoid } from 'nanoid/non-secure';
import { Student, StudentSubject, RateHistory, Lesson, LessonStatus, Payment, RecurringRule } from '../models';

let db: any = null;              // SQLite 数据库实例
let useMock = false;             // 是否使用模拟数据（expo-sqlite 不可用时）

// 尝试加载 expo-sqlite，失败则启用 Mock 模式
try {
  const SQLite = require('expo-sqlite');
  db = SQLite.openDatabase('tutor_bill2.db');
} catch (e) {
  useMock = true;
}

/** 生成 12 位长度的唯一 ID，用于导入时的临时关联映射 */
const uid = () => nanoid(12);

// ── Mock 数据容器（Web 或测试环境使用） ──
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

/**
 * 从旧版数据库（tutor_bill.db）迁移数据到新版表结构。
 * 读取旧版 students 和 lessons 表，转换后插入新版数据库。
 * 旧版使用扁平结构（subject/hourlyRate 直接挂在 student 表上），
 * 新版拆分为 student_subjects 表支持一学生多科。
 */
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
                      [s.name, s.phone || '', s.address || '', s.createdAt || now, now],
                      (_s: any, rStudent: any) => {
                        const newStudentId = rStudent.insertId;
                        ntx.executeSql(
                          'INSERT INTO student_subjects (studentId, subject, hourlyRate, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
                          [newStudentId, s.subject || '未分类', s.hourlyRate || 75, null, now, now],
                          (_sub: any, rSubject: any) => {
                            const newSubjectId = rSubject.insertId;
                            const sLessons = oldLessons.filter((l: any) => l.studentId === s.id);
                            for (const l of sLessons) {
                              const status: LessonStatus = l.paid ? 'paid' : (l.confirmedAt ? 'completed' : 'scheduled');
                              ntx.executeSql(
                                'INSERT INTO lessons (studentId, studentSubjectId, date, timeSlot, duration, amount, status, confirmedAt, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                [newStudentId, newSubjectId, l.date || '', l.timeSlot || '', l.duration || 1, l.amount || 0, status, l.confirmedAt, l.notes || '', l.createdAt || now, now]
                              );
                            }
                          }
                        );
                      }
                    );
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

// ── CRUD: Students ──────────────────────────────────────────────────────────
/** 添加学生，返回新记录的自增 ID */
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

/** 获取所有未被软删除的学生，按创建时间降序 */
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

/** 根据 ID 获取单个学生，不存在返回 null */
export const getStudentById = (id: number): Promise<Student | null> => {
  if (useMock) { const s = mockStudents.find(x => x.id === id && !x.deletedAt); return Promise.resolve(s ? { ...s } : null); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('SELECT * FROM students WHERE id=? AND deletedAt IS NULL', [id], (_: any, r: any) => {
        resolve(r.rows.length > 0 ? r.rows.item(0) : null);
      });
    }, (e: any) => reject(e));
  });
};

/** 更新学生信息（自动设置 updatedAt） */
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

/** 软删除学生（设置 deletedAt 而非真正删除） */
export const deleteStudent = (id: number): Promise<void> => {
  if (useMock) { const s = mockStudents.find(x => x.id === id); if (s) s.deletedAt = new Date().toISOString(); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('UPDATE students SET deletedAt=? WHERE id=?', [new Date().toISOString(), id], () => resolve());
    }, (e: any) => reject(e));
  });
};

// ── CRUD: Student Subjects ───────────────────────────────────────────────────
/** 添加学生科目，返回新记录的自增 ID */
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

/** 根据学生 ID 获取其所有科目（按创建时间升序） */
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

/** 更新科目信息 */
export const updateSubject = (sub: StudentSubject): Promise<void> => {
  if (useMock) { const i = mockSubjects.findIndex(x => x.id === sub.id); if (i >= 0) mockSubjects[i] = sub; return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('UPDATE student_subjects SET subject=?, hourlyRate=?, color=?, updatedAt=? WHERE id=?',
        [sub.subject, sub.hourlyRate, sub.color || null, new Date().toISOString(), sub.id], () => resolve());
    }, (e: any) => reject(e));
  });
};

/** 软删除科目 */
export const deleteSubject = (id: number): Promise<void> => {
  if (useMock) { const s = mockSubjects.find(x => x.id === id); if (s) s.deletedAt = new Date().toISOString(); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('UPDATE student_subjects SET deletedAt=? WHERE id=?', [new Date().toISOString(), id], () => resolve());
    }, (e: any) => reject(e));
  });
};

// ── CRUD: Rate History ───────────────────────────────────────────────────────
/** 添加调价记录 */
export const addRateHistory = (entry: Omit<RateHistory, 'id'>): Promise<void> => {
  if (useMock) { mockRateHistory.push({ id: mockIdCounter++, ...entry }); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('INSERT INTO rate_history (studentSubjectId, oldRate, newRate, changedAt) VALUES (?,?,?,?)',
        [entry.studentSubjectId, entry.oldRate, entry.newRate, entry.changedAt], () => resolve());
    }, (e: any) => reject(e));
  });
};

/** 根据科目 ID 获取调价历史（按时间降序） */
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

// ── CRUD: Lessons ────────────────────────────────────────────────────────────
/** 添加课程，返回新记录的自增 ID */
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

/** 获取所有未被软删除的课程，按日期降序 */
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

/** 根据学生 ID 获取该学生所有课程 */
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

/** 更新课程全部字段 */
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

/** 更新课程状态，completed 或 paid 时自动记录 confirmedAt */
export const setLessonStatus = (id: number, status: LessonStatus): Promise<void> => {
  const now = new Date().toISOString();
  const confirmedAt = (status === 'completed' || status === 'paid') ? now : undefined;
  if (useMock) {
    const l = mockLessons.find(x => x.id === id);
    if (l) { l.status = status; l.confirmedAt = confirmedAt || l.confirmedAt; l.updatedAt = now; }
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      if (confirmedAt !== undefined) {
        tx.executeSql('UPDATE lessons SET status=?, confirmedAt=?, updatedAt=? WHERE id=?',
          [status, confirmedAt, now, id], () => resolve());
      } else {
        tx.executeSql('UPDATE lessons SET status=?, updatedAt=? WHERE id=?',
          [status, now, id], () => resolve());
      }
    }, (e: any) => reject(e));
  });
};

/** 软删除课程 */
export const deleteLesson = (id: number): Promise<void> => {
  if (useMock) { const l = mockLessons.find(x => x.id === id); if (l) l.deletedAt = new Date().toISOString(); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('UPDATE lessons SET deletedAt=? WHERE id=?', [new Date().toISOString(), id], () => resolve());
    }, (e: any) => reject(e));
  });
};

// ── CRUD: Payments ───────────────────────────────────────────────────────────
/** 添加支付记录，返回新记录的自增 ID */
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

/** 根据课程 ID 获取该课程的所有支付记录 */
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

/** 软删除支付记录 */
export const deletePayment = (id: number): Promise<void> => {
  if (useMock) { const p = mockPayments.find(x => x.id === id); if (p) p.deletedAt = new Date().toISOString(); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('UPDATE payments SET deletedAt=? WHERE id=?', [new Date().toISOString(), id], () => resolve());
    }, (e: any) => reject(e));
  });
};

// ── CRUD: Recurring Rules ────────────────────────────────────────────────────
/** 添加重复排课规则，返回新记录的自增 ID */
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

/** 获取所有未被软删除的重复排课规则 */
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

/** 更新重复排课规则 */
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

/** 软删除重复排课规则 */
export const deleteRecurringRule = (id: number): Promise<void> => {
  if (useMock) { const r = mockRules.find(x => x.id === id); if (r) r.deletedAt = new Date().toISOString(); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql('UPDATE recurring_rules SET deletedAt=? WHERE id=?', [new Date().toISOString(), id], () => resolve());
    }, (e: any) => reject(e));
  });
};

// ── Seed mock data ────────────────────────────────────────────────────────────
/** 填充 3 个学生及其科目、15 条模拟课程（覆盖各种状态和日期） */
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
    const status: LessonStatus = i < 3 ? 'paid' : (i < 6 ? 'pendingPayment' : (i < 9 ? 'completed' : 'scheduled'));
    mockLessons.push({
      id: mockIdCounter++, studentId: student.id, studentSubjectId: subj.id,
      date: dates[i % dates.length], timeSlot: '14:00-16:00', duration: 2,
      amount: subj.hourlyRate * 2, status, confirmedAt: i < 9 ? now : null,
      notes: '', createdAt: now, _uuid: uid(),
    });
  }

  // ── 额外 10 条模拟课程（不同时段、金额、含备注） ──
  const extraStudents = [s1, s2, s3, s1, s2, s3, s1, s2, s3, s1];
  const extraSubjects = [sub1, sub2, sub3, sub1, sub2, sub3, sub1, sub2, sub3, sub1];
  const extraDates = ['2026-05-20', '2026-05-22', '2026-05-13', '2026-05-14', '2026-05-16', '2026-05-17', '2026-05-19', '2026-05-21', '2026-05-22', '2026-05-23'];
  const extraTimeSlots = ['08:00-10:00', '09:00-11:00', '10:00-12:00', '13:00-15:00', '14:00-16:00', '15:00-17:00', '16:00-18:00', '17:00-19:00', '18:00-20:00', '19:00-21:00'];
  const extraDurations = [2, 2.5, 1.5, 2, 3, 2, 2, 1.5, 2, 2];
  const extraNotes = ['复习三角函数', '单词听写练习', '牛顿定律习题', '', '完形填空专项', '电路分析', '', '化学方程式', '数列求和', '阅读理解'];
  for (let i = 0; i < 10; i++) {
    const student = extraStudents[i];
    const subj = extraSubjects[i];
    const status: LessonStatus = i < 4 ? 'scheduled' : (i < 6 ? 'completed' : (i < 8 ? 'pendingPayment' : 'paid'));
    mockLessons.push({
      id: mockIdCounter++, studentId: student.id, studentSubjectId: subj.id,
      date: extraDates[i], timeSlot: extraTimeSlots[i],
      duration: extraDurations[i], amount: Math.round(subj.hourlyRate * extraDurations[i]),
      status, confirmedAt: status !== 'scheduled' ? now : null,
      notes: extraNotes[i], createdAt: now, _uuid: uid(),
    });
  }
}

/** 向 SQLite 写入测试数据（学生 + 科目 + 课程 + 支付 + 周期规则） */
export const seedTestData = (): Promise<void> => {
  if (useMock) return Promise.resolve();
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      const now = new Date().toISOString();
      // ── 3 个学生 ──
      tx.executeSql("INSERT INTO students (name, phone, address, color, createdAt) VALUES ('张小明','13800138001','幸福小区3号楼201','#5B8DEF',?)", [now]);
      tx.executeSql("INSERT INTO students (name, phone, address, color, createdAt) VALUES ('李小红','13800138002','阳光花园5单元802','#FF8C6B',?)", [now]);
      tx.executeSql("INSERT INTO students (name, phone, color, createdAt) VALUES ('王大力','13800138003','#FF9500',?)", [now]);
      // ── 5 个科目 ──
      tx.executeSql("INSERT INTO student_subjects (studentId, subject, hourlyRate, color, createdAt) VALUES (1,'数学',150,'#5B8DEF',?)", [now]);
      tx.executeSql("INSERT INTO student_subjects (studentId, subject, hourlyRate, color, createdAt) VALUES (1,'物理',180,'#6366F1',?)", [now]);
      tx.executeSql("INSERT INTO student_subjects (studentId, subject, hourlyRate, color, createdAt) VALUES (2,'英语',200,'#FF8C6B',?)", [now]);
      tx.executeSql("INSERT INTO student_subjects (studentId, subject, hourlyRate, color, createdAt) VALUES (2,'化学',160,'#10B981',?)", [now]);
      tx.executeSql("INSERT INTO student_subjects (studentId, subject, hourlyRate, color, createdAt) VALUES (3,'数学',140,'#FF9500',?)", [now]);
      // ── 20 节课程 ──
      const lessons = [
        [1,1,'2026-05-03','09:00-11:00',2,300,'paid','二次函数复习'],
        [2,3,'2026-05-04','14:00-16:00',2,400,'paid','Unit 5 单词听写'],
        [3,5,'2026-05-05','10:00-12:00',2,280,'paid','有理数运算'],
        [1,2,'2026-05-06','15:00-17:00',2,360,'paid','牛顿定律习题'],
        [2,4,'2026-05-07','08:00-10:00',2,320,'paid','化学方程式配平'],
        [1,1,'2026-05-10','09:00-11:00',2,300,'pendingPayment',''],
        [2,3,'2026-05-11','14:00-16:30',2.5,500,'pendingPayment','阅读理解专项'],
        [3,5,'2026-05-12','10:00-12:00',2,280,'pendingPayment',''],
        [1,2,'2026-05-13','15:00-17:00',2,360,'pendingPayment','电路分析基础'],
        [2,4,'2026-05-14','08:00-10:30',2.5,400,'pendingPayment','氧化还原反应'],
        [1,1,'2026-05-15','09:00-11:00',2,300,'completed',''],
        [2,3,'2026-05-16','14:00-16:00',2,400,'completed','完形填空'],
        [3,5,'2026-05-17','10:00-11:30',1.5,210,'completed',''],
        [1,2,'2026-05-18','15:00-17:00',2,360,'completed','光的折射与反射'],
        [2,4,'2026-05-19','08:00-10:00',2,320,'completed',''],
        [1,1,'2026-05-22','09:00-11:00',2,300,'scheduled','概率初步'],
        [2,3,'2026-05-23','14:00-16:00',2,400,'scheduled',''],
        [3,5,'2026-05-24','10:00-12:00',2,280,'scheduled','几何证明练习'],
        [1,2,'2026-05-25','15:00-17:00',2,360,'scheduled',''],
        [2,3,'2026-05-26','09:00-11:30',2.5,500,'scheduled','作文辅导'],
      ];
      for (const l of lessons) {
        const confAt = l[6]==='paid'||l[6]==='completed'?now:null;
        tx.executeSql('INSERT INTO lessons (studentId,studentSubjectId,date,timeSlot,duration,amount,status,confirmedAt,notes,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?)',
          [l[0],l[1],l[2],l[3],l[4],l[5],l[6],confAt,l[7],now]);
      }
      // ── 5 条支付记录 ──
      for (let i = 1; i <= 5; i++) {
        tx.executeSql("INSERT INTO payments (lessonId,amount,method,paidAt,createdAt) VALUES (?,"+[300,400,280,360,320][i-1]+",'wechat',?,?)",[i,now,now]);
      }
      // ── 2 条周期规则 ──
      tx.executeSql("INSERT INTO recurring_rules (studentId,studentSubjectId,weekdays,interval,timeSlot,duration,amount,startDate,notes,createdAt) VALUES(1,1,'[1,3,5]',1,'09:00-11:00',2,300,'2026-06-01','每周一三五数学',?)",[now]);
      tx.executeSql("INSERT INTO recurring_rules (studentId,studentSubjectId,weekdays,interval,timeSlot,duration,startDate,endDate,notes,createdAt) VALUES(2,3,'[2,4]',1,'14:00-16:00',2,'2026-06-01','2026-08-31','暑假班每周二四',?)",[now]);
    }, (e: any) => reject(e), () => resolve());
  });
};
