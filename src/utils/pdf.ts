/**
 * ── pdf.ts ─────────────────────────────────────────────────────────────────
 * PDF 导出模块：基于 expo-print 和 expo-sharing。
 * 生成学生月度课程账单 PDF，包含摘要卡片和课程明细表格。
 * ────────────────────────────────────────────────────────────────────────────
 */
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getAllStudents, getAllLessons, getSubjectsByStudentId, getLessonsByStudentId, getPaymentsByLessonId } from '../database';
import { Student, Payment } from '../models';

/** 预览 HTML 的公共函数（Web 端打开新标签页，Native 端用 expo-print 生成 PDF） */
async function openHtml(html: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title });
}

/** CSS 样式模板（与 generateStudentPdf 共用） */
const PDF_STYLE = `
  body { font-family: -apple-system, sans-serif; padding: 40px; color: #1A1A2E; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 20px; margin-top: 32px; margin-bottom: 12px; }
  .subtitle { color: #9A9AB0; font-size: 14px; margin-bottom: 24px; }
  .summary { display: flex; gap: 24px; margin-bottom: 24px; }
  .summary-item { background: #F8FAFC; padding: 16px; border-radius: 12px; flex: 1; text-align: center; }
  .summary-value { font-size: 22px; font-weight: 700; }
  .summary-label { font-size: 13px; color: #9A9AB0; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #F1F5F9; padding: 10px; text-align: left; font-size: 13px; border-bottom: 2px solid #E2E8F0; }
  td { padding: 10px; border-bottom: 1px solid #F1F5F9; font-size: 14px; }
  .section-total { font-weight: 700; font-size: 15px; text-align: right; margin-bottom: 8px; }
  .grand-total { font-weight: 700; font-size: 16px; text-align: right; margin-top: 16px; padding-top: 8px; border-top: 2px solid #333; }
  .footer { margin-top: 32px; text-align: center; color: #9A9AB0; font-size: 12px; }
  .page-break { page-break-after: always; }
`;

/**
 * 生成 HTML 标题和摘要卡片
 */
function buildSummaryHtml(label: string, lessonCount: number, totalAmount: number, totalPaid: number): string {
  const pending = totalAmount - totalPaid;
  return `
    <h1>家教账单</h1>
    <p class="subtitle">${label}</p>
    <div class="summary">
      <div class="summary-item"><div class="summary-value">${lessonCount}节</div><div class="summary-label">课程数</div></div>
      <div class="summary-item"><div class="summary-value">¥${totalAmount.toFixed(0)}</div><div class="summary-label">总额</div></div>
      <div class="summary-item"><div class="summary-value">¥${totalPaid.toFixed(0)}</div><div class="summary-label">已收款</div></div>
      <div class="summary-item"><div class="summary-value" style="color:${pending > 0 ? '#F59E0B' : '#10B981'}">¥${pending.toFixed(0)}</div><div class="summary-label">待收款</div></div>
    </div>`;
}

function lessonRow(l: any, subjects: any[], payments: Payment[]): string {
  const sub = subjects.find(s => s.id === l.studentSubjectId);
  const paid = payments.filter(p => p.lessonId === l.id).reduce((s, p) => s + p.amount, 0);
  return `<tr><td>${l.date}</td><td>${sub?.subject || '-'}</td><td>${l.timeSlot}</td><td>${l.duration}h</td><td>¥${l.amount.toFixed(0)}</td><td>¥${paid.toFixed(0)}</td><td>${paid >= l.amount ? '已结清' : l.status === 'cancelled' ? '已取消' : '待收'}</td></tr>`;
}

/**
 * 生成所有学生的总账单 PDF。
 */
