import { Student, Lesson, Payment } from '../models';

let db: any = null;
let useMock = false;

try {
  const SQLite = require('expo-sqlite');
  db = SQLite.openDatabase('tutor_bill.db');
} catch (e) {
  useMock = true;
}

const mockStudents: Student[] = [];
const mockLessons: Lesson[] = [];
const mockPayments: Payment[] = [];
let mockIdCounter = 1;

export const initDatabase = (): Promise<void> => {
  if (useMock) return Promise.resolve();
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            subject TEXT NOT NULL,
            hourlyRate REAL NOT NULL,
            phone TEXT,
            createdAt TEXT NOT NULL
          )`
        );
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            studentId INTEGER NOT NULL,
            date TEXT NOT NULL,
            duration REAL NOT NULL,
            amount REAL NOT NULL,
            paid INTEGER NOT NULL DEFAULT 0,
            notes TEXT,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (studentId) REFERENCES students(id)
          )`
        );
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lessonId INTEGER NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            method TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (lessonId) REFERENCES lessons(id)
          )`
        );
      },
      (error: any) => {
        reject(error);
      },
      () => {
        resolve();
      }
    );
  });
};

export const addStudent = (student: Omit<Student, 'id'>): Promise<number> => {
  if (useMock) {
    const newStudent: Student = { id: mockIdCounter++, ...student };
    mockStudents.push(newStudent);
    return Promise.resolve(newStudent.id);
  }
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          'INSERT INTO students (name, subject, hourlyRate, phone, createdAt) VALUES (?, ?, ?, ?, ?)',
          [student.name, student.subject, student.hourlyRate, student.phone, student.createdAt],
          (_: any, result: any) => {
            resolve(result.insertId);
          }
        );
      },
      (error: any) => {
        reject(error);
      }
    );
  });
};

export const getAllStudents = (): Promise<Student[]> => {
  if (useMock) return Promise.resolve([...mockStudents]);
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          'SELECT * FROM students ORDER BY createdAt DESC',
          [],
          (_: any, result: any) => {
            const students: Student[] = [];
            for (let i = 0; i < result.rows.length; i++) {
              students.push(result.rows.item(i));
            }
            resolve(students);
          }
        );
      },
      (error: any) => {
        reject(error);
      }
    );
  });
};

export const getStudentById = (id: number): Promise<Student | null> => {
  if (useMock) {
    const s = mockStudents.find((s) => s.id === id) || null;
    return Promise.resolve(s);
  }
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          'SELECT * FROM students WHERE id = ?',
          [id],
          (_: any, result: any) => {
            if (result.rows.length > 0) {
              resolve(result.rows.item(0));
            } else {
              resolve(null);
            }
          }
        );
      },
      (error: any) => {
        reject(error);
      }
    );
  });
};

export const updateStudent = (student: Student): Promise<void> => {
  if (useMock) {
    const idx = mockStudents.findIndex((s) => s.id === student.id);
    if (idx !== -1) mockStudents[idx] = { ...student };
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          'UPDATE students SET name = ?, subject = ?, hourlyRate = ?, phone = ? WHERE id = ?',
          [student.name, student.subject, student.hourlyRate, student.phone, student.id],
          () => {
            resolve();
          }
        );
      },
      (error: any) => {
        reject(error);
      }
    );
  });
};

export const deleteStudent = (id: number): Promise<void> => {
  if (useMock) {
    const sIdx = mockStudents.findIndex((s) => s.id === id);
    if (sIdx !== -1) mockStudents.splice(sIdx, 1);
    for (let i = mockLessons.length - 1; i >= 0; i--) {
      if (mockLessons[i].studentId === id) mockLessons.splice(i, 1);
    }
    for (let i = mockPayments.length - 1; i >= 0; i--) {
      const lesson = mockLessons.find((l) => l.id === mockPayments[i].lessonId);
      if (!lesson) mockPayments.splice(i, 1);
    }
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql('DELETE FROM payments WHERE lessonId IN (SELECT id FROM lessons WHERE studentId = ?)', [id]);
        tx.executeSql('DELETE FROM lessons WHERE studentId = ?', [id]);
        tx.executeSql('DELETE FROM students WHERE id = ?', [id], () => {
          resolve();
        });
      },
      (error: any) => {
        reject(error);
      }
    );
  });
};

export const addLesson = (lesson: Omit<Lesson, 'id'>): Promise<number> => {
  if (useMock) {
    const newLesson: Lesson = { id: mockIdCounter++, ...lesson };
    mockLessons.push(newLesson);
    return Promise.resolve(newLesson.id);
  }
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          'INSERT INTO lessons (studentId, date, duration, amount, paid, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [lesson.studentId, lesson.date, lesson.duration, lesson.amount, lesson.paid ? 1 : 0, lesson.notes, lesson.createdAt],
          (_: any, result: any) => {
            resolve(result.insertId);
          }
        );
      },
      (error: any) => {
        reject(error);
      }
    );
  });
};

export const getAllLessons = (): Promise<Lesson[]> => {
  if (useMock) return Promise.resolve([...mockLessons].reverse());
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          'SELECT * FROM lessons ORDER BY date DESC',
          [],
          (_: any, result: any) => {
            const lessons: Lesson[] = [];
            for (let i = 0; i < result.rows.length; i++) {
              const lesson = result.rows.item(i);
              lessons.push({ ...lesson, paid: lesson.paid === 1 });
            }
            resolve(lessons);
          }
        );
      },
      (error: any) => {
        reject(error);
      }
    );
  });
};

export const getLessonsByStudentId = (studentId: number): Promise<Lesson[]> => {
  if (useMock) {
    const filtered = mockLessons.filter((l) => l.studentId === studentId).reverse();
    return Promise.resolve(filtered);
  }
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          'SELECT * FROM lessons WHERE studentId = ? ORDER BY date DESC',
          [studentId],
          (_: any, result: any) => {
            const lessons: Lesson[] = [];
            for (let i = 0; i < result.rows.length; i++) {
              const lesson = result.rows.item(i);
              lessons.push({ ...lesson, paid: lesson.paid === 1 });
            }
            resolve(lessons);
          }
        );
      },
      (error: any) => {
        reject(error);
      }
    );
  });
};

export const updateLesson = (lesson: Lesson): Promise<void> => {
  if (useMock) {
    const idx = mockLessons.findIndex((l) => l.id === lesson.id);
    if (idx !== -1) mockLessons[idx] = { ...lesson };
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          'UPDATE lessons SET date = ?, duration = ?, amount = ?, paid = ?, notes = ? WHERE id = ?',
          [lesson.date, lesson.duration, lesson.amount, lesson.paid ? 1 : 0, lesson.notes, lesson.id],
          () => {
            resolve();
          }
        );
      },
      (error: any) => {
        reject(error);
      }
    );
  });
};

export const deleteLesson = (id: number): Promise<void> => {
  if (useMock) {
    const idx = mockLessons.findIndex((l) => l.id === id);
    if (idx !== -1) mockLessons.splice(idx, 1);
    for (let i = mockPayments.length - 1; i >= 0; i--) {
      if (mockPayments[i].lessonId === id) mockPayments.splice(i, 1);
    }
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql('DELETE FROM payments WHERE lessonId = ?', [id]);
        tx.executeSql('DELETE FROM lessons WHERE id = ?', [id], () => {
          resolve();
        });
      },
      (error: any) => {
        reject(error);
      }
    );
  });
};

export const toggleLessonPaid = (id: number, paid: boolean): Promise<void> => {
  if (useMock) {
    const lesson = mockLessons.find((l) => l.id === id);
    if (lesson) lesson.paid = paid;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          'UPDATE lessons SET paid = ? WHERE id = ?',
          [paid ? 1 : 0, id],
          () => {
            resolve();
          }
        );
      },
      (error: any) => {
        reject(error);
      }
    );
  });
};

export const addPayment = (payment: Omit<Payment, 'id'>): Promise<number> => {
  if (useMock) {
    const newPayment: Payment = { id: mockIdCounter++, ...payment };
    mockPayments.push(newPayment);
    return Promise.resolve(newPayment.id);
  }
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          'INSERT INTO payments (lessonId, amount, date, method, createdAt) VALUES (?, ?, ?, ?, ?)',
          [payment.lessonId, payment.amount, payment.date, payment.method, payment.createdAt],
          (_: any, result: any) => {
            resolve(result.insertId);
          }
        );
      },
      (error: any) => {
        reject(error);
      }
    );
  });
};

export const getPaymentsByLessonId = (lessonId: number): Promise<Payment[]> => {
  if (useMock) {
    const filtered = mockPayments.filter((p) => p.lessonId === lessonId).reverse();
    return Promise.resolve(filtered);
  }
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          'SELECT * FROM payments WHERE lessonId = ? ORDER BY date DESC',
          [lessonId],
          (_: any, result: any) => {
            const payments: Payment[] = [];
            for (let i = 0; i < result.rows.length; i++) {
              payments.push(result.rows.item(i));
            }
            resolve(payments);
          }
        );
      },
      (error: any) => {
        reject(error);
      }
    );
  });
};
