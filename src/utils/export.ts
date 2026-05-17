/**
 * ── export.ts ──────────────────────────────────────────────────────────────
 * Excel 导出模块：基于 xlsx-js-style 和 expo-file-system/expo-sharing。
 * 提供全部导出、按月导出、按学生导出、自定义导出四种模式。
 * 支持进度回调、状态筛选、日期范围、颜色标记等高级选项。
 * ────────────────────────────────────────────────────────────────────────────
 */
import { Platform } from 'react-native';
import * as XLSX from 'xlsx-js-style';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllStudents, getSubjectsByStudentId, getAllLessons, getPaymentsByLessonId } from '../database';
import { Student, StudentSubject, Lesson, Payment } from '../models';

/** 导出选项配置接口 */
export interface ExportOptions {
  includeHeader?: boolean;     // 是否包含标题行
  includeLegend?: boolean;    // 是否包含图例
  includeTotal?: boolean;     // 是否包含合计行
  includeNotes?: boolean;     // 是否包含备注列
  includePaymentInfo?: boolean; // 是否包含支付信息列
  dateFormat?: string;        // 日期格式（默认 YYYY-MM-DD）
  numberFormat?: string;      // 数字格式（默认 #,##0.00）
  currencySymbol?: string;    // 货币符号（默认 元）
  sheetName?: string;         // 工作表名称
  title?: string;             // 文档标题
  customFields?: string[];    // 自定义字段列表
  statusFilter?: string[];    // 状态筛选（只导出指定状态的课程）
  dateRange?: { start: string; end: string }; // 日期范围筛选
}

/** 导出进度信息接口 */
export interface ExportProgress {
  current: number;
  total: number;
  stage: 'preparing' | 'loading' | 'processing' | 'generating' | 'saving' | 'sharing' | 'completed';
  message: string;
}

/** 进度回调类型 */
export type ProgressCallback = (progress: ExportProgress) => void;

const STATUS_LABEL: Record<string, string> = {
  scheduled: '待上课',
  completed: '确认下课',
  pendingPayment: '待收款',
  paid: '✓ 已收款',
  cancelled: '已取消',
};

const PAID_STYLE = { fill: { fgColor: { rgb: 'D1FAE5' }, patternType: 'solid' as const } };
const PENDING_STYLE = { fill: { fgColor: { rgb: 'FEF3C7' }, patternType: 'solid' as const } };
const CANCELLED_STYLE = { fill: { fgColor: { rgb: 'FEE2E2' }, patternType: 'solid' as const } };
const COMPLETED_STYLE = { fill: { fgColor: { rgb: 'FEE2E2' }, patternType: 'solid' as const } };
const SCHEDULED_STYLE = { fill: { fgColor: { rgb: 'EEF2FF' }, patternType: 'solid' as const } };

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
  { wch: 12 },
  { wch: 14 },
  { wch: 18 },
  { wch: 20 },
];

const ROW_HEIGHTS = {
  title: { hpt: 30 },
  subheader: { hpt: 24 },
  header: { hpt: 20 },
  data: { hpt: 20 },
  empty: { hpt: 10 },
  total: { hpt: 28 },
  legend: { hpt: 20 },
};

const DEFAULT_OPTIONS: ExportOptions = {
  includeHeader: true,
  includeLegend: true,
  includeTotal: true,
  includeNotes: true,
  includePaymentInfo: false,
  dateFormat: 'YYYY-MM-DD',
  numberFormat: '#,##0.00',
  currencySymbol: '元',
};

class ExportError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'ExportError';
  }
}

function safeSheetName(name: string): string {
  return name.replace(/[\\\/\*\?\[\]:]/g, '-').slice(0, 31);
}

function cell(v: any, s?: object) {
  return s ? { v, s } : { v };
}

function formatDate(dateStr: string, format: string = 'YYYY-MM-DD'): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes);
}

