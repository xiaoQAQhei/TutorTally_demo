import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllStudents, getSubjectsByStudentId, getAllLessons } from '../database';
import { Student, StudentSubject, Lesson } from '../models';

const STATUS_LABEL: Record<string, string> = {
  scheduled: '待上课',
  completed: '确认下课',
  pendingPayment: '待收款',
  paid: '✓ 已收款',
  cancelled: '已取消',
};

function safeSheetName(name: string): string {
  return name.replace(/[\\\/\*\?\[\]:]/g, '-').slice(0, 31);
}

function buildLessonRows(lessons: Lesson[], subjects: StudentSubject[]) {
  const sorted = [...lessons].sort((a, b) =>
    a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot)
  );

  let totalHours = 0, totalAmount = 0, paidAmount = 0;
  const rows: string[][] = [];

  for (const l of sorted) {
    const sub = subjects.find(s => s.id === l.studentSubjectId);
    totalHours += l.duration;
    totalAmount += l.amount;
    if (l.status === 'paid') paidAmount += l.amount;

    rows.push([
      l.date,
      sub?.subject || '',
      l.timeSlot,
      `${l.duration}h`,
      `${l.amount}元`,
      STATUS_LABEL[l.status] || l.status,
      l.notes || '',
    ]);
  }

  return { rows, totalHours, totalAmount, paidAmount };
}

function buildStudentSheet(student: Student, subjects: StudentSubject[], lessons: Lesson[]) {
  const subjectInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');
  const { rows, totalHours, totalAmount, paidAmount } = buildLessonRows(lessons, subjects);

  const sheet: (string | number)[][] = [];

  sheet.push(['家教课程账单']);
  sheet.push([`学生: ${student.name}    ${student.phone ? `电话: ${student.phone}    ` : ''} ${subjectInfo}`]);
  sheet.push([]);
  sheet.push(['日期', '学科', '时间段', '时长', '金额', '状态', '备注']);

  for (const row of rows) {
    sheet.push(row);
  }

  sheet.push([]);
  sheet.push([
    `合计: ${lessons.length}节课`, '', '',
    `${totalHours.toFixed(1)}h`, `${totalAmount}元`,
    `已收 ${paidAmount}元 / 待收 ${totalAmount - paidAmount}元`, '',
  ]);

  return sheet;
}

export async function exportAllToExcel(): Promise<string> {
  const students = await getAllStudents();
  const allLessons = await getAllLessons();

  const wb = XLSX.utils.book_new();

  for (const student of students) {
    const subjects = await getSubjectsByStudentId(student.id);
    const sLessons = allLessons.filter(l => l.studentId === student.id);

    const sheetData = buildStudentSheet(student, subjects, sLessons);
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(student.name));
  }

  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const path = FileSystem.documentDirectory + `家教账单_全部_${new Date().toISOString().split('T')[0]}.xlsx`;
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(path, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: '导出全部账单',
  });
  return path;
}

export async function exportByMonth(month: string): Promise<string> {
  const allStudents = await getAllStudents();
  const allLessons = await getAllLessons();
  const monthLessons = allLessons.filter(l => l.date.startsWith(month));
  const studentIds = [...new Set(monthLessons.map(l => l.studentId))];
  const students = allStudents.filter(s => studentIds.includes(s.id));

  const [y, m] = month.split('-');
  const title = `${y}年${parseInt(m, 10)}月 课程账单`;

  let monthTotal = 0, monthPaid = 0, monthHours = 0, monthLessonsCount = 0;

  const sheet: (string | number)[][] = [];
  sheet.push([title]);
  sheet.push([]);

  for (const student of students) {
    const subjects = await getSubjectsByStudentId(student.id);
    const sLessons = monthLessons.filter(l => l.studentId === student.id);
    const data = buildLessonRows(sLessons, subjects);

    monthLessonsCount += sLessons.length;
    monthHours += data.totalHours;
    monthTotal += data.totalAmount;
    monthPaid += data.paidAmount;

    const subjectInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');
    sheet.push([`${student.name}  ·  ${subjectInfo}`]);
    sheet.push(['日期', '学科', '时间段', '时长', '金额', '状态', '备注']);

    for (const row of data.rows) {
      sheet.push(row);
    }
    sheet.push([
      `小计: ${sLessons.length}节  ${data.totalHours.toFixed(1)}h  ${data.totalAmount}元`,
      '', '', '', '', '', '',
    ]);
    sheet.push([]);
  }

  sheet.push([
    `总计: ${monthLessonsCount}节课 | ${monthHours.toFixed(1)}h | ${monthTotal}元 | 已收 ${monthPaid}元 | 待收 ${monthTotal - monthPaid}元`,
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheet);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(title));

  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const path = FileSystem.documentDirectory + `家教账单_${month}.xlsx`;
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(path, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: `导出 ${month} 账单`,
  });
  return path;
}

export async function exportByStudent(studentId: number): Promise<string> {
  const students = await getAllStudents();
  const student = students.find(s => s.id === studentId);
  if (!student) throw new Error('学生不存在');

  const subjects = await getSubjectsByStudentId(studentId);
  const allLessons = await getAllLessons();
  const sLessons = allLessons.filter(l => l.studentId === studentId);

  const wb = XLSX.utils.book_new();
  const sheetData = buildStudentSheet(student, subjects, sLessons);
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(student.name));

  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const path = FileSystem.documentDirectory + `家教账单_${student.name}.xlsx`;
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(path, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: `导出 ${student.name} 账单`,
  });
  return path;
}
