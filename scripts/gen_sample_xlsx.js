const ExcelJS = require('exceljs');

const COL_WIDTHS = [14, 10, 16, 10, 12, 16, 18];
const PAID_GREEN = 'FFD1FAE5';
const HEADER_BG = 'FFF8FAFC';
const TITLE_COLOR = 'FF1A1A2E';
const SUBTITLE_COLOR = 'FF4A4A6A';
const STU_COLOR = 'FF6366F1';

function safeSheetName(name) {
  return name.replace(/[\\\/\*\?\[\]:]/g, '-').slice(0, 31);
}

function buildLessonRows(lessons, subjects) {
  const sorted = [...lessons].sort((a, b) =>
    a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot)
  );
  let totalHours = 0, totalAmount = 0, paidAmount = 0;
  const rows = [];
  const STATUS_LABEL = { scheduled: '待上课', completed: '确认下课', pendingPayment: '待收款', paid: '已收款', cancelled: '已取消' };

  for (const l of sorted) {
    const sub = subjects.find(s => s.id === l.studentSubjectId);
    totalHours += l.duration;
    totalAmount += l.amount;
    if (l.status === 'paid') paidAmount += l.amount;
    rows.push({
      date: l.date, subject: sub?.subject || '', timeSlot: l.timeSlot,
      duration: `${l.duration}h`, amount: `${l.amount}元`,
      status: STATUS_LABEL[l.status] || l.status, notes: l.notes || '',
      isPaid: l.status === 'paid',
    });
  }
  return { rows, totalHours, totalAmount, paidAmount };
}

function addStudentSheet(wb, student, subjects, lessons) {
  const sheet = wb.addWorksheet(safeSheetName(student.name));
  sheet.columns = COL_WIDTHS.map(w => ({ width: w }));

  const subInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');

  // Title
  const t = sheet.getCell('A1');
  t.value = '家教课程账单';
  t.font = { bold: true, size: 14, color: { argb: TITLE_COLOR } };

  // Info
  const info = sheet.getCell('A2');
  info.value = `学生: ${student.name}    ${student.phone ? `电话: ${student.phone}    ` : ''} ${subInfo}`;
  info.font = { size: 11, color: { argb: SUBTITLE_COLOR } };

  // Headers (row 4)
  const hdrs = ['日期', '学科', '时间段', '时长', '金额', '状态', '备注'];
  const hr = sheet.getRow(4);
  hdrs.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 11 };
    c.alignment = { horizontal: 'center' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
  });

  // Data rows
  const { rows, totalHours, totalAmount, paidAmount } = buildLessonRows(lessons, subjects);
  rows.forEach((r, ri) => {
    const er = sheet.getRow(5 + ri);
    [r.date, r.subject, r.timeSlot, r.duration, r.amount, r.status, r.notes].forEach((v, ci) => {
      const cell = er.getCell(ci + 1);
      cell.value = v;
      cell.alignment = { horizontal: 'center' };
      if (r.isPaid) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PAID_GREEN } };
      }
    });
  });

  // Summary
  const sr = 5 + rows.length + 1;
  const sc = sheet.getCell(`A${sr}`);
  sc.value = `合计: ${lessons.length}节课    ${totalHours.toFixed(1)}h    ${totalAmount}元    已收 ${paidAmount}元 / 待收 ${totalAmount - paidAmount}元`;
  sc.font = { bold: true, size: 11 };
  sheet.mergeCells(`A${sr}:G${sr}`);
}

// === 虚构数据 ===
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
wbFull.xlsx.writeFile('export_example_全量.xlsx').then(() => console.log('OK: export_example_全量.xlsx'));

// === 按月导出 ===
const wbMonth = new ExcelJS.Workbook();
const shMonth = wbMonth.addWorksheet(safeSheetName('2026年5月 课程账单'));
shMonth.columns = COL_WIDTHS.map(w => ({ width: w }));

let row = 1;
const tCell = shMonth.getCell(`A${row}`); tCell.value = '2026年5月 课程账单'; tCell.font = { bold: true, size: 14, color: { argb: TITLE_COLOR } };
row += 2;

let mTotal = 0, mPaid = 0, mHours = 0, mLessons = 0;

for (const stu of students) {
  const ssubs = subjects.filter(s => s.studentId === stu.id);
  const sless = lessons.filter(l => l.studentId === stu.id && l.date.startsWith('2026-05'));
  if (sless.length === 0) continue;

  const data = buildLessonRows(sless, ssubs);
  mLessons += sless.length; mHours += data.totalHours; mTotal += data.totalAmount; mPaid += data.paidAmount;

  // Student header
  const subInfo = ssubs.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');
  const sc = shMonth.getCell(`A${row}`);
  sc.value = `${stu.name}  ·  ${subInfo}`;
  sc.font = { bold: true, size: 11, color: { argb: STU_COLOR } };
  row++;

  // Table headers
  const hdrs = ['日期', '学科', '时间段', '时长', '金额', '状态', '备注'];
  const hr = shMonth.getRow(row);
  hdrs.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h; c.font = { bold: true, size: 11 }; c.alignment = { horizontal: 'center' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
  });
  row++;

  // Data
  for (const r of data.rows) {
    const er = shMonth.getRow(row);
    [r.date, r.subject, r.timeSlot, r.duration, r.amount, r.status, r.notes].forEach((v, ci) => {
      const cell = er.getCell(ci + 1);
      cell.value = v; cell.alignment = { horizontal: 'center' };
      if (r.isPaid) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PAID_GREEN } };
    });
    row++;
  }

  // Subtotal
  const subCell = shMonth.getCell(`A${row}`);
  subCell.value = `小计: ${sless.length}节  ${data.totalHours.toFixed(1)}h  ${data.totalAmount}元`; subCell.font = { bold: true, size: 11 };
  shMonth.mergeCells(`A${row}:G${row}`);
  row += 2;
}

// Grand total
const totalCell = shMonth.getCell(`A${row}`);
totalCell.value = `总计: ${mLessons}节课 | ${mHours.toFixed(1)}h | ${mTotal}元 | 已收 ${mPaid}元 | 待收 ${mTotal - mPaid}元`;
totalCell.font = { bold: true, size: 12 };
shMonth.mergeCells(`A${row}:G${row}`);

wbMonth.xlsx.writeFile('export_example_按月_2026-05.xlsx').then(() => console.log('OK: export_example_按月_2026-05.xlsx'));