function formatNumber(num: number, format: string = '#,##0'): string {
  if (format.includes(',')) {
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return num.toFixed(0);
}

function formatCurrency(amount: number, symbol: string = '元'): string {
  return `${formatNumber(amount)}${symbol}`;
}

function getStatusStyle(status: string): object | undefined {
  switch (status) {
    case 'paid': return PAID_STYLE;
    case 'pendingPayment': return PENDING_STYLE;
    case 'cancelled': return CANCELLED_STYLE;
    case 'completed': return COMPLETED_STYLE;
    case 'scheduled': return SCHEDULED_STYLE;
    default: return undefined;
  }
}

async function loadLessonPayments(lessons: Lesson[]): Promise<Map<number, Payment[]>> {
  const paymentMap = new Map<number, Payment[]>();
  for (const lesson of lessons) {
    try {
      const payments = await getPaymentsByLessonId(lesson.id);
      paymentMap.set(lesson.id, payments);
    } catch (error) {
      paymentMap.set(lesson.id, []);
    }
  }
  return paymentMap;
}

function buildLessonRows(
  lessons: Lesson[],
  subjects: StudentSubject[],
  options: ExportOptions,
  paymentMap?: Map<number, Payment[]>
): { rows: any[][]; totalHours: number; totalAmount: number; paidAmount: number; pendingAmount: number } {
  const sorted = [...lessons].sort((a, b) =>
    a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot)
  );

  let totalHours = 0, totalAmount = 0, paidAmount = 0, pendingAmount = 0;
  const rows: any[][] = [];

  for (const l of sorted) {
    const sub = subjects.find(s => s.id === l.studentSubjectId);

    if (options.statusFilter && !options.statusFilter.includes(l.status)) {
      continue;
    }

    totalHours += l.duration;
    totalAmount += l.amount;

    if (l.status === 'paid') paidAmount += l.amount;
    else if (l.status === 'pendingPayment') pendingAmount += l.amount;

    const style = getStatusStyle(l.status);
    const payments = paymentMap?.get(l.id) || [];
    const paymentInfo = payments.length > 0
      ? `${payments[0].method} ${formatCurrency(payments[0].amount)}`
      : '';

    const row = [
      cell(formatDate(l.date, options.dateFormat), style),
      cell(sub?.subject || '', style),
      cell(l.timeSlot, style),
      cell(`${l.duration}h`, style),
      cell(formatCurrency(l.amount, options.currencySymbol), style),
      cell(STATUS_LABEL[l.status] || l.status, style),
      ...(options.includeNotes ? [cell(l.notes || '', style)] : []),
      ...(options.includePaymentInfo ? [cell(paymentInfo, style)] : []),
    ];

    rows.push(row);
  }

  return { rows, totalHours, totalAmount, paidAmount, pendingAmount };
}

