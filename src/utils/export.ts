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
  paid: '✓ 已收款',
  cancelled: '已取消',
};

const PAID_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD1FAE5' } };

function safeSheetName(name: string): string {
  return name.replace(/[\\\/\*\?\[\]:]/g, '-').slice(0, 31);
}

interface LessonRowData {
  values: string[];
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
      values: [
        l.date,
        sub?.subject || '',
        l.timeSlot,
        `${l.duration}h`,
        `${l.amount}元`,
        STATUS_LABEL[l.status] || l.status,
        l.notes || '',
      ],
      isPaid: l.status === 'paid',
    });
  }

  return { rows, totalHours, totalAmount, paidAmount };
}

function writeDataRow(sheet: ExcelJS.Worksheet, rowIdx: number, row: LessonRowData) {
  row.values.forEach((v, i) => {
    const cell = sheet.getRow(rowIdx).getCell(i + 1);
    cell.value = v;
    if (row.isPaid) cell.fill = PAID_FILL;
  });
}

function setRowValues(sheet: ExcelJS.Worksheet, rowIdx: number, values: string[]) {
  const row = sheet.getRow(rowIdx);
  values.forEach((v, i) => {
    row.getCell(i + 1).value = v;
  });
}

function addStudentSheet(wb: ExcelJS.Workbook, student: Student, subjects: StudentSubject[], lessons: Lesson[]) {
  const sheet = wb.addWorksheet(safeSheetName(student.name));
  const subjectInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');

  // Row 1: title
  const t = sheet.getCell('A1');
  t.value = '家教课程账单';

  // Row 2: info
  const info = sheet.getCell('A2');
  info.value = `学生: ${student.name}    ${student.phone ? `电话: ${student.phone}    ` : ''} ${subjectInfo}`;

  // Row 4: headers (row 3 is blank)
  ['日期', '学科', '时间段', '时长', '金额', '状态', '备注'].forEach((h, i) => {
    sheet.getRow(4).getCell(i + 1).value = h;
  });

  // Data rows (starting row 5)
  const { rows, totalHours, totalAmount, paidAmount } = buildLessonRows(lessons, subjects);
  rows.forEach((r, i) => writeDataRow(sheet, 5 + i, r));

  // Summary row (center-aligned, no merged cells)
  const sr = 5 + rows.length + 1;
  const sv = [
    `合计: ${lessons.length}节课`, '', '',
    `${totalHours.toFixed(1)}h`, `${totalAmount}元`,
    `已收 ${paidAmount}元 / 待收 ${totalAmount - paidAmount}元`, '',
  ];
  sv.forEach((v, i) => {
    const cell = sheet.getRow(sr).getCell(i + 1);
    cell.value = v;
    cell.alignment = { horizontal: 'center' };
  });
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

  // Row 1: title
  const titleCell = sheet.getCell(`A${r}`);
  titleCell.value = title;
  r += 2; // row 2 blank

  let mTotal = 0, mPaid = 0, mHours = 0, mLessons = 0;

  for (const student of students) {
    const subjects = await getSubjectsByStudentId(student.id);
    const sLessons = monthLessons.filter(l => l.studentId === student.id);
    if (sLessons.length === 0) continue;

    const data = buildLessonRows(sLessons, subjects);

    mLessons += sLessons.length;
    mHours += data.totalHours;
    mTotal += data.totalAmount;
    mPaid += data.paidAmount;

    // Student header — bold
    const subInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');
    const nameCell = sheet.getCell(`A${r}`);
    nameCell.value = `${student.name}  ·  ${subInfo}`;
    nameCell.font = { bold: true, size: 11 };
    r++;

    // Table headers
    ['日期', '学科', '时间段', '时长', '金额', '状态', '备注'].forEach((h, i) => {
      sheet.getRow(r).getCell(i + 1).value = h;
    });
    r++;

    // Data rows (green fill on paid)
    data.rows.forEach(row => { writeDataRow(sheet, r, row); r++; });

    // Subtotal — center-aligned
    const ssv = [`小计: ${sLessons.length}节  ${data.totalHours.toFixed(1)}h  ${data.totalAmount}元`, '', '', '', '', '', ''];
    ssv.forEach((v, i) => {
      const cell = sheet.getRow(r).getCell(i + 1);
      cell.value = v;
      cell.alignment = { horizontal: 'center' };
    });
    r += 2; // blank row
  }

  // Grand total — center-aligned
  const gtv = [`总计: ${mLessons}节课 | ${mHours.toFixed(1)}h | ${mTotal}元 | 已收 ${mPaid}元 | 待收 ${mTotal - mPaid}元`];
  gtv.forEach((v, i) => {
    const cell = sheet.getRow(r).getCell(i + 1);
    cell.value = v;
    cell.alignment = { horizontal: 'center' };
  });

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
