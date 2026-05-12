import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Button } from 'react-native-paper';
import {
  exportAllToExcel,
  exportByMonth,
  exportByStudent,
  exportCustomData,
  validateExportOptions,
  ExportOptions,
  ExportProgress,
} from '../utils/export';

export const ExcelExportExample: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  const handleProgressUpdate = (progressInfo: ExportProgress) => {
    setProgress(progressInfo);
    console.log(`[${progressInfo.stage}] ${progressInfo.message} (${progressInfo.current}/${progressInfo.total})`);
  };

  const handleExportAll = async () => {
    try {
      setIsExporting(true);
      setProgress(null);

      const options: Partial<ExportOptions> = {
        includeHeader: true,
        includeLegend: true,
        includeTotal: true,
        includeNotes: true,
        includePaymentInfo: true,
        dateFormat: 'YYYY-MM-DD',
        currencySymbol: '元',
      };

      const validation = validateExportOptions(options);
      if (!validation.valid) {
        Alert.alert('配置错误', validation.errors.join('\n'));
        return;
      }

      const path = await exportAllToExcel(options, handleProgressUpdate);
      
      Alert.alert('导出成功', `文件已保存到：${path}`);
    } catch (error) {
      console.error('导出失败:', error);
      Alert.alert('导出失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportByMonth = async () => {
    try {
      setIsExporting(true);
      setProgress(null);

      const currentDate = new Date();
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

      const options: Partial<ExportOptions> = {
        title: `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月 课程账单`,
        statusFilter: ['paid', 'pendingPayment'],
        dateRange: {
          start: `${monthKey}-01`,
          end: `${monthKey}-31`,
        },
      };

      const path = await exportByMonth(monthKey, options, handleProgressUpdate);
      
      Alert.alert('导出成功', `月度账单已导出：${path}`);
    } catch (error) {
      console.error('按月导出失败:', error);
      Alert.alert('导出失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportStudent = async (studentId: number) => {
    try {
      setIsExporting(true);
      setProgress(null);

      const options: Partial<ExportOptions> = {
        sheetName: '学生详细账单',
        includePaymentInfo: true,
        currencySymbol: '¥',
        dateFormat: 'YYYY年MM月DD日',
      };

      const path = await exportByStudent(studentId, options, handleProgressUpdate);
      
      Alert.alert('导出成功', `学生账单已导出：${path}`);
    } catch (error) {
      console.error('按学生导出失败:', error);
      Alert.alert('导出失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCustomExport = async () => {
    try {
      setIsExporting(true);
      setProgress(null);

      const customData = [
        ['2026-05-01', '数学', '09:00-11:00', '2h', '300.00元', '✓ 已收款', '复习函数'],
        ['2026-05-03', '英语', '14:00-16:00', '2h', '240.00元', '待收款', '口语练习'],
        ['2026-05-05', '物理', '10:00-12:00', '2h', '320.00元', '确认下课', '力学基础'],
      ];

      const path = await exportCustomData(
        customData,
        '自定义数据导出.xlsx',
        {
          title: '自定义课程数据',
          headers: ['日期', '学科', '时间段', '时长', '金额', '状态', '备注'],
          dialogTitle: '导出自定义数据',
        },
        handleProgressUpdate
      );

      Alert.alert('导出成功', `自定义数据已导出：${path}`);
    } catch (error) {
      console.error('自定义导出失败:', error);
      Alert.alert('导出失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsExporting(false);
    }
  };

  const getProgressPercentage = (): number => {
    if (!progress) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Excel 导出功能示例</Text>

      {isExporting && (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="large" color="#0070C0" />
          {progress && (
            <>
              <Text style={styles.progressText}>{progress.message}</Text>
              <Text style={styles.percentage}>{getProgressPercentage()}%</Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { width: `${getProgressPercentage()}%` }
                  ]} 
                />
              </View>
            </>
          )}
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleExportAll}
          disabled={isExporting}
          style={styles.button}
        >
          导出全部账单
        </Button>

        <Button
          mode="contained"
          onPress={handleExportByMonth}
          disabled={isExporting}
          style={styles.button}
        >
          导出本月账单
        </Button>

        <Button
          mode="contained"
          onPress={() => handleExportStudent(1)}
          disabled={isExporting}
          style={styles.button}
        >
          导出学生账单 (ID: 1)
        </Button>

        <Button
          mode="outlined"
          onPress={handleCustomExport}
          disabled={isExporting}
          style={styles.button}
        >
          自定义数据导出
        </Button>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>功能特性：</Text>
        <Text style={styles.infoItem}>✓ 支持多种导出模式（全部/按月/按学生/自定义）</Text>
        <Text style={styles.infoItem}>✓ 可配置的导出选项（字段、格式、筛选）</Text>
        <Text style={styles.infoItem}>✓ 实时进度反馈和错误处理</Text>
        <Text style={styles.infoItem}>✓ 支付信息集成</Text>
        <Text style={styles.infoItem}>✓ 多种状态颜色标识</Text>
        <Text style={styles.infoItem}>✓ 自定义日期和货币格式</Text>
        <Text style={styles.infoItem}>✓ 大数据量性能优化</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  progressContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  percentage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0070C0',
    marginVertical: 5,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0070C0',
    borderRadius: 4,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 4,
  },
  infoContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  infoItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});

export default ExcelExportExample;
