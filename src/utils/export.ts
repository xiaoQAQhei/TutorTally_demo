import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllStudents, getSubjectsByStudentId, getAllLessons } from '../database';
import { Student, StudentSubject, Lesson } from '../models';

// Buffer polyfill for ExcelJS in React Native
if (typeof global !== 'undefined') {
  (global as any).Buffer = (global as any).Buffer || Buffer;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: '待上课',
  completed: '确认下课',
  pendingPayment: '待收款',
  paid: '已收款',
  cancelled: '已取消',
};

const COL_WIDTHS = [14, 10, 16, 10, 12, 16, 18];

function safeSheetName(name: string): string {
  return name.replace(/[\\\/\*\?\[\]:]/g, '-').slice(0, 31);
}

interface LessonRowData {
  date: string;
  subject: string;
  timeSlot: string;
  duration: string;
  amount: string;
  status: string;
  notes: string;
  isPaid: boolean;
}

function buildLessonRows(lessons: Lesson[], subjects: StudentSubject[]): {
  rows: LessonRowData[];
  totalHours: number;
  totalAmount: number;
  paidAmount: number;
} {
  const sorted = [...lessons].sort((a, b) =>
    a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot)
  );

  let totalHours = 0, totalAmount = 0, paidAmount = 0;
  const rows: LessonRowData[] = [];

  for (const l of sorted) {
    const sub = subjects.find(s => s.id === l.studentSubjectId);
    totalHours += l.duration;
    totalAmount += l.amount;
    if (l.status === 'paid') paidAmount += l.amount;

    rows.push({
      date: l.date,
      subject: sub?.subject || '',
      timeSlot: l.timeSlot,
      duration: `${l.duration}h`,
      amount: `${l.amount}元`,
      status: STATUS_LABEL[l.status] || l.status,
      notes: l.notes || '',
      isPaid: l.status === 'paid',
    });
  }

  return { rows, totalHours, totalAmount, paidAmount };
}

function addStudentSheet(
  workbook: ExcelJS.Workbook,
  student: Student,
  subjects: StudentSubject[],
  lessons: Lesson[]
) {
  const sheet = workbook.addWorksheet(safeSheetName(student.name));
  sheet.columns = COL_WIDTHS.map(w => ({ width: w }));

  const subjectInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');

  // Title row
  const titleCell = sheet.getCell('A1');
  titleCell.value = '家教课程账单';
  titleCell.font = { bold: true, size: 14 };

  // Info row
  const infoCell = sheet.getCell('A2');
  infoCell.value = `学生: ${student.name}    ${student.phone ? `电话: ${student.phone}    ` : ''} ${subjectInfo}`;
  infoCell.font = { size: 11, color: { argb: 'FF4A4A6A' } };

  // Header row (row 4)
  const headers = ['日期', '学科', '时间段', '时长', '金额', '状态', '备注'];
  const headerRow = sheet.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 11 };
    cell.alignment = { horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  });

  // Lesson rows (starting row 5)
  const { rows, totalHours, totalAmount, paidAmount } = buildLessonRows(lessons, subjects);
  rows.forEach((r, ri) => {
    const excelRow = sheet.getRow(5 + ri);
    const values = [r.date, r.subject, r.timeSlot, r.duration, r.amount, r.status, r.notes];
    values.forEach((v, ci) => {
      const cell = excelRow.getCell(ci + 1);
      cell.value = v;
      cell.alignment = { horizontal: 'center' };
      if (r.isPaid) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      }
    });
  });

  // Summary row
  const summaryRowIdx = 5 + rows.length + 1;
  const summaryCell = sheet.getCell(`A${summaryRowIdx}`);
  summaryCell.value = `合计: ${lessons.length}节课    ${totalHours.toFixed(1)}h    ${totalAmount}元    已收 ${paidAmount}元 / 待收 ${totalAmount - paidAmount}元`;
  summaryCell.font = { bold: true, size: 11 };
  sheet.mergeCells(`A${summaryRowIdx}:G${summaryRowIdx}`);
}

export async function exportAllToExcel(): Promise<string> {
  const students = await getAllStudents();
  const allLessons = await getAllLessons();

  const workbook = new ExcelJS.Workbook();

  for (const student of students) {
    const subjects = await getSubjectsByStudentId(student.id);
    const sLessons = allLessons.filter(l => l.studentId === student.id);
    addStudentSheet(workbook, student, subjects, sLessons);
  }

  const buf = await workbook.xlsx.writeBuffer();
  const b64 = Buffer.from(buf).toString('base64');
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

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(safeSheetName(title));
  sheet.columns = COL_WIDTHS.map(w => ({ width: w }));

  let rowIdx = 1;

  // Title
  const titleCell = sheet.getCell(`A${rowIdx}`);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14 };
  rowIdx += 2;

  let monthTotal = 0, monthPaid = 0, monthHours = 0, monthLessonsCount = 0;

  for (const student of students) {
    const subjects = await getSubjectsByStudentId(student.id);
    const sLessons = monthLessons.filter(l => l.studentId === student.id);
    const data = buildLessonRows(sLessons, subjects);

    monthLessonsCount += sLessons.length;
    monthHours += data.totalHours;
    monthTotal += data.totalAmount;
    monthPaid += data.paidAmount;

    // Student header
    const subInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');
    const stuCell = sheet.getCell(`A${rowIdx}`);
    stuCell.value = `${student.name}  ·  ${subInfo}`;
    stuCell.font = { bold: true, size: 11, color: { argb: 'FF6366F1' } };
    rowIdx++;

    // Table headers
    const headers = ['日期', '学科', '时间段', '时长', '金额', '状态', '备注'];
    const headerRow = sheet.getRow(rowIdx);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 11 };
      cell.alignment = { horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
    rowIdx++;

    // Data rows
    for (const r of data.rows) {
      const excelRow = sheet.getRow(rowIdx);
      const values = [r.date, r.subject, r.timeSlot, r.duration, r.amount, r.status, r.notes];
      values.forEach((v, ci) => {
        const cell = excelRow.getCell(ci + 1);
        cell.value = v;
        cell.alignment = { horizontal: 'center' };
        if (r.isPaid) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        }
      });
      rowIdx++;
    }

    // Subtotal
    const subtotalCell = sheet.getCell(`A${rowIdx}`);
    subtotalCell.value = `小计: ${sLessons.length}节  ${data.totalHours.toFixed(1)}h  ${data.totalAmount}元`;
    subtotalCell.font = { bold: true, size: 11 };
    sheet.mergeCells(`A${rowIdx}:G${rowIdx}`);
    rowIdx++;
    rowIdx++; // blank row
  }

  // Grand total
  const totalCell = sheet.getCell(`A${rowIdx}`);
  totalCell.value = `总计: ${monthLessonsCount}节课 | ${monthHours.toFixed(1)}h | ${monthTotal}元 | 已收 ${monthPaid}元 | 待收 ${monthTotal - monthPaid}元`;
  totalCell.font = { bold: true, size: 12 };
  sheet.mergeCells(`A${rowIdx}:G${rowIdx}`);

  const buf = await workbook.xlsx.writeBuffer();
  const b64 = Buffer.from(buf).toString('base64');
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

  const workbook = new ExcelJS.Workbook();
  addStudentSheet(workbook, student, subjects, sLessons);

  const buf = await workbook.xlsx.writeBuffer();
  const b64 = Buffer.from(buf).toString('base64');
  const path = FileSystem.documentDirectory + `家教账单_${student.name}.xlsx`;
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(path, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: `导出 ${student.name} 账单`,
  });
  return path;
}
