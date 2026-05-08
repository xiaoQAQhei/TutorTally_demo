const XLSX = require('xlsx-js-style');

const STATUS_LABEL = {
  scheduled: '待上课', completed: '确认下课', pendingPayment: '待收款',
  paid: '✓ 已收款', cancelled: '已取消',
};

const PAID_STYLE = { fill: { fgColor: { rgb: 'D1FAE5' }, patternType: 'solid' } };
const PENDING_STYLE = { fill: { fgColor: { rgb: 'FEF3C7' }, patternType: 'solid' } };
const CENTER_STYLE = { alignment: { horizontal: 'center' } };
const BOLD_STYLE = { font: { bold: true } };
const BOLD14_STYLE = { font: { bold: true, sz: 14 } };
const BOLD16_STYLE = { font: { bold: true, sz: 16 } };

function safeSheetName(name) {
  return name.replace(/[\\\/\*\?\[\]:]/g, '-').slice(0, 31);
}

function cell(v, s) {
  return s ? { v, s } : { v };
}

function buildLessonRows(lessons, subjects) {
  const sorted = [...lessons].sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot));
  let totalHours = 0, totalAmount = 0, paidAmount = 0;
  const rows = [];
  for (const l of sorted) {
    const sub = subjects.find(s => s.id === l.studentSubjectId);
    totalHours += l.duration; totalAmount += l.amount;
    if (l.status === 'paid') paidAmount += l.amount;
    const paid = l.status === 'paid';
    const style = paid ? PAID_STYLE : undefined;
    rows.push([
      cell(l.date, style),
      cell(sub?.subject || '', style),
      cell(l.timeSlot, style),
      cell(l.duration + 'h', style),
      cell(l.amount + '元', style),
      cell(STATUS_LABEL[l.status] || l.status, style),
      cell(l.notes || '', style),
    ]);
  }
  return { rows, totalHours, totalAmount, paidAmount };
}

function buildStudentSheet(student, subjects, lessons) {
  const subInfo = subjects.map(s => s.subject + ' ' + s.hourlyRate + '元/h').join(' · ');
  const { rows, totalHours, totalAmount, paidAmount } = buildLessonRows(lessons, subjects);
  const sheet = [];
  sheet.push([cell('家教课程账单')]);
  sheet.push([cell('学生: ' + student.name + '    ' + (student.phone ? '电话: ' + student.phone + '    ' : '') + subInfo)]);
  sheet.push([]);
  sheet.push(['日期', '学科', '时间段', '时长', '金额', '状态', '备注'].map(h => cell(h)));
  for (const row of rows) sheet.push(row);
  sheet.push([]);
  sheet.push([
    cell(''), cell(''), cell(''), cell(''), cell(''),
    cell('✓ 已收款', PAID_STYLE),
    cell('待收款', PENDING_STYLE),
  ]);
  sheet.push([
    cell('合计: ' + lessons.length + '节课'),
    cell(''), cell(''),
    cell(totalHours.toFixed(1) + 'h'),
    cell(totalAmount + '元'),
    cell(paidAmount + '元', PAID_STYLE),
    cell((totalAmount - paidAmount) + '元', PENDING_STYLE),
  ]);
  return sheet;
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
const wbFull = XLSX.utils.book_new();
for (const stu of students) {
  const ws = XLSX.utils.aoa_to_sheet(buildStudentSheet(stu, subjects.filter(s => s.studentId === stu.id), lessons.filter(l => l.studentId === stu.id)));
  ws['!cols'] = [
    { wch: 14 },
    { wch: 10 },
    { wch: 16 },
    { wch: 8 },
    { wch: 10 },
    { wch: 14 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wbFull, ws, safeSheetName(stu.name));
}
XLSX.writeFile(wbFull, 'export_example_全量.xlsx');
console.log('OK: export_example_全量.xlsx');

// === 按月导出 ===
const wbMonth = XLSX.utils.book_new();
const sh = [];
sh.push([cell('2026年5月 课程账单')]);
sh.push([]);

let mTotal = 0, mPaid = 0, mHours = 0, mLessons = 0;

for (const stu of students) {
  const ssubs = subjects.filter(s => s.studentId === stu.id);
  const sless = lessons.filter(l => l.studentId === stu.id && l.date.startsWith('2026-05'));
  if (sless.length === 0) continue;

  const data = buildLessonRows(sless, ssubs);
  mLessons += sless.length; mHours += data.totalHours; mTotal += data.totalAmount; mPaid += data.paidAmount;

  const subInfo = ssubs.map(s => s.subject + ' ' + s.hourlyRate + '元/h').join(' · ');
  sh.push([cell(stu.name + '  ·  ' + subInfo, BOLD14_STYLE)]);
  sh.push(['日期', '学科', '时间段', '时长', '金额', '状态', '备注'].map(h => cell(h)));
  for (const row of data.rows) sh.push(row);
  sh.push([
    cell('小计:', BOLD14_STYLE), cell(''), cell(sless.length + '节', BOLD14_STYLE),
    cell(data.totalHours.toFixed(1) + 'h', BOLD14_STYLE), cell(data.totalAmount + '元', BOLD14_STYLE),
    cell(''), cell(''),
  ]);
  sh.push([]);
}

sh.push([
  cell(''), cell(''), cell(''), cell(''), cell(''),
  cell('✓ 已收款', PAID_STYLE), cell('待收款', PENDING_STYLE),
]);
sh.push([
  cell('总计:', BOLD16_STYLE), cell(''), cell(mLessons + '节', BOLD16_STYLE),
  cell(mHours.toFixed(1) + 'h', BOLD16_STYLE), cell(mTotal + '元', BOLD16_STYLE),
  cell(mPaid + '元', { ...PAID_STYLE, font: { bold: true, sz: 16 } }),
  cell((mTotal - mPaid) + '元', { ...PENDING_STYLE, font: { bold: true, sz: 16 } }),
]);

const wsMonth = XLSX.utils.aoa_to_sheet(sh);
wsMonth['!cols'] = [            // ← 加这里
    { wch: 14 },
    { wch: 10 },
    { wch: 16 },
    { wch: 8 },
    { wch: 10 },
    { wch: 14 },
    { wch: 18 },
  ];
XLSX.utils.book_append_sheet(wbMonth, wsMonth, safeSheetName('2026年5月 课程账单'));
XLSX.writeFile(wbMonth, 'export_example_按月_2026-05.xlsx');
console.log('OK: export_example_按月_2026-05.xlsx');
