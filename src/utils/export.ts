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
  for (const s of students) {
    subjects.push(...(await getSubjectsByStudentId(s.id)));
  }
  const lessons = await getAllLessons();
  const payments: Payment[] = [];
  for (const l of lessons) {
    payments.push(...(await getPaymentsByLessonId(l.id)));
  }
  const rules = await getAllRecurringRules();
  const rateHistory: RateHistory[] = [];
  for (const sub of subjects) {
    rateHistory.push(...(await getRateHistoryBySubjectId(sub.id)));
  }

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
  for (const s of students) {
    subjects.push(...(await getSubjectsByStudentId(s.id)));
  }
  const payments: Payment[] = [];
  for (const l of monthLessons) {
    payments.push(...(await getPaymentsByLessonId(l.id)));
  }

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
  for (const l of sLessons) {
    payments.push(...(await getPaymentsByLessonId(l.id)));
  }
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