function buildStudentSheet(
  student: Student,
  subjects: StudentSubject[],
  lessons: Lesson[],
  options: ExportOptions,
  paymentMap?: Map<number, Payment[]>
): { sheet: any[][]; rowHeights: Array<{ hpt: number }> } {
  const subjectInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}${options.currencySymbol}/h`).join(' · ');
  const { rows, totalHours, totalAmount, paidAmount, pendingAmount } = buildLessonRows(lessons, subjects, options, paymentMap);

  const sheet: any[][] = [];
  const rowHeights: Array<{ hpt: number }> = [];

  if (options.includeHeader) {
    sheet.push([cell(options.title || '家教课程总账单', TITLE_STYLE)]);
    rowHeights.push(ROW_HEIGHTS.title);

    const studentInfo = `学生: ${student.name}${student.phone ? `    电话: ${student.phone}` : ''}${subjectInfo ? `    ${subjectInfo}` : ''}`;
    sheet.push([cell(studentInfo, BOLD14_STYLE)]);
    rowHeights.push(ROW_HEIGHTS.subheader);

    sheet.push([]);
    rowHeights.push(ROW_HEIGHTS.empty);
  }

  const headers = ['日期', '学科', '时间段', '时长', '金额', '状态'];
  if (options.includeNotes) headers.push('备注');
  if (options.includePaymentInfo) headers.push('支付信息');
  
  sheet.push(headers.map(h => cell(h)));
  rowHeights.push(ROW_HEIGHTS.header);

  for (const row of rows) {
    sheet.push(row);
    rowHeights.push(ROW_HEIGHTS.data);
  }

  if (options.includeLegend) {
    sheet.push([]);
    rowHeights.push(ROW_HEIGHTS.empty);

    sheet.push([
      cell('', undefined), cell('', undefined), cell('', undefined), 
      cell('', undefined), cell('', undefined), 
      cell('✓ 已收款', PAID_STYLE),
      cell('待收款', PENDING_STYLE),
    ]);
    rowHeights.push(ROW_HEIGHTS.legend);
  }

  if (options.includeTotal) {
    sheet.push([
      cell('合计:', BOLD16_STYLE), cell(''),
      cell(`${lessons.length}节`, BOLD16_STYLE),
      cell(`${totalHours.toFixed(1)}h`, BOLD16_STYLE),
      cell(formatCurrency(totalAmount, options.currencySymbol), BOLD16_STYLE),
      cell(formatCurrency(paidAmount, options.currencySymbol), { ...PAID_STYLE, font: { bold: true, sz: 16 } }),
      cell(formatCurrency(pendingAmount, options.currencySymbol), { ...PENDING_STYLE, font: { bold: true, sz: 16 } }),
    ]);
    rowHeights.push(ROW_HEIGHTS.total);
  }

  return { sheet, rowHeights };
}

async function saveAndShareWorkbook(wb: XLSX.WorkBook, filename: string, dialogTitle: string): Promise<string> {
  try {
    // ── Web 端：Blob 下载 ──
    if (Platform.OS === 'web') {
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      return filename;
    }

    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const path = FileSystem.documentDirectory + filename;

    await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });

    await Sharing.shareAsync(path, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle,
    });

    return path;
  } catch (error) {
    throw new ExportError('保存或分享文件失败', 'FILE_ERROR', error);
  }
}

function updateProgress(callback: ProgressCallback | undefined, progress: Partial<ExportProgress>) {
  if (callback) {
    callback({
      current: progress.current || 0,
      total: progress.total || 0,
      stage: progress.stage || 'preparing',
      message: progress.message || '',
    });
  }
}

/**
 * 导出所有学生课程账单到 Excel。
 * 每个学生一个 sheet，包含课程明细、状态颜色标记、合计行。
 * @param options 导出选项（标题、筛选、格式等）
 * @param onProgress 进度回调
 * @returns 导出文件路径
 */
export async function exportAllToExcel(
  options: Partial<ExportOptions> = {},
  onProgress?: ProgressCallback
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    updateProgress(onProgress, { stage: 'loading', message: '正在加载数据...', current: 0, total: 100 });

    const students = await getAllStudents();
    const allLessons = await getAllLessons();

    updateProgress(onProgress, { stage: 'processing', message: '正在处理数据...', current: 30, total: 100 });

    let paymentMap: Map<number, Payment[]> | undefined;
    if (opts.includePaymentInfo) {
      updateProgress(onProgress, { stage: 'processing', message: '正在加载支付信息...', current: 40, total: 100 });
      paymentMap = await loadLessonPayments(allLessons);
    }

    const wb = XLSX.utils.book_new();
    let processedCount = 0;

    for (const student of students) {
      const subjects = await getSubjectsByStudentId(student.id);
      const sLessons = allLessons.filter(l => l.studentId === student.id);

      if (sLessons.length === 0) continue;

      const { sheet: sheetData, rowHeights } = buildStudentSheet(student, subjects, sLessons, opts, paymentMap);
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = COL_WIDTHS;
      ws['!rows'] = rowHeights;
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(student.name));

      processedCount++;
      updateProgress(onProgress, {
        stage: 'processing',
        message: `正在处理 ${student.name}...`,
        current: 40 + (processedCount / students.length) * 40,
        total: 100
      });
    }

    // 无数据时创建一个空白占位 sheet，避免 XLSX.write 空工作簿报错
    if (wb.SheetNames.length === 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['无数据']]), '数据');
    }

    updateProgress(onProgress, { stage: 'generating', message: '正在生成 Excel 文件...', current: 85, total: 100 });

    const timestamp = new Date().toISOString().split('T')[0];
    const path = await saveAndShareWorkbook(
      wb,
      `家教账单_全部_${timestamp}.xlsx`,
      '导出全部账单'
    );

    updateProgress(onProgress, { stage: 'completed', message: '导出完成！', current: 100, total: 100 });

    return path;
  } catch (error) {
    if (error instanceof ExportError) throw error;
    throw new ExportError(`导出全部账单失败: ${error}`, 'EXPORT_ALL_ERROR', error);
  }
}

/**
 * 按月份导出指定月份的账单汇总。
 * 一张 sheet 按学生分组，带小计和总计。
 * @param month 月份（"YYYY-MM"）
 * @param options 导出选项
 * @param onProgress 进度回调
 * @returns 导出文件路径
 */
export async function exportByMonth(
  month: string,
  options: Partial<ExportOptions> = {},
  onProgress?: ProgressCallback
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    updateProgress(onProgress, { stage: 'loading', message: '正在加载数据...', current: 0, total: 100 });

    const allStudents = await getAllStudents();
    const allLessons = await getAllLessons();
    
    let monthLessons = allLessons.filter(l => l.date.startsWith(month));
    
    if (options.dateRange) {
      monthLessons = monthLessons.filter(l => 
        l.date >= options.dateRange!.start && l.date <= options.dateRange!.end
      );
    }

    const studentIds = [...new Set(monthLessons.map(l => l.studentId))];
    const students = allStudents.filter(s => studentIds.includes(s.id));

    const [y, m] = month.split('-');
    const title = opts.title || `${y}年${parseInt(m, 10)}月 课程账单`;

    updateProgress(onProgress, { stage: 'processing', message: '正在处理数据...', current: 20, total: 100 });

    let paymentMap: Map<number, Payment[]> | undefined;
    if (opts.includePaymentInfo) {
      paymentMap = await loadLessonPayments(monthLessons);
    }

    let monthTotal = 0, monthPaid = 0, monthPending = 0, monthHours = 0, monthLessonsCount = 0;

    const sheet: any[][] = [];
    const rowHeights: Array<{ hpt: number }> = [];

    if (opts.includeHeader) {
      sheet.push([cell(title, TITLE_STYLE)]);
      rowHeights.push(ROW_HEIGHTS.title);

      sheet.push([]);
      rowHeights.push(ROW_HEIGHTS.empty);
    }

    let processedCount = 0;
    for (const student of students) {
      const subjects = await getSubjectsByStudentId(student.id);
      const sLessons = monthLessons.filter(l => l.studentId === student.id);
      if (sLessons.length === 0) continue;

      const data = buildLessonRows(sLessons, subjects, opts, paymentMap);

      monthLessonsCount += data.rows.length;
      monthHours += data.totalHours;
      monthTotal += data.totalAmount;
      monthPaid += data.paidAmount;
      monthPending += data.pendingAmount;

      const subInfo = subjects.map(s => `${s.subject} ${s.hourlyRate}${opts.currencySymbol}/h`).join(' · ');
      sheet.push([cell(`${student.name}  ·  ${subInfo}`, BOLD14_STYLE)]);
      rowHeights.push(ROW_HEIGHTS.subheader);

      const headers = ['日期', '学科', '时间段', '时长', '金额', '状态'];
      if (opts.includeNotes) headers.push('备注');
      if (opts.includePaymentInfo) headers.push('支付信息');
      
      sheet.push(headers.map(h => cell(h)));
      rowHeights.push(ROW_HEIGHTS.header);

      for (const row of data.rows) {
        sheet.push(row);
        rowHeights.push(ROW_HEIGHTS.data);
      }

      sheet.push([
        cell('小计:', BOLD14_STYLE), cell(''),
        cell(`${data.rows.length}节`, BOLD14_STYLE),
        cell(`${data.totalHours.toFixed(1)}h`, BOLD14_STYLE),
        cell(formatCurrency(data.totalAmount, opts.currencySymbol), BOLD14_STYLE),
        cell(''), cell(''),
      ]);
      rowHeights.push(ROW_HEIGHTS.subheader);

      sheet.push([]);
      rowHeights.push(ROW_HEIGHTS.empty);

      processedCount++;
      updateProgress(onProgress, {
        stage: 'processing',
        message: `正在处理 ${student.name}...`,
        current: 20 + (processedCount / students.length) * 50,
        total: 100
      });
    }

    if (opts.includeLegend) {
      sheet.push([
        cell(''), cell(''), cell(''), cell(''), cell(''),
        cell('✓ 已收款', PAID_STYLE),
        cell('待收款', PENDING_STYLE),
      ]);
      rowHeights.push(ROW_HEIGHTS.legend);
    }

    if (opts.includeTotal) {
      sheet.push([
        cell('总计:', BOLD16_STYLE), cell(''),
        cell(`${monthLessonsCount}节`, BOLD16_STYLE),
        cell(`${monthHours.toFixed(1)}h`, BOLD16_STYLE),
        cell(formatCurrency(monthTotal, opts.currencySymbol), BOLD16_STYLE),
        cell(formatCurrency(monthPaid, opts.currencySymbol), { ...PAID_STYLE, font: { bold: true, sz: 16 } }),
        cell(formatCurrency(monthPending, opts.currencySymbol), { ...PENDING_STYLE, font: { bold: true, sz: 16 } }),
      ]);
      rowHeights.push(ROW_HEIGHTS.total);
    }

    updateProgress(onProgress, { stage: 'generating', message: '正在生成 Excel 文件...', current: 80, total: 100 });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheet);
    ws['!cols'] = COL_WIDTHS;
    ws['!rows'] = rowHeights;
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(title));

    const path = await saveAndShareWorkbook(wb, `家教账单_${month}.xlsx`, `导出 ${month} 账单`);

    updateProgress(onProgress, { stage: 'completed', message: '导出完成！', current: 100, total: 100 });

    return path;
  } catch (error) {
    if (error instanceof ExportError) throw error;
    throw new ExportError(`按月导出失败: ${error}`, 'EXPORT_MONTH_ERROR', error);
  }
}

/**
 * 导出单个学生的完整账单。
 * @param studentId 学生 ID
 * @param options 导出选项
 * @param onProgress 进度回调
 * @returns 导出文件路径
 */
export async function exportByStudent(
  studentId: number,
  options: Partial<ExportOptions> = {},
  onProgress?: ProgressCallback
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    updateProgress(onProgress, { stage: 'loading', message: '正在加载学生信息...', current: 0, total: 100 });

    const students = await getAllStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) throw new ExportError('学生不存在', 'STUDENT_NOT_FOUND');

    const subjects = await getSubjectsByStudentId(studentId);
    const allLessons = await getAllLessons();

    updateProgress(onProgress, { stage: 'processing', message: '正在筛选课程数据...', current: 25, total: 100 });

    let sLessons = allLessons.filter(l => l.studentId === studentId);
    
    if (options.dateRange) {
      sLessons = sLessons.filter(l => 
        l.date >= options.dateRange!.start && l.date <= options.dateRange!.end
      );
    }

    let paymentMap: Map<number, Payment[]> | undefined;
    if (opts.includePaymentInfo) {
      updateProgress(onProgress, { stage: 'processing', message: '正在加载支付信息...', current: 35, total: 100 });
      paymentMap = await loadLessonPayments(sLessons);
    }

    updateProgress(onProgress, { stage: 'generating', message: '正在生成 Excel 文件...', current: 70, total: 100 });

    const wb = XLSX.utils.book_new();
    const { sheet: sheetData, rowHeights } = buildStudentSheet(student, subjects, sLessons, opts, paymentMap);
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = COL_WIDTHS;
    ws['!rows'] = rowHeights;
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(opts.sheetName || student.name));

    const path = await saveAndShareWorkbook(
      wb,
      `家教账单_${student.name}.xlsx`,
      `导出 ${student.name} 账单`
    );

    updateProgress(onProgress, { stage: 'completed', message: '导出完成！', current: 100, total: 100 });

    return path;
  } catch (error) {
    if (error instanceof ExportError) throw error;
    throw new ExportError(`按学生导出失败: ${error}`, 'EXPORT_STUDENT_ERROR', error);
  }
}

/**
 * 导出自定义数据（二维数组）到 Excel。
 * @param data 数据二维数组
 * @param filename 文件名
 * @param options 配置（标题、表头、列宽、弹窗标题）
 * @param onProgress 进度回调
 * @returns 导出文件路径
 */
export async function exportCustomData(
  data: any[][],
  filename: string,
  options: {
    title?: string;
    headers?: string[];
    columnWidths?: Array<{ wch: number }>;
    dialogTitle?: string;
  } = {},
  onProgress?: ProgressCallback
): Promise<string> {
  try {
    updateProgress(onProgress, { stage: 'generating', message: '正在生成自定义 Excel 文件...', current: 50, total: 100 });

    const wb = XLSX.utils.book_new();
    const sheet: any[][] = [];
    const rowHeights: Array<{ hpt: number }> = [];

    if (options.title) {
      sheet.push([cell(options.title, TITLE_STYLE)]);
      rowHeights.push(ROW_HEIGHTS.title);
      sheet.push([]);
      rowHeights.push(ROW_HEIGHTS.empty);
    }

    if (options.headers) {
      sheet.push(options.headers.map(h => cell(h)));
      rowHeights.push(ROW_HEIGHTS.header);
    }

    for (let i = 0; i < data.length; i++) {
      sheet.push(data[i]);
      rowHeights.push(ROW_HEIGHTS.data);
      
      if (i % 100 === 0) {
        updateProgress(onProgress, {
          stage: 'processing',
          message: `正在处理第 ${i + 1}/${data.length} 行...`,
          current: 50 + (i / data.length) * 40,
          total: 100
        });
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(sheet);
    ws['!cols'] = options.columnWidths || COL_WIDTHS;
    ws['!rows'] = rowHeights;
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(options.title || 'Sheet1'));

    const path = await saveAndShareWorkbook(
      wb,
      filename,
      options.dialogTitle || '导出数据'
    );

    updateProgress(onProgress, { stage: 'completed', message: '导出完成！', current: 100, total: 100 });

    return path;
  } catch (error) {
    throw new ExportError(`自定义导出失败: ${error}`, 'EXPORT_CUSTOM_ERROR', error);
  }
}

/**
 * 校验导出选项的合法性。
 * @param options 待校验的导出选项
 * @returns 校验结果 { valid: 是否合法, errors: 错误信息列表 }
 */
export function validateExportOptions(options: Partial<ExportOptions>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (options.dateRange) {
    if (options.dateRange.start > options.dateRange.end) {
      errors.push('日期范围开始时间不能晚于结束时间');
    }
  }

  if (options.statusFilter) {
    const validStatuses = Object.keys(STATUS_LABEL);
    const invalidStatuses = options.statusFilter.filter(s => !validStatuses.includes(s));
    if (invalidStatuses.length > 0) {
      errors.push(`无效的状态值: ${invalidStatuses.join(', ')}`);
    }
  }

  if (options.customFields) {
    const allowedFields = ['date', 'subject', 'timeSlot', 'duration', 'amount', 'status', 'notes', 'payment'];
    const invalidFields = options.customFields.filter(f => !allowedFields.includes(f));
    if (invalidFields.length > 0) {
      errors.push(`无效的自定义字段: ${invalidFields.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export { ExportError };
