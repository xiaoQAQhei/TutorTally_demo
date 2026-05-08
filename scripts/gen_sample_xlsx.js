const XLSX = require('xlsx');

const STATUS_LABEL = {
  scheduled: '待上课',
  completed: '确认下课',
  pendingPayment: '待收款',
  paid: '已收款',
  cancelled: '已取消',
};

function safeSheetName(name) {
  return name.replace(/[\\\/\*\?\[\]:]/g, '-').slice(0, 31);
}

function buildLessonRows(lessons, subjects) {
  const sorted = [...lessons].sort((a, b) =>
    a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot)
  );

  let totalHours = 0, totalAmount = 0, paidAmount = 0;
  const rows = [];

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

function buildStudentSheet(student, subjects, lessons) {
  const subjectInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');
  const { rows, totalHours, totalAmount, paidAmount } = buildLessonRows(lessons, subjects);

  const sheet = [];
  sheet.push(['家教课程账单']);
  sheet.push([`学生: ${student.name}    ${student.phone ? `电话: ${student.phone}    ` : ''} ${subjectInfo}`]);
  sheet.push([]);
  sheet.push(['日期', '学科', '时间段', '时长', '金额', '状态', '备注']);

  for (const row of rows) sheet.push(row);

  sheet.push([]);
  sheet.push([
    `合计: ${lessons.length}节课`, '', '',
    `${totalHours.toFixed(1)}h`, `${totalAmount}元`,
    `已收 ${paidAmount}元 / 待收 ${totalAmount - paidAmount}元`, '',
  ]);
  return sheet;
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

const COL_WIDTHS = [
  { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 26 }, { wch: 16 },
];

// === 全量导出 ===
const wbFull = XLSX.utils.book_new();
for (const stu of students) {
  const stuSubjects = subjects.filter(s => s.studentId === stu.id);
  const stuLessons = lessons.filter(l => l.studentId === stu.id);
  const sheetData = buildStudentSheet(stu, stuSubjects, stuLessons);
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = COL_WIDTHS;
  XLSX.utils.book_append_sheet(wbFull, ws, safeSheetName(stu.name));
}
XLSX.writeFile(wbFull, 'export_example_全量.xlsx');
console.log('OK: export_example_全量.xlsx');

// === 按月导出 ===
const wbMonth = XLSX.utils.book_new();
const monthTitle = '2026年5月 课程账单';
const monthSheet = [];
monthSheet.push([monthTitle]);
monthSheet.push([]);

let monthTotal = 0, monthPaid = 0, monthHours = 0, monthLessons = 0;

for (const stu of students) {
  const stuSubjects = subjects.filter(s => s.studentId === stu.id);
  const stuLessons = lessons.filter(l => l.studentId === stu.id && l.date.startsWith('2026-05'));
  if (stuLessons.length === 0) continue;

  const data = buildLessonRows(stuLessons, stuSubjects);
  monthLessons += stuLessons.length;
  monthHours += data.totalHours;
  monthTotal += data.totalAmount;
  monthPaid += data.paidAmount;

  const subInfo = stuSubjects.map(s => `${s.subject} ${s.hourlyRate}元/h`).join(' · ');
  monthSheet.push([`${stu.name}  ·  ${subInfo}`]);
  monthSheet.push(['日期', '学科', '时间段', '时长', '金额', '状态', '备注']);
  for (const row of data.rows) monthSheet.push(row);
  monthSheet.push([`小计: ${stuLessons.length}节  ${data.totalHours.toFixed(1)}h  ${data.totalAmount}元`, '', '', '', '', '', '']);
  monthSheet.push([]);
}

monthSheet.push([`总计: ${monthLessons}节课 | ${monthHours.toFixed(1)}h | ${monthTotal}元 | 已收 ${monthPaid}元 | 待收 ${monthTotal - monthPaid}元`]);

const wsMonth = XLSX.utils.aoa_to_sheet(monthSheet);
wsMonth['!cols'] = COL_WIDTHS;
XLSX.utils.book_append_sheet(wbMonth, wsMonth, safeSheetName(monthTitle));
XLSX.writeFile(wbMonth, 'export_example_按月_2026-05.xlsx');
console.log('OK: export_example_按月_2026-05.xlsx');
