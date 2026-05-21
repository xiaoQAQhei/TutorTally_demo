/**
 * ── export.ts ──────────────────────────────────────────────────────────────
 * Excel 导出模块：基于 xlsx-js-style 和 expo-file-system/expo-sharing。
 * 提供全部导出、按月导出、按学生导出、自定义导出四种模式。
 * 支持进度回调、状态筛选、日期范围、颜色标记等高级选项。
 * ────────────────────────────────────────────────────────────────────────────
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllStudents, getSubjectsByStudentId, getAllLessons, getPaymentsByLessonId } from '../database';
import { Student, StudentSubject, Lesson, Payment } from '../models';

// xlsx-js-style 懒加载：首次导出时才加载，不阻塞 App 主包
let _xlsx: any = null;
const ensureXLSX = async () => { if (!_xlsx) _xlsx = await import('xlsx-js-style'); return _xlsx; };

export interface ExportOptions {
  includeHeader?: boolean; includeLegend?: boolean; includeTotal?: boolean;
  includeNotes?: boolean; includePaymentInfo?: boolean; dateFormat?: string;
  numberFormat?: string; currencySymbol?: string; sheetName?: string; title?: string;
  customFields?: string[]; statusFilter?: string[]; dateRange?: { start: string; end: string };
}

export interface ExportProgress {
  current: number; total: number;
  stage: 'preparing' | 'loading' | 'processing' | 'generating' | 'saving' | 'sharing' | 'completed';
  message: string;
}

export type ProgressCallback = (progress: ExportProgress) => void;

const STATUS_LABEL: Record<string, string> = {
  scheduled: '待上课', completed: '确认下课', pendingPayment: '待收款', paid: '✓ 已收款', cancelled: '已取消',
};
const PAID_STYLE = { fill: { fgColor: { rgb: 'D1FAE5' }, patternType: 'solid' as const } };
const PENDING_STYLE = { fill: { fgColor: { rgb: 'FEF3C7' }, patternType: 'solid' as const } };
const COMPLETED_STYLE = { fill: { fgColor: { rgb: 'FEE2E2' }, patternType: 'solid' as const } };
const SCHEDULED_STYLE = { fill: { fgColor: { rgb: 'EEF2FF' }, patternType: 'solid' as const } };
const BOLD14_STYLE = { font: { bold: true, sz: 14 } };
const BOLD16_STYLE = { font: { bold: true, sz: 16 } };
const TITLE_STYLE = { font: { bold: true, sz: 18, color: { rgb: '0070C0' } } };

const COL_WIDTHS = [{ wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 20 }];
const ROW_HEIGHTS = { title: { hpt: 30 }, subheader: { hpt: 24 }, header: { hpt: 20 }, data: { hpt: 20 }, empty: { hpt: 10 }, total: { hpt: 28 }, legend: { hpt: 20 } };
const DEFAULT_OPTIONS: ExportOptions = {
  includeHeader: true, includeLegend: true, includeTotal: true, includeNotes: true,
  includePaymentInfo: false, dateFormat: 'YYYY-MM-DD', numberFormat: '#,##0.00', currencySymbol: '元',
};

class ExportError extends Error {
  constructor(message: string, public code: string, public details?: any) { super(message); this.name = 'ExportError'; }
}

function safeSheetName(name: string) { return name.replace(/[\\\/\*\?\[\]:]/g, '-').slice(0, 31); }
function cell(v: any, s?: object) { return s ? { v, s } : { v }; }
function formatCurrency(amount: number, symbol = '元') {
  return `${amount.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${symbol}`;
}

function getStatusStyle(status: string) {
  switch (status) { case 'paid': return PAID_STYLE; case 'pendingPayment': return PENDING_STYLE; case 'completed': return COMPLETED_STYLE; case 'scheduled': return SCHEDULED_STYLE; default: return undefined; }
}

async function loadLessonPayments(lessons: Lesson[]) {
  const paymentMap = new Map<number, Payment[]>();
  for (const lesson of lessons) { try { paymentMap.set(lesson.id, await getPaymentsByLessonId(lesson.id)); } catch { paymentMap.set(lesson.id, []); } }
  return paymentMap;
}

function buildStudentSheet(student: Student, subjects: StudentSubject[], lessons: Lesson[], options: ExportOptions, paymentMap?: Map<number, Payment[]>) {
  const sInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}${options.currencySymbol}/h`).join(' · ');
  const sorted = [...lessons].sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot));
  let totalH = 0, totalA = 0, paidA = 0, pendA = 0;
  const data: any[][] = [], rh: any[] = [];
  for (const l of sorted) {
    const sub = subjects.find(s => s.id === l.studentSubjectId);
    if (options.statusFilter && !options.statusFilter.includes(l.status)) continue;
    totalH += l.duration; totalA += l.amount;
    if (l.status === 'paid') paidA += l.amount; else if (l.status === 'pendingPayment') pendA += l.amount;
    const st = getStatusStyle(l.status);
    const pp = paymentMap?.get(l.id);
    data.push([cell(formatDate(l.date, options.dateFormat), st), cell(sub?.subject || '', st), cell(l.timeSlot, st), cell(`${l.duration}h`, st), cell(formatCurrency(l.amount, options.currencySymbol), st), cell(STATUS_LABEL[l.status] || l.status, st), ...(options.includeNotes ? [cell(l.notes || '', st)] : []), ...(options.includePaymentInfo ? [cell(pp?.length ? `${pp[0].method} ${formatCurrency(pp[0].amount)}` : '', st)] : [])]);
  }
  if (options.includeHeader) { data.unshift([cell(options.title || '家教课程总账单', TITLE_STYLE)]); rh.push(ROW_HEIGHTS.title); data.splice(1,0,[cell(`学生: ${student.name}${sInfo ? `  ${sInfo}` : ''}`, BOLD14_STYLE)]); rh.push(ROW_HEIGHTS.subheader); data.splice(2,0,[]); rh.push(ROW_HEIGHTS.empty); }
  const headers = ['日期','学科','时间段','时长','金额','状态']; if (options.includeNotes) headers.push('备注'); if (options.includePaymentInfo) headers.push('支付信息');
  // 表头插入到信息区（标题+学生+空行）之后、数据行之前
  const headerIdx = options.includeHeader ? 3 : 0;
  data.splice(headerIdx, 0, headers.map(h => cell(h))); rh.splice(headerIdx, 0, ROW_HEIGHTS.header);
  for (const r of data.splice(headerIdx + 1)) { data.push(r); rh.push(ROW_HEIGHTS.data); }
  if (options.includeLegend) { data.push([]); rh.push(ROW_HEIGHTS.data); data.push([cell(''),cell(''),cell(''),cell(''),cell('✓ 已收款',PAID_STYLE),cell('待收款',PENDING_STYLE)]); rh.push(ROW_HEIGHTS.legend); }
  if (options.includeTotal) { data.push([cell('合计:',BOLD16_STYLE),cell(''),cell(`${lessons.length}节`,BOLD16_STYLE),cell(`${totalH.toFixed(1)}h`,BOLD16_STYLE),cell(formatCurrency(paidA,options.currencySymbol),{...PAID_STYLE,font:{bold:true,sz:16}}),cell(formatCurrency(pendA,options.currencySymbol),{...PENDING_STYLE,font:{bold:true,sz:16}}),cell(formatCurrency(totalA,options.currencySymbol),BOLD16_STYLE)]); rh.push(ROW_HEIGHTS.total); }
  return { sheet: data, rowHeights: rh };
}

async function saveAndShareWorkbook(wb: any, filename: string, dialogTitle: string): Promise<string> {
  try {
    const xlsx = await ensureXLSX();
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([xlsx.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
      return filename;
    }
    const b64 = xlsx.write(wb, { type: 'base64', bookType: 'xlsx' });
    const path = FileSystem.documentDirectory + filename;
    await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
    if (Platform.OS === 'android') {
      const { StorageAccessFramework } = FileSystem;
      try { const p = await StorageAccessFramework.requestDirectoryPermissionsAsync(StorageAccessFramework.getUriForDirectoryInRoot('Download')); if (p.granted) { const d = await StorageAccessFramework.createFileAsync(p.directoryUri, filename.replace('.xlsx',''), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); await StorageAccessFramework.writeAsStringAsync(d, b64, { encoding: FileSystem.EncodingType.Base64 }); return d; } } catch {}
    }
    await Sharing.shareAsync(path, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle });
    return path;
  } catch (e) { throw new ExportError('保存或分享文件失败', 'FILE_ERROR', e); }
}

function formatDate(dateStr: string, format = 'YYYY-MM-DD') {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return format.replace('YYYY',String(d.getFullYear())).replace('MM',String(d.getMonth()+1).padStart(2,'0')).replace('DD',String(d.getDate()).padStart(2,'0'));
}

function updateProgress(cb: ProgressCallback | undefined, p: Partial<ExportProgress>) { cb?.(p as ExportProgress); }

export async function exportAllToExcel(options: Partial<ExportOptions> = {}, onProgress?: ProgressCallback): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  try {
    updateProgress(onProgress, { stage: 'loading', message: '正在加载数据...', current: 0, total: 100 });
    const xlsx = await ensureXLSX();
    const students = await getAllStudents();
    const allLessons = await getAllLessons();
    updateProgress(onProgress, { stage: 'processing', current: 30, total: 100 });
    let pm: Map<number, Payment[]> | undefined;
    if (opts.includePaymentInfo) { pm = await loadLessonPayments(allLessons); updateProgress(onProgress, { stage: 'processing', message: '正在加载支付信息...', current: 40, total: 100 }); }
    const wb = xlsx.utils.book_new();
    let done = 0;
    for (const s of students) {
      const subs = await getSubjectsByStudentId(s.id);
      const ls = allLessons.filter(l => l.studentId === s.id); if (ls.length === 0) continue;
      const { sheet: sd, rowHeights: rh } = buildStudentSheet(s, subs, ls, opts, pm);
      const ws = xlsx.utils.aoa_to_sheet(sd); ws['!cols'] = COL_WIDTHS; ws['!rows'] = rh;
      xlsx.utils.book_append_sheet(wb, ws, safeSheetName(s.name));
      updateProgress(onProgress, { stage: 'processing', message: `正在处理 ${s.name}...`, current: 40 + (++done / students.length) * 40, total: 100 });
    }
    if (wb.SheetNames.length === 0) xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([['无数据']]), '数据');
    updateProgress(onProgress, { stage: 'generating', message: '正在生成 Excel 文件...', current: 85, total: 100 });
    const r = await saveAndShareWorkbook(wb, `家教账单_全部_${new Date().toISOString().split('T')[0]}.xlsx`, '导出全部账单');
    updateProgress(onProgress, { stage: 'completed', message: '导出完成！', current: 100, total: 100 }); return r;
  } catch (e) { throw e instanceof ExportError ? e : new ExportError(`导出全部账单失败: ${e}`, 'EXPORT_ALL_ERROR', e); }
}

export async function exportByMonth(month: string, options: Partial<ExportOptions> = {}, onProgress?: ProgressCallback): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  try {
    updateProgress(onProgress, { stage: 'loading', current: 0, total: 100 });
    const xlsx = await ensureXLSX();
    const allStudents = await getAllStudents();
    let monthLessons = (await getAllLessons()).filter(l => l.date.startsWith(month));
    if (options.dateRange) monthLessons = monthLessons.filter(l => l.date >= options.dateRange!.start && l.date <= options.dateRange!.end);
    const students = allStudents.filter(s => [...new Set(monthLessons.map(l => l.studentId))].includes(s.id));
    const [y, m] = month.split('-');
    const title = opts.title || `${y}年${parseInt(m,10)}月 课程账单`;
    updateProgress(onProgress, { stage: 'processing', current: 20, total: 100 });
    let pm: Map<number, Payment[]> | undefined;
    if (opts.includePaymentInfo) pm = await loadLessonPayments(monthLessons);
    let tA = 0, tP = 0, tPe = 0, tH = 0, tC = 0;
    const sheet: any[][] = [], rh: any[] = [];
    if (opts.includeHeader) { sheet.push([cell(title, TITLE_STYLE)]); rh.push(ROW_HEIGHTS.title); sheet.push([]); rh.push(ROW_HEIGHTS.empty); }
    let done = 0;
    for (const s of students) {
      const subs = await getSubjectsByStudentId(s.id);
      const ls = monthLessons.filter(l => l.studentId === s.id); if (ls.length === 0) continue;
      const data = (() => { let h=0,a=0,pa=0,pe=0; const rows=[]; for(const l of [...ls].sort((a,b)=>a.date.localeCompare(b.date))){const sub=subs.find(x=>x.id===l.studentSubjectId);if(opts.statusFilter&&!opts.statusFilter.includes(l.status))continue;h+=l.duration;a+=l.amount;if(l.status==='paid')pa+=l.amount;else if(l.status==='pendingPayment')pe+=l.amount;const st=getStatusStyle(l.status);rows.push([cell(formatDate(l.date,opts.dateFormat),st),cell(sub?.subject||'',st),cell(l.timeSlot,st),cell(`${l.duration}h`,st),cell(formatCurrency(l.amount,opts.currencySymbol),st),cell(STATUS_LABEL[l.status]||l.status,st),...(opts.includeNotes?[cell(l.notes||'',st)]:[])]);} return {rows,totalHours:h,totalAmount:a,paidAmount:pa,pendingAmount:pe,rowCount:rows.length}; })();
      tC += data.rowCount; tH += data.totalHours; tA += data.totalAmount; tP += data.paidAmount; tPe += data.pendingAmount;
      sheet.push([cell(`${s.name}  ·  ${subs.map(x=>`${x.subject} ${x.hourlyRate}${opts.currencySymbol}/h`).join(' · ')}`, BOLD14_STYLE)]); rh.push(ROW_HEIGHTS.subheader);
      const hd = ['日期','学科','时间段','时长','金额','状态']; if (opts.includeNotes) hd.push('备注');
      sheet.push(hd.map(h => cell(h))); rh.push(ROW_HEIGHTS.header);
      for (const r of data.rows) { sheet.push(r); rh.push(ROW_HEIGHTS.data); }
      sheet.push([cell('小计:',BOLD14_STYLE),cell(''),cell(`${data.rowCount}节`,BOLD14_STYLE),cell(`${data.totalHours.toFixed(1)}h`,BOLD14_STYLE),cell(formatCurrency(data.totalAmount,opts.currencySymbol),BOLD14_STYLE),cell(''),cell('')]); rh.push(ROW_HEIGHTS.subheader);
      sheet.push([]); rh.push(ROW_HEIGHTS.empty);
      updateProgress(onProgress, { stage: 'processing', message: `正在处理 ${s.name}...`, current: 20 + (++done / students.length) * 50, total: 100 });
    }
    if (opts.includeLegend) { sheet.push([]); rh.push(ROW_HEIGHTS.empty); sheet.push([cell(''),cell(''),cell(''),cell(''),cell('✓ 已收款',PAID_STYLE),cell('待收款',PENDING_STYLE)]); rh.push(ROW_HEIGHTS.legend); }
    if (opts.includeTotal) { sheet.push([cell('总计:',BOLD16_STYLE),cell(''),cell(`${tC}节`,BOLD16_STYLE),cell(`${tH.toFixed(1)}h`,BOLD16_STYLE),cell(formatCurrency(tP,opts.currencySymbol),{...PAID_STYLE,font:{bold:true,sz:16}}),cell(formatCurrency(tPe,opts.currencySymbol),{...PENDING_STYLE,font:{bold:true,sz:16}}),cell(formatCurrency(tA,opts.currencySymbol),BOLD16_STYLE)]); rh.push(ROW_HEIGHTS.total); }
    updateProgress(onProgress, { stage: 'generating', current: 80, total: 100 });
    const wb = xlsx.utils.book_new(); const ws = xlsx.utils.aoa_to_sheet(sheet); ws['!cols'] = COL_WIDTHS; ws['!rows'] = rh;
    xlsx.utils.book_append_sheet(wb, ws, safeSheetName(title));
    const r = await saveAndShareWorkbook(wb, `家教账单_${month}.xlsx`, `导出 ${month} 账单`);
    updateProgress(onProgress, { stage: 'completed', message: '导出完成！', current: 100, total: 100 }); return r;
  } catch (e) { throw e instanceof ExportError ? e : new ExportError(`按月导出失败: ${e}`, 'EXPORT_MONTH_ERROR', e); }
}

export async function exportByStudent(studentId: number, options: Partial<ExportOptions> = {}, onProgress?: ProgressCallback): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  try {
    updateProgress(onProgress, { stage: 'loading', current: 0, total: 100 });
    await ensureXLSX(); const students = await getAllStudents(); const student = students.find(s => s.id === studentId); if (!student) throw new ExportError('学生不存在', 'STUDENT_NOT_FOUND');
    const subjects = await getSubjectsByStudentId(studentId); let sLessons = (await getAllLessons()).filter(l => l.studentId === studentId);
    if (options.dateRange) sLessons = sLessons.filter(l => l.date >= options.dateRange!.start && l.date <= options.dateRange!.end);
    updateProgress(onProgress, { stage: 'processing', current: 25, total: 100 });
    let pm: Map<number, Payment[]> | undefined;
    if (opts.includePaymentInfo) { updateProgress(onProgress, { stage: 'processing', message: '正在加载支付信息...', current: 35, total: 100 }); pm = await loadLessonPayments(sLessons); }
    updateProgress(onProgress, { stage: 'generating', current: 70, total: 100 });
    const xlsx = await ensureXLSX(); const wb = xlsx.utils.book_new();
    const { sheet: sd, rowHeights: rh } = buildStudentSheet(student, subjects, sLessons, opts, pm);
    const ws = xlsx.utils.aoa_to_sheet(sd); ws['!cols'] = COL_WIDTHS; ws['!rows'] = rh;
    xlsx.utils.book_append_sheet(wb, ws, safeSheetName(opts.sheetName || student.name));
    const r = await saveAndShareWorkbook(wb, `家教账单_${student.name}.xlsx`, `导出 ${student.name} 账单`);
    updateProgress(onProgress, { stage: 'completed', message: '导出完成！', current: 100, total: 100 }); return r;
  } catch (e) { throw e instanceof ExportError ? e : new ExportError(`按学生导出失败: ${e}`, 'EXPORT_STUDENT_ERROR', e); }
}

export async function exportCustomData(data: any[][], filename: string, options: { title?: string; headers?: string[]; columnWidths?: Array<{ wch: number }>; dialogTitle?: string } = {}, onProgress?: ProgressCallback): Promise<string> {
  try {
    updateProgress(onProgress, { stage: 'generating', current: 50, total: 100 });
    const xlsx = await ensureXLSX(); const wb = xlsx.utils.book_new(); const sheet: any[][] = []; const rh: any[] = [];
    if (options.title) { sheet.push([cell(options.title, TITLE_STYLE)]); rh.push(ROW_HEIGHTS.title); sheet.push([]); rh.push(ROW_HEIGHTS.empty); }
    if (options.headers) { sheet.push(options.headers.map(h => cell(h))); rh.push(ROW_HEIGHTS.header); }
    for (let i = 0; i < data.length; i++) { sheet.push(data[i]); rh.push(ROW_HEIGHTS.data); if (i % 100 === 0) updateProgress(onProgress, { stage: 'processing', message: `正在处理第 ${i+1}/${data.length} 行...`, current: 50 + (i / data.length) * 40, total: 100 }); }
    const ws = xlsx.utils.aoa_to_sheet(sheet); ws['!cols'] = options.columnWidths || COL_WIDTHS; ws['!rows'] = rh;
    xlsx.utils.book_append_sheet(wb, ws, safeSheetName(options.title || 'Sheet1'));
    const r = await saveAndShareWorkbook(wb, filename, options.dialogTitle || '导出数据');
    updateProgress(onProgress, { stage: 'completed', message: '导出完成！', current: 100, total: 100 }); return r;
  } catch (e) { throw new ExportError(`自定义导出失败: ${e}`, 'EXPORT_CUSTOM_ERROR', e); }
}

export function validateExportOptions(options: Partial<ExportOptions>): { valid: boolean; errors: string[] } {
  const errors: string[] = []; const validStatuses = Object.keys(STATUS_LABEL);
  if (options.dateRange && options.dateRange.start > options.dateRange.end) errors.push('日期范围开始时间不能晚于结束时间');
  if (options.statusFilter) { const bad = options.statusFilter.filter(s => !validStatuses.includes(s)); if (bad.length) errors.push(`无效的状态值: ${bad.join(', ')}`); }
  if (options.customFields) { const bad = options.customFields.filter(f => !['date','subject','timeSlot','duration','amount','status','notes','payment'].includes(f)); if (bad.length) errors.push(`无效的自定义字段: ${bad.join(', ')}`); }
  return { valid: errors.length === 0, errors };
}

export { ExportError };