export async function generateAllPdf(): Promise<void> {
  const students = await getAllStudents();
  const allLessons = await getAllLessons();

  let bodyHtml = buildSummaryHtml('全部数据', allLessons.length, allLessons.reduce((s, l) => s + l.amount, 0), allLessons.filter(l => l.status === 'paid').reduce((s, l) => s + l.amount, 0));
  let grandTotal = 0, grandPaid = 0;

  for (const student of students) {
    const sLessons = allLessons.filter(l => l.studentId === student.id);
    if (sLessons.length === 0) continue;
    const subjects = await getSubjectsByStudentId(student.id);
    const payments: Payment[] = [];
    for (const l of sLessons) payments.push(...(await getPaymentsByLessonId(l.id)));

    const total = sLessons.reduce((s, l) => s + l.amount, 0);
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    grandTotal += total; grandPaid += paid;

    const rows = sLessons.map(l => lessonRow(l, subjects, payments)).join('');
    bodyHtml += `<h2>${student.name}</h2><div class="section-total">合计：¥${total.toFixed(0)} / 已收：¥${paid.toFixed(0)}</div>
      <table><thead><tr><th>日期</th><th>科目</th><th>时段</th><th>课时</th><th>金额</th><th>已收</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  bodyHtml += `<div class="grand-total">总计：¥${grandTotal.toFixed(0)} ｜ 已收款：¥${grandPaid.toFixed(0)} ｜ 待收款：¥${(grandTotal - grandPaid).toFixed(0)}</div>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PDF_STYLE}</style></head><body>${bodyHtml}<p class="footer">家教账单 v2.0 · ${new Date().toLocaleDateString('zh-CN')}</p></body></html>`;
  await openHtml(html, '导出全部账单');
}

/**
 * 生成指定月份的所有学生账单 PDF。
 */
export async function generateMonthlyPdf(month: string): Promise<void> {
  const students = await getAllStudents();
  const allLessons = (await getAllLessons()).filter(l => l.date.startsWith(month));

  let bodyHtml = buildSummaryHtml(`${month} 月度账单`, allLessons.length, allLessons.reduce((s, l) => s + l.amount, 0), allLessons.filter(l => l.status === 'paid').reduce((s, l) => s + l.amount, 0));
  let grandTotal = 0, grandPaid = 0;

  for (const student of students) {
    const sLessons = allLessons.filter(l => l.studentId === student.id);
    if (sLessons.length === 0) continue;
    const subjects = await getSubjectsByStudentId(student.id);
    const payments: Payment[] = [];
    for (const l of sLessons) payments.push(...(await getPaymentsByLessonId(l.id)));

    const total = sLessons.reduce((s, l) => s + l.amount, 0);
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    grandTotal += total; grandPaid += paid;

    const rows = sLessons.map(l => lessonRow(l, subjects, payments)).join('');
    bodyHtml += `<h2>${student.name}</h2><div class="section-total">合计：¥${total.toFixed(0)} / 已收：¥${paid.toFixed(0)}</div>
      <table><thead><tr><th>日期</th><th>科目</th><th>时段</th><th>课时</th><th>金额</th><th>已收</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  bodyHtml += `<div class="grand-total">总计：¥${grandTotal.toFixed(0)} ｜ 已收款：¥${grandPaid.toFixed(0)} ｜ 待收款：¥${(grandTotal - grandPaid).toFixed(0)}</div>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PDF_STYLE}</style></head><body>${bodyHtml}<p class="footer">家教账单 v2.0 · ${new Date().toLocaleDateString('zh-CN')}</p></body></html>`;
  await openHtml(html, `导出 ${month} 账单`);
}

/**
 * 生成指定学生指定月份的 PDF 账单。
 */
export async function generateStudentPdf(student: Student, month: string): Promise<void> {
  const subjects = await getSubjectsByStudentId(student.id);
  const allLessons = await getLessonsByStudentId(student.id);
  const monthLessons = allLessons.filter(l => l.date.startsWith(month));
  const payments: Payment[] = [];
  for (const l of monthLessons) {
    payments.push(...(await getPaymentsByLessonId(l.id)));
  }

  const totalAmount = monthLessons.reduce((sum, l) => sum + l.amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  const lessonRows = monthLessons.map(l => lessonRow(l, subjects, payments)).join('');
  const bodyHtml = `${buildSummaryHtml(`${student.name} · ${month}`, monthLessons.length, totalAmount, totalPaid)}
    <table><thead><tr><th>日期</th><th>科目</th><th>时段</th><th>课时</th><th>金额</th><th>已收</th><th>状态</th></tr></thead><tbody>${lessonRows}</tbody></table>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PDF_STYLE}</style></head><body>${bodyHtml}<p class="footer">家教账单 v2.0 · ${new Date().toLocaleDateString('zh-CN')}</p></body></html>`;
  await openHtml(html, `导出 ${student.name} ${month} 账单`);
}
