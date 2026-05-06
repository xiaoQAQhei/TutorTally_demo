import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getSubjectsByStudentId, getLessonsByStudentId, getPaymentsByLessonId } from '../database';
import { Student, Payment } from '../models';

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

  const lessonRows = monthLessons.map(l => {
    const sub = subjects.find(s => s.id === l.studentSubjectId);
    const paid = payments.filter(p => p.lessonId === l.id).reduce((s, p) => s + p.amount, 0);
    return `<tr><td>${l.date}</td><td>${sub?.subject || '-'}</td><td>${l.timeSlot}</td><td>${l.duration}h</td><td>¥${l.amount.toFixed(0)}</td><td>¥${paid.toFixed(0)}</td><td>${paid >= l.amount ? '已结清' : l.status === 'cancelled' ? '已取消' : '待收'}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, sans-serif; padding: 40px; color: #1A1A2E; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #9A9AB0; font-size: 14px; margin-bottom: 24px; }
    .summary { display: flex; gap: 24px; margin-bottom: 24px; }
    .summary-item { background: #F8FAFC; padding: 16px; border-radius: 12px; flex: 1; text-align: center; }
    .summary-value { font-size: 22px; font-weight: 700; }
    .summary-label { font-size: 13px; color: #9A9AB0; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #F1F5F9; padding: 10px; text-align: left; font-size: 13px; border-bottom: 2px solid #E2E8F0; }
    td { padding: 10px; border-bottom: 1px solid #F1F5F9; font-size: 14px; }
    .footer { margin-top: 32px; text-align: center; color: #9A9AB0; font-size: 12px; }
  </style></head><body>
    <h1>${student.name} - 家教账单</h1>
    <p class="subtitle">${month} | ${subjects.map(s => s.subject).join(', ')}</p>
    <div class="summary">
      <div class="summary-item"><div class="summary-value">${monthLessons.length}节</div><div class="summary-label">课程数</div></div>
      <div class="summary-item"><div class="summary-value">¥${totalAmount.toFixed(0)}</div><div class="summary-label">总额</div></div>
      <div class="summary-item"><div class="summary-value">¥${totalPaid.toFixed(0)}</div><div class="summary-label">已收款</div></div>
      <div class="summary-item"><div class="summary-value" style="color:${totalAmount - totalPaid > 0 ? '#F59E0B' : '#10B981'}">¥${(totalAmount - totalPaid).toFixed(0)}</div><div class="summary-label">待收款</div></div>
    </div>
    <table><thead><tr><th>日期</th><th>科目</th><th>时段</th><th>课时</th><th>金额</th><th>已收</th><th>状态</th></tr></thead><tbody>${lessonRows}</tbody></table>
    <p class="footer">家教账单 v2.0 · ${new Date().toLocaleDateString('zh-CN')}</p>
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `导出 ${student.name} ${month} 账单` });
}
