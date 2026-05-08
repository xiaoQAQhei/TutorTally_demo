import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllStudents, getSubjectsByStudentId, getAllLessons } from '../database';
import { Student, StudentSubject, Lesson } from '../models';

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

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF8FAFC' } };
const PAID_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD1FAE5' } };
const HEADERS = ['日期', '学科', '时间段', '时长', '金额', '状态', '备注'];

function safeSheetName(name: string): string {
  return name.replace(/[\\\/\*\?\[\]:]/g, '-').slice(0, 31);
}

function setCell(cell: ExcelJS.Cell, value: string, opts?: { bold?: boolean; fill?: typeof PAID_FILL; color?: string }) {
  cell.value = value;
  cell.alignment = { horizontal: 'center' };
  if (opts?.bold) cell.font = { bold: true, size: 11 };
  if (opts?.fill) cell.fill = opts.fill;
  if (opts?.color) cell.font = { color: { argb: opts.color }, size: 11 };
}

function setRow(sheet: ExcelJS.Worksheet, rowIdx: number, values: string[], opts?: { bold?: boolean; fill?: typeof PAID_FILL }) {
  const row = sheet.getRow(rowIdx);
  values.forEach((v, i) => {
    const cell = row.getCell(i + 1);
    cell.value = v;
    cell.alignment = { horizontal: 'center' };
    if (opts?.bold) cell.font = { bold: true, size: 11 };
    if (opts?.fill) cell.fill = opts.fill;
  });
}

interface LessonRow {
  values: string[];
  isPaid: boolean;
}

function buildLessonRows(lessons: Lesson[], subjects: StudentSubject[]): {
  rows: LessonRow[];
  totalHours: number;
  totalAmount: number;
  paidAmount: number;
} {
  const sorted = [...lessons].sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot));
  let totalHours = 0, totalAmount = 0, paidAmount = 0;
  const rows: LessonRow[] = [];

  for (const l of sorted) {
    const sub = subjects.find(s => s.id === l.studentSubjectId);
    totalHours += l.duration;
    totalAmount += l.amount;
    if (l.status === 'paid') paidAmount += l.amount;

    rows.push({
      values: [l.date, sub?.subject || '', l.timeSlot, `${l.duration}h`, `${l.amount}元`, STATUS_LABEL[l.status] || l.status, l.notes || ''],
      isPaid: l.status === 'paid',
    });
  }

  return { rows, totalHours, totalAmount, paidAmount };
}

function writeHeaderRow(sheet: ExcelJS.Worksheet, rowIdx: number) {
  const row = sheet.getRow(rowIdx);
  HEADERS.forEach((h, i) => {
    const cell = row.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 11 };
    cell.alignment = { horizontal: 'center' };
    cell.fill = HEADER_FILL;
  });
}

function writeDataRow(sheet: ExcelJS.Worksheet, rowIdx: number, row: LessonRow) {
  row.values.forEach((v, i) => {
    const cell = sheet.getRow(rowIdx).getCell(i + 1);
    cell.value = v;
    cell.alignment = { horizontal: 'center' };
    if (row.isPaid) cell.fill = PAID_FILL;
  });
}

function writeSummaryRow(sheet: ExcelJS.Worksheet, rowIdx: number, lessons: number, hours: number, amount: number, paid: number) {
  setRow(sheet, rowIdx, [
    `合计: ${lessons}节课`, '', '',
    `${hours.toFixed(1)}h`, `${amount}元`,
    `已收 ${paid}元 / 待收 ${amount - paid}元`, '',
  ], { bold: true });
}

function addStudentSheet(wb: ExcelJS.Workbook, student: Student, subjects: StudentSubject[], lessons: Lesson[]) {
  const sheet = wb.addWorksheet(safeSheetName(student.name));
  const subjectInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');

  // Row 1-2: title & info
  setCell(sheet.getCell('A1'), '家教课程账单', { bold: true });
  sheet.getCell('A1').font = { bold: true, size: 14 };
  setCell(sheet.getCell('A2'), `学生: ${student.name}    ${student.phone ? `电话: ${student.phone}    ` : ''} ${subjectInfo}`);

  // Row 3: blank
  // Row 4: header
  writeHeaderRow(sheet, 4);

  // Data rows (starting row 5)
  const { rows, totalHours, totalAmount, paidAmount } = buildLessonRows(lessons, subjects);
  rows.forEach((r, i) => writeDataRow(sheet, 5 + i, r));

  // Summary row
  const sr = 5 + rows.length + 1;
  writeSummaryRow(sheet, sr, lessons.length, totalHours, totalAmount, paidAmount);
}

export async function exportAllToExcel(): Promise<string> {
  const students = await getAllStudents();
  const allLessons = await getAllLessons();
  const wb = new ExcelJS.Workbook();

  for (const student of students) {
    const subjects = await getSubjectsByStudentId(student.id);
    const sLessons = allLessons.filter(l => l.studentId === student.id);
    addStudentSheet(wb, student, subjects, sLessons);
  }

  const buf = await wb.xlsx.writeBuffer();
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
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(safeSheetName(title));

  let r = 1;
  const titleCell = sheet.getCell(`A${r}`); titleCell.value = title; titleCell.font = { bold: true, size: 14 };
  r += 2;

  let mTotal = 0, mPaid = 0, mHours = 0, mLessons = 0;

  for (const student of students) {
    const subjects = await getSubjectsByStudentId(student.id);
    const sLessons = monthLessons.filter(l => l.studentId === student.id);
    const data = buildLessonRows(sLessons, subjects);

    mLessons += sLessons.length; mHours += data.totalHours; mTotal += data.totalAmount; mPaid += data.paidAmount;

    // Student header
    const subInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');
    setCell(sheet.getCell(`A${r}`), `${student.name}  ·  ${subInfo}`, { bold: true, color: 'FF6366F1' });
    r++;

    // Table header
    writeHeaderRow(sheet, r);
    r++;

    // Data
    data.rows.forEach(row => { writeDataRow(sheet, r, row); r++; });

    // Subtotal
    setRow(sheet, r, [
      `小计: ${sLessons.length}节`, '', '',
      `${data.totalHours.toFixed(1)}h`, `${data.totalAmount}元`, '', '',
    ], { bold: true });
    r += 2;
  }

  // Grand total
  setRow(sheet, r, [
    `总计: ${mLessons}节课`, '', '',
    `${mHours.toFixed(1)}h`, `${mTotal}元`,
    `已收 ${mPaid}元`, `待收 ${mTotal - mPaid}元`,
  ], { bold: true });

  const buf = await wb.xlsx.writeBuffer();
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

  const wb = new ExcelJS.Workbook();
  addStudentSheet(wb, student, subjects, sLessons);

  const buf = await wb.xlsx.writeBuffer();
  const b64 = Buffer.from(buf).toString('base64');
  const path = FileSystem.documentDirectory + `家教账单_${student.name}.xlsx`;
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(path, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: `导出 ${student.name} 账单`,
  });
  return path;
}
