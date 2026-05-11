import * as XLSX from 'xlsx-js-style';
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

const PAID_STYLE = { fill: { fgColor: { rgb: 'D1FAE5' }, patternType: 'solid' as const } };
const PENDING_STYLE = { fill: { fgColor: { rgb: 'FEF3C7' }, patternType: 'solid' as const } };
const CENTER_STYLE = { alignment: { horizontal: 'center' as const } };
const BOLD_STYLE = { font: { bold: true } };
const BOLD14_STYLE = { font: { bold: true, sz: 14 } };
const BOLD16_STYLE = { font: { bold: true, sz: 16 } };
const TITLE_STYLE = { font: { bold: true, sz: 18, color: { rgb: '0070C0' } } };

const COL_WIDTHS = [
  { wch: 14 },
  { wch: 10 },
  { wch: 16 },
  { wch: 8 },
  { wch: 10 },
  { wch: 14 },
  { wch: 18 },
];

function safeSheetName(name: string): string {
  return name.replace(/[\\\/\*\?\[\]:]/g, '-').slice(0, 31);
}

function cell(v: string, s?: object) {
  return s ? { v, s } : { v };
}

function buildLessonRows(lessons: Lesson[], subjects: StudentSubject[], paidStyle?: object) {
  const sorted = [...lessons].sort((a, b) =>
    a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot)
  );

  let totalHours = 0, totalAmount = 0, paidAmount = 0;
  const rows: any[][] = [];

  for (const l of sorted) {
    const sub = subjects.find(s => s.id === l.studentSubjectId);
    totalHours += l.duration;
    totalAmount += l.amount;
    if (l.status === 'paid') paidAmount += l.amount;

    const style = l.status === 'paid' && paidStyle ? paidStyle : undefined;
    rows.push([
      cell(l.date, style),
      cell(sub?.subject || '', style),
      cell(l.timeSlot, style),
      cell(`${l.duration}h`, style),
      cell(`${l.amount}元`, style),
      cell(STATUS_LABEL[l.status] || l.status, style),
      cell(l.notes || '', style),
    ]);
  }

  return { rows, totalHours, totalAmount, paidAmount };
}

function buildStudentSheet(student: Student, subjects: StudentSubject[], lessons: Lesson[]) {
  const subjectInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');
  const { rows, totalHours, totalAmount, paidAmount } = buildLessonRows(lessons, subjects, PAID_STYLE);

  const sheet: any[][] = [];

  sheet.push([cell('家教课程总账单', TITLE_STYLE)]);
  sheet.push([cell(`学生: ${student.name}    ${student.phone ? `电话: ${student.phone}    ` : ''} ${subjectInfo}`, BOLD14_STYLE)]);
  sheet.push([]);
  sheet.push(['日期', '学科', '时间段', '时长', '金额', '状态', '备注'].map(h => cell(h)));

  for (const row of rows) {
    sheet.push(row);
  }

  sheet.push([]);
  sheet.push([
    cell(''), cell(''), cell(''), cell(''), cell(''),
    cell('✓ 已收款', PAID_STYLE),
    cell('待收款', PENDING_STYLE),
  ]);
  sheet.push([
    cell('合计:', BOLD16_STYLE), cell(''),
    cell(`${lessons.length}节`, BOLD16_STYLE),
    cell(`${totalHours.toFixed(1)}h`, BOLD16_STYLE),
    cell(`${totalAmount}元`, BOLD16_STYLE),
    cell(`${paidAmount}元`, { ...PAID_STYLE, font: { bold: true, sz: 16 } }),
    cell(`${totalAmount - paidAmount}元`, { ...PENDING_STYLE, font: { bold: true, sz: 16 } }),
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
    ws['!cols'] = COL_WIDTHS;
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

  const sheet: any[][] = [];
  sheet.push([cell(title, TITLE_STYLE)]);
  sheet.push([]);

  for (const student of students) {
    const subjects = await getSubjectsByStudentId(student.id);
    const sLessons = monthLessons.filter(l => l.studentId === student.id);
    if (sLessons.length === 0) continue;

    const data = buildLessonRows(sLessons, subjects, PAID_STYLE);

    monthLessonsCount += sLessons.length;
    monthHours += data.totalHours;
    monthTotal += data.totalAmount;
    monthPaid += data.paidAmount;

    // Student header — bold 14pt
    const subInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');
    sheet.push([cell(`${student.name}  ·  ${subInfo}`, BOLD14_STYLE)]);

    // Table headers
    sheet.push(['日期', '学科', '时间段', '时长', '金额', '状态', '备注'].map(h => cell(h)));

    // Data rows
    for (const row of data.rows) {
      sheet.push(row);
    }

    // Subtotal — bold 14pt, values in A/C/D/E
    sheet.push([
      cell('小计:', BOLD14_STYLE), cell(''),
      cell(`${sLessons.length}节`, BOLD14_STYLE),
      cell(`${data.totalHours.toFixed(1)}h`, BOLD14_STYLE),
      cell(`${data.totalAmount}元`, BOLD14_STYLE),
      cell(''), cell(''),
    ]);
    sheet.push([]);
  }

  // Legend row
  sheet.push([
    cell(''), cell(''), cell(''), cell(''), cell(''),
    cell('✓ 已收款', PAID_STYLE),
    cell('待收款', PENDING_STYLE),
  ]);
  // Grand total — bold 16pt, values in A/C/D/E/F/G
  sheet.push([
    cell('总计:', BOLD16_STYLE), cell(''),
    cell(`${monthLessonsCount}节`, BOLD16_STYLE),
    cell(`${monthHours.toFixed(1)}h`, BOLD16_STYLE),
    cell(`${monthTotal}元`, BOLD16_STYLE),
    cell(`${monthPaid}元`, { ...PAID_STYLE, font: { bold: true, sz: 16 } }),
    cell(`${monthTotal - monthPaid}元`, { ...PENDING_STYLE, font: { bold: true, sz: 16 } }),
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheet);
  ws['!cols'] = COL_WIDTHS;
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
  ws['!cols'] = COL_WIDTHS;
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
