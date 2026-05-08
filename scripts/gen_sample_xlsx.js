const ExcelJS = require('exceljs');

const STATUS_LABEL = {
  scheduled: '待上课', completed: '确认下课', pendingPayment: '待收款',
  paid: '✓ 已收款', cancelled: '已取消',
};

const PAID_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };

function safeSheetName(name) {
  return name.replace(/[\\\/\*\?\[\]:]/g, '-').slice(0, 31);
}

function buildLessonRows(lessons, subjects) {
  const sorted = [...lessons].sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot));
  let totalHours = 0, totalAmount = 0, paidAmount = 0;
  const rows = [];
  for (const l of sorted) {
    const sub = subjects.find(s => s.id === l.studentSubjectId);
    totalHours += l.duration; totalAmount += l.amount;
    if (l.status === 'paid') paidAmount += l.amount;
    rows.push({
      values: [l.date, sub?.subject || '', l.timeSlot, `${l.duration}h`, `${l.amount}元`, STATUS_LABEL[l.status] || l.status, l.notes || ''],
      isPaid: l.status === 'paid',
    });
  }
  return { rows, totalHours, totalAmount, paidAmount };
}

function writeDataRow(sheet, rowIdx, row) {
  row.values.forEach((v, i) => {
    const cell = sheet.getRow(rowIdx).getCell(i + 1);
    cell.value = v;
    if (row.isPaid) cell.fill = PAID_FILL;
  });
}

function addStudentSheet(wb, student, subjects, lessons) {
  const sheet = wb.addWorksheet(safeSheetName(student.name));
  const subInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');

  sheet.getCell('A1').value = '家教课程账单';
  sheet.getCell('A2').value = `学生: ${student.name}    ${student.phone ? `电话: ${student.phone}    ` : ''} ${subInfo}`;

  ['日期', '学科', '时间段', '时长', '金额', '状态', '备注'].forEach((h, i) => {
    sheet.getRow(4).getCell(i + 1).value = h;
  });

  const { rows, totalHours, totalAmount, paidAmount } = buildLessonRows(lessons, subjects);
  rows.forEach((r, i) => writeDataRow(sheet, 5 + i, r));

  const sr = 5 + rows.length + 1;
  ['合计: ' + lessons.length + '节课', '', '', totalHours.toFixed(1) + 'h', totalAmount + '元', '已收 ' + paidAmount + '元 / 待收 ' + (totalAmount - paidAmount) + '元', ''].forEach((v, i) => {
    const cell = sheet.getRow(sr).getCell(i + 1);
    cell.value = v;
    cell.alignment = { horizontal: 'center' };
  });
}

const students = [
  { id: 1, name: '李小明', phone: '13901012345' },
  { id: 2, name: '王雨涵', phone: '13801026789' },
  { id: 3, name: '陈子豪', phone: '13701039876' },
];
const subjects = [
  { id: 1, studentId: 1, subject: '数学', hourlyRate: 150 },
  { id: 2, studentId: 1, subject: '物理', hourlyRate: 130 },
  { id: 3, studentId: 2, subject: '英语', hourlyRate: 120 },
  { id: 4, studentId: 3, subject: '数学', hourlyRate: 160 },
];
const lessons = [
  { id: 1, studentId: 1, studentSubjectId: 1, date: '2026-05-03', timeSlot: '09:00-11:00', duration: 2, amount: 300, status: 'paid', notes: '' },
  { id: 2, studentId: 1, studentSubjectId: 1, date: '2026-05-05', timeSlot: '09:00-11:00', duration: 2, amount: 300, status: 'paid', notes: '' },
  { id: 3, studentId: 1, studentSubjectId: 2, date: '2026-05-06', timeSlot: '14:00-16:00', duration: 2, amount: 260, status: 'pendingPayment', notes: '牛顿定律练习' },
  { id: 4, studentId: 2, studentSubjectId: 3, date: '2026-05-04', timeSlot: '16:00-18:00', duration: 2, amount: 240, status: 'paid', notes: '' },
  { id: 5, studentId: 2, studentSubjectId: 3, date: '2026-05-06', timeSlot: '16:00-18:00', duration: 2, amount: 240, status: 'completed', notes: '口语练习' },
  { id: 6, studentId: 3, studentSubjectId: 4, date: '2026-05-07', timeSlot: '10:00-12:00', duration: 2, amount: 320, status: 'paid', notes: '' },
  { id: 7, studentId: 3, studentSubjectId: 4, date: '2026-05-08', timeSlot: '10:00-12:00', duration: 2, amount: 320, status: 'completed', notes: '' },
  { id: 8, studentId: 1, studentSubjectId: 1, date: '2026-05-10', timeSlot: '09:00-11:00', duration: 2, amount: 300, status: 'scheduled', notes: '' },
];

// === 全量导出 ===
const wbFull = new ExcelJS.Workbook();
for (const stu of students) {
  const ssubs = subjects.filter(s => s.studentId === stu.id);
  const sless = lessons.filter(l => l.studentId === stu.id);
  addStudentSheet(wbFull, stu, ssubs, sless);
}

// === 按月导出 ===
const wbMonth = new ExcelJS.Workbook();
const sh = wbMonth.addWorksheet(safeSheetName('2026年5月 课程账单'));
let r = 1;
sh.getCell('A' + r).value = '2026年5月 课程账单';
r += 2;

let mTotal = 0, mPaid = 0, mHours = 0, mLessons = 0;

for (const stu of students) {
  const ssubs = subjects.filter(s => s.studentId === stu.id);
  const sless = lessons.filter(l => l.studentId === stu.id && l.date.startsWith('2026-05'));
  if (sless.length === 0) continue;

  const data = buildLessonRows(sless, ssubs);
  mLessons += sless.length; mHours += data.totalHours; mTotal += data.totalAmount; mPaid += data.paidAmount;

  // Student header - bold
  const subInfo = ssubs.map(s => s.subject + ' ' + s.hourlyRate + '元/h').join(' · ');
  const nc = sh.getCell('A' + r);
  nc.value = stu.name + '  ·  ' + subInfo;
  nc.font = { bold: true, size: 11 };
  r++;

  // Table headers
  ['日期', '学科', '时间段', '时长', '金额', '状态', '备注'].forEach((h, i) => {
    sh.getRow(r).getCell(i + 1).value = h;
  });
  r++;

  // Data rows
  data.rows.forEach(row => { writeDataRow(sh, r, row); r++; });

  // Subtotal - center-aligned
  ['小计: ' + sless.length + '节  ' + data.totalHours.toFixed(1) + 'h  ' + data.totalAmount + '元', '', '', '', '', '', ''].forEach((v, i) => {
    const cell = sh.getRow(r).getCell(i + 1);
    cell.value = v;
    cell.alignment = { horizontal: 'center' };
  });
  r += 2;
}

// Grand total - center-aligned
['总计: ' + mLessons + '节课 | ' + mHours.toFixed(1) + 'h | ' + mTotal + '元 | 已收 ' + mPaid + '元 | 待收 ' + (mTotal - mPaid) + '元', '', '', '', '', '', ''].forEach((v, i) => {
  const cell = sh.getRow(r).getCell(i + 1);
  cell.value = v;
  cell.alignment = { horizontal: 'center' };
});

Promise.all([
  wbFull.xlsx.writeFile('export_example_全量.xlsx'),
  wbMonth.xlsx.writeFile('export_example_按月_2026-05.xlsx'),
]).then(() => console.log('OK: export_example_全量.xlsx, export_example_按月_2026-05.xlsx'));
