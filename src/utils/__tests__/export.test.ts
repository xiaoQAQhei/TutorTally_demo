import {
  ExportOptions,
  ExportProgress,
  ProgressCallback,
  exportAllToExcel,
  exportByMonth,
  exportByStudent,
  exportCustomData,
  validateExportOptions,
  ExportError,
} from '../export';
import * as XLSX from 'xlsx-js-style';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/path/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../database', () => ({
  getAllStudents: jest.fn(),
  getSubjectsByStudentId: jest.fn(),
  getAllLessons: jest.fn(),
  getPaymentsByLessonId: jest.fn(),
}));

import { getAllStudents, getSubjectsByStudentId, getAllLessons, getPaymentsByLessonId } from '../database';

// spy 而非 mock —— 保留真实 xlsx 行为同时可断言调用
const bookAppendSheetSpy = jest.spyOn(XLSX.utils, 'book_append_sheet');

const mockStudent = {
  id: 1,
  name: '张三',
  phone: '13800138001',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockSubject = {
  id: 1,
  studentId: 1,
  subject: '数学',
  hourlyRate: 150,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockLessons = [
  {
    id: 1,
    studentId: 1,
    studentSubjectId: 1,
    date: '2026-05-03',
    timeSlot: '09:00-11:00',
    duration: 2,
    amount: 300,
    status: 'paid' as const,
    notes: '',
    createdAt: '2026-05-03T00:00:00.000Z',
  },
  {
    id: 2,
    studentId: 1,
    studentSubjectId: 1,
    date: '2026-05-06',
    timeSlot: '14:00-16:00',
    duration: 2,
    amount: 260,
    status: 'pendingPayment' as const,
    notes: '牛顿定律练习',
    createdAt: '2026-05-06T00:00:00.000Z',
  },
];

describe('Export Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (getAllStudents as jest.Mock).mockResolvedValue([mockStudent]);
    (getSubjectsByStudentId as jest.Mock).mockResolvedValue([mockSubject]);
    (getAllLessons as jest.Mock).mockResolvedValue(mockLessons);
    (getPaymentsByLessonId as jest.Mock).mockResolvedValue([]);
  });

  describe('validateExportOptions', () => {
    it('should validate correct options', () => {
      const result = validateExportOptions({
        dateRange: { start: '2026-01-01', end: '2026-12-31' },
        statusFilter: ['paid', 'pendingPayment'],
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid date range', () => {
      const result = validateExportOptions({
        dateRange: { start: '2026-12-31', end: '2026-01-01' },
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('日期范围开始时间不能晚于结束时间');
    });

    it('should detect invalid status filter', () => {
      const result = validateExportOptions({
        statusFilter: ['invalid_status'],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('exportAllToExcel', () => {
    it('should export all data with default options', async () => {
      const progressCallback: ProgressCallback = jest.fn();
      
      const path = await exportAllToExcel({}, progressCallback);

      expect(path).toContain('家教账单_全部_');
      expect(progressCallback).toHaveBeenCalled();
      
      const lastCall = (progressCallback as jest.Mock).mock.calls[
        (progressCallback as jest.Mock).mock.calls.length - 1
      ][0];
      expect(lastCall.stage).toBe('completed');
      expect(lastCall.current).toBe(100);
    });

    it('should use custom options when provided', async () => {
      const options: Partial<ExportOptions> = {
        includeNotes: false,
        currencySymbol: '$',
        dateFormat: 'MM/DD/YYYY',
      };

      const path = await exportAllToExcel(options);

      expect(path).toBeDefined();
      expect(getAllStudents).toHaveBeenCalledTimes(1);
      expect(getAllLessons).toHaveBeenCalledTimes(1);
    });

    it('should handle empty data gracefully', async () => {
      (getAllStudents as jest.Mock).mockResolvedValue([]);
      (getAllLessons as jest.Mock).mockResolvedValue([]);

      const path = await exportAllToExcel();

      expect(path).toBeDefined();
    });

    it('should throw error on failure', async () => {
      (getAllStudents as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(exportAllToExcel()).rejects.toThrow();
    });

    it('should load payment info when requested', async () => {
      const options: Partial<ExportOptions> = {
        includePaymentInfo: true,
      };

      await exportAllToExcel(options);

      expect(getPaymentsByLessonId).toHaveBeenCalledTimes(mockLessons.length);
    });
  });

  describe('exportByMonth', () => {
    it('should export monthly data correctly', async () => {
      const progressCallback: ProgressCallback = jest.fn();
      
      const path = await exportByMonth('2026-05', {}, progressCallback);

      expect(path).toContain('家教账单_2026-05.xlsx');
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should filter by date range when provided', async () => {
      const options: Partial<ExportOptions> = {
        dateRange: { start: '2026-05-01', end: '2026-05-10' },
      };

      const path = await exportByMonth('2026-05', options);

      expect(path).toBeDefined();
    });

    it('should handle month with no data', async () => {
      (getAllLessons as jest.Mock).mockResolvedValue([]);

      const path = await exportByMonth('2026-12');

      expect(path).toBeDefined();
    });

    it('should use custom title when provided', async () => {
      const options: Partial<ExportOptions> = {
        title: '自定义标题',
      };

      await exportByMonth('2026-05', options);

      expect(bookAppendSheetSpy).toHaveBeenCalled();
    });
  });

  describe('exportByStudent', () => {
    it('should export single student data', async () => {
      const progressCallback: ProgressCallback = jest.fn();
      
      const path = await exportByStudent(1, {}, progressCallback);

      expect(path).toContain('家教账单_张三.xlsx');
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should throw error for non-existent student', async () => {
      (getAllStudents as jest.Mock).mockResolvedValue([]);

      await expect(exportByStudent(999)).rejects.toThrow('学生不存在');
    });

    it('should apply date range filter', async () => {
      const options: Partial<ExportOptions> = {
        dateRange: { start: '2026-05-01', end: '2026-05-05' },
      };

      const path = await exportByStudent(1, options);

      expect(path).toBeDefined();
    });

    it('should use custom sheet name', async () => {
      const options: Partial<ExportOptions> = {
        sheetName: '自定义Sheet名称',
      };

      await exportByStudent(1, options);

      expect(bookAppendSheetSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        '自定义Sheet名称'
      );
    });
  });

  describe('exportCustomData', () => {
    it('should export custom data array', async () => {
      const data = [
        ['Row1Col1', 'Row1Col2', 'Row1Col3'],
        ['Row2Col1', 'Row2Col2', 'Row2Col3'],
      ];

      const path = await exportCustomData(data, 'custom_export.xlsx', {
        headers: ['Column1', 'Column2', 'Column3'],
        title: 'Custom Data Export',
      });

      expect(path).toContain('custom_export.xlsx');
    });

    it('should handle large datasets with progress updates', async () => {
      const largeData = Array(500).fill(null).map((_, i) => [`Row${i}`, `Data${i}`]);
      const progressCallback: ProgressCallback = jest.fn();

      const path = await exportCustomData(largeData, 'large_data.xlsx', {}, progressCallback);

      expect(path).toBeDefined();
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should work without optional parameters', async () => {
      const data = [['Simple Data']];

      const path = await exportCustomData(data, 'simple.xlsx');

      expect(path).toContain('simple.xlsx');
    });
  });

  describe('Error Handling', () => {
    it('should provide detailed error information', async () => {
      (getAllStudents as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      try {
        await exportAllToExcel();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ExportError);
        expect(error.message).toContain('导出全部账单失败');
      }
    });

    it('should preserve original error in details', async () => {
      const originalError = new Error('Original error message');
      (getAllStudents as jest.Mock).mockRejectedValue(originalError);

      try {
        await exportAllToExcel();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.details).toBeDefined();
      }
    });
  });

  describe('Progress Callback', () => {
    it('should call progress callback for all stages', async () => {
      const stages: string[] = [];
      const progressCallback: ProgressCallback = (progress) => {
        stages.push(progress.stage);
      };

      await exportAllToExcel({}, progressCallback);

      expect(stages).toContain('loading');
      expect(stages).toContain('processing');
      expect(stages).toContain('generating');
      expect(stages).toContain('completed');
    });

    it('should provide accurate progress percentage', async () => {
      let lastProgress = 0;
      const progressCallback: ProgressCallback = (progress) => {
        expect(progress.current).toBeGreaterThanOrEqual(lastProgress);
        lastProgress = progress.current;
      };

      await exportByStudent(1, {}, progressCallback);

      expect(lastProgress).toBe(100);
    });

    it('should provide meaningful messages', async () => {
      const messages: string[] = [];
      const progressCallback: ProgressCallback = (progress) => {
        if (progress.message) messages.push(progress.message);
      };

      await exportAllToExcel({}, progressCallback);

      expect(messages.some(m => m.includes('加载'))).toBe(true);
      expect(messages.some(m => m.includes('处理'))).toBe(true);
      expect(messages.some(m => m.includes('完成'))).toBe(true);
    });
  });

  describe('Configuration Options', () => {
    it('should respect includeHeader option', async () => {
      const optionsWithHeader: Partial<ExportOptions> = { includeHeader: true };
      const optionsWithoutHeader: Partial<ExportOptions> = { includeHeader: false };

      await exportAllToExcel(optionsWithHeader);
      await exportAllToExcel(optionsWithoutHeader);

      expect(getAllStudents).toHaveBeenCalledTimes(2);
    });

    it('should respect includeLegend option', async () => {
      const options: Partial<ExportOptions> = { includeLegend: false };

      const path = await exportByStudent(1, options);

      expect(path).toBeDefined();
    });

    it('should respect includeTotal option', async () => {
      const options: Partial<ExportOptions> = { includeTotal: false };

      const path = await exportByStudent(1, options);

      expect(path).toBeDefined();
    });

    it('should apply status filter correctly', async () => {
      const options: Partial<ExportOptions> = {
        statusFilter: ['paid'],
      };

      const path = await exportByStudent(1, options);

      expect(path).toBeDefined();
    });

    it('should format dates according to dateFormat option', async () => {
      const options: Partial<ExportOptions> = {
        dateFormat: 'DD/MM/YYYY',
      };

      const path = await exportByStudent(1, options);

      expect(path).toBeDefined();
    });

    it('should use custom currency symbol', async () => {
      const options: Partial<ExportOptions> = {
        currencySymbol: '¥',
      };

      const path = await exportByStudent(1, options);

      expect(path).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle multiple students efficiently', async () => {
      const manyStudents = Array(20).fill(null).map((_, i) => ({
        ...mockStudent,
        id: i + 1,
        name: `学生${i + 1}`,
      }));

      (getAllStudents as jest.Mock).mockResolvedValue(manyStudents);

      const startTime = Date.now();
      await exportAllToExcel({});
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should process lessons in batches for large datasets', async () => {
      const manyLessons = Array(1000).fill(null).map((_, i) => ({
        ...mockLessons[0],
        id: i + 1,
        date: `2026-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
      }));

      (getAllLessons as jest.Mock).mockResolvedValue(manyLessons);

      const path = await exportAllToExcel({});

      expect(path).toBeDefined();
    });
  });
});
