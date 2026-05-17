/**
 * ── ExportFlowModal.tsx ──────────────────────────────────────────────────────
 * 多步导出流程弹窗：选格式 → 选数据类型 → 选月份/学生 → 预览 → 确认导出。
 *
 * 流程：
 *   choose_format → choose_scope → choose_month / choose_student → preview
 *   全部 → 跳过 picker 直达 preview
 *   每月 → 选月份 → preview
 *   按学生 → 选学生 → (PDF 还需选月份) → preview
 * ────────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontWeight, BorderRadius, Shadows } from '../styles/theme';
import { useResponsive } from '../utils/responsive';
import { useToast } from '../contexts/ToastContext';
import { getAllStudents, getAllLessons } from '../database';
import { exportAllToExcel, exportByMonth, exportByStudent } from '../utils/export';
import { generateAllPdf, generateMonthlyPdf, generateStudentPdf } from '../utils/pdf';
import { Student } from '../models';

// ── 类型定义 ──
type Format = 'excel' | 'pdf';
type Scope = 'all' | 'monthly' | 'student';
type Step = 'choose_format' | 'choose_scope' | 'choose_month' | 'choose_student' | 'preview';

/** 月份选项（最近 12 个月） */
function buildMonths(): Array<{ label: string; value: string }> {
  const now = new Date();
  const list: Array<{ label: string; value: string }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    list.push({ label: `${d.getFullYear()}年${m}月`, value: `${d.getFullYear()}-${m}` });
  }
  return list;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

const ExportFlowModal: React.FC<Props> = ({ visible, onClose }) => {
  const [step, setStep] = useState<Step>('choose_format');
  const [format, setFormat] = useState<Format | null>(null);                    // Excel / PDF
  const [scope, setScope] = useState<Scope | null>(null);                      // 全部 / 每月 / 按学生
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const months = useMemo(buildMonths, []);
  const [previewData, setPreviewData] = useState<{
    lessonCount: number; totalAmount: number; totalPaid: number; totalPending: number; totalHours: number;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();
  const { spacing, fontSize, iconSize } = useResponsive();

  // ── 打开弹窗时重置 ──
  useEffect(() => {
    if (visible) {
      setStep('choose_format');
      setFormat(null);
      setScope(null);
      setSelectedStudent(null);
      setSelectedMonth('');
      setPreviewData(null);
      setExporting(false);
      getAllStudents().then(setStudents).catch(() => {});
    }
  }, [visible]);

  // ── 进入预览步骤时计算预览数据 ──
  useEffect(() => {
    if (step === 'preview') computePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const computePreview = async () => {
    if (!format || !scope) return;
    try {
      const allLessons = await getAllLessons();
      let filtered = allLessons;

      if (scope === 'monthly' && selectedMonth) {
        filtered = allLessons.filter(l => l.date.startsWith(selectedMonth));
      } else if (scope === 'student' && selectedStudent) {
        filtered = allLessons.filter(l => l.studentId === selectedStudent.id);
        if (format === 'pdf' && selectedMonth) {
          filtered = filtered.filter(l => l.date.startsWith(selectedMonth));
        }
      }

      setPreviewData({
        lessonCount: filtered.length,
        totalAmount: filtered.reduce((s, l) => s + l.amount, 0),
        totalPaid: filtered.filter(l => l.status === 'paid').reduce((s, l) => s + l.amount, 0),
        totalPending: filtered.filter(l => l.status === 'pendingPayment').reduce((s, l) => s + l.amount, 0),
        totalHours: filtered.reduce((s, l) => s + l.duration, 0),
      });
    } catch {
      setPreviewData(null);
    }
  };

  // ── 执行导出 ──
  const handleExport = async () => {
    setExporting(true);
    try {
      if (format === 'excel' && scope === 'all') {
        await exportAllToExcel();
      } else if (format === 'excel' && scope === 'monthly' && selectedMonth) {
        await exportByMonth(selectedMonth);
      } else if (format === 'excel' && scope === 'student' && selectedStudent) {
        await exportByStudent(selectedStudent.id);
      } else if (format === 'pdf' && scope === 'all') {
        await generateAllPdf();
      } else if (format === 'pdf' && scope === 'monthly' && selectedMonth) {
        await generateMonthlyPdf(selectedMonth);
      } else if (format === 'pdf' && scope === 'student' && selectedStudent && selectedMonth) {
        await generateStudentPdf(selectedStudent, selectedMonth);
      }
      showToast('导出成功', 'success');
      onClose();
    } catch (e: any) {
      showToast(`导出失败: ${e.message}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  // ── 总步骤数（用于步骤点指示器） ──
  const stepCount = format && scope
    ? (scope === 'all' && format === 'excel') ? 3
    : (scope === 'student' && format === 'pdf') ? 5 : 4
    : 2;
  const stepIndex = useMemo(() => {
    const map: Record<Step, number> = {
      choose_format: 0, choose_scope: 1, choose_month: 2, choose_student: 2, preview: stepCount - 1,
    };
    return map[step] ?? 0;
  }, [step, stepCount]);

  // ── 样式 ──
  const styles = useMemo(() => ({
    overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center' as const, alignItems: 'center' as const },
    container: { backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: spacing.xl, width: '88%' as const, maxWidth: 440, maxHeight: '80%' as const, ...Shadows.floating },
    title: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: spacing.lg, textAlign: 'center' as const },
    subtitle: { fontSize: fontSize.body, color: Colors.caption, marginBottom: spacing.md },

    // ── 步骤点 ──
    steps: { flexDirection: 'row' as const, justifyContent: 'center' as const, gap: spacing.xs, marginBottom: spacing.md },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.divider },
    dotActive: { backgroundColor: Colors.primary, width: 16 },

    // ── 选项卡片 ──
    typeOption: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: BorderRadius.smallCard, marginBottom: spacing.sm, borderWidth: 1, borderColor: Colors.divider },
    typeLabel: { fontSize: fontSize.body, fontWeight: FontWeight.medium, color: Colors.title },
    typeDesc: { fontSize: fontSize.small, color: Colors.caption, marginTop: 2 },

    // ── 选择列表项 ──
    optionItem: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: BorderRadius.smallCard, marginBottom: spacing.xs, borderWidth: 1, borderColor: Colors.divider },
    optionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
    optionText: { fontSize: fontSize.body, color: Colors.title },

    // ── 预览卡片 ──
    previewGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm, marginBottom: spacing.lg },
    previewItem: { flex: 1, minWidth: '45%' as any, backgroundColor: Colors.background, padding: spacing.md, borderRadius: BorderRadius.smallCard, alignItems: 'center' as const },
    previewValue: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },
    previewLabel: { fontSize: fontSize.small, color: Colors.caption, marginTop: 2 },

    // ── 按钮 ──
    row: { flexDirection: 'row' as const, gap: spacing.sm, marginTop: spacing.md },
    btn: { flex: 1, paddingVertical: spacing.sm, borderRadius: BorderRadius.smallCard, alignItems: 'center' as const },
    btnPrimary: { backgroundColor: Colors.primary },
    btnSecondary: { backgroundColor: Colors.divider },
    btnDisabled: { opacity: 0.5 },
    btnText: { fontSize: fontSize.body, fontWeight: FontWeight.medium, color: Colors.white },
    btnTextSecondary: { color: Colors.title },
  }), [spacing, fontSize]);

  // ── 步骤指示器 ──
  const renderSteps = () => (
    <View style={styles.steps}>
      {Array.from({ length: stepCount }).map((_, i) => (
        <View key={i} style={[styles.dot, i <= stepIndex && styles.dotActive]} />
      ))}
    </View>
  );

  // ── 步骤 1：选择导出格式 ──
  const renderFormatOptions = () => (
    <>
      <Text style={styles.title}>选择导出格式</Text>
      {[
        { key: 'excel' as Format, icon: 'grid-outline', label: 'Excel', desc: '生成 .xlsx 文件，可汇总全部/按月/按学生' },
        { key: 'pdf' as Format, icon: 'document-text-outline', label: 'PDF', desc: '生成正式账单 PDF，按学生 + 月份' },
      ].map(opt => (
        <TouchableOpacity key={opt.key} style={styles.typeOption} onPress={() => { setFormat(opt.key); setStep('choose_scope'); }}>
          <Ionicons name={opt.icon as any} size={iconSize.md} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.typeLabel}>{opt.label}</Text>
            <Text style={styles.typeDesc}>{opt.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.caption} />
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={{ alignItems: 'center', marginTop: spacing.sm }} onPress={onClose}>
        <Text style={{ fontSize: fontSize.body, color: Colors.caption }}>取消</Text>
      </TouchableOpacity>
    </>
  );

  // ── 步骤 2：选择导出数据类型 ──
  const renderScopeOptions = () => {
    const options: Array<{ key: Scope; icon: string; label: string; desc: string }> = [
      { key: 'all', icon: 'server-outline', label: '全部数据', desc: '所有学生课程汇总到一个文件' },
      { key: 'monthly', icon: 'calendar-outline', label: '按月份', desc: '指定月份的账单汇总' },
      { key: 'student', icon: 'person-outline', label: '按学生', desc: '单个学生的账单' },
    ];

    return (
      <>
        <Text style={styles.title}>选择数据类型</Text>
        <Text style={styles.subtitle}>格式：{format === 'excel' ? 'Excel' : 'PDF'}</Text>
        {options.map(opt => (
          <TouchableOpacity key={opt.key} style={styles.typeOption} onPress={() => {
            setScope(opt.key);
            if (opt.key === 'all') setStep('preview');
            else if (opt.key === 'monthly') setStep('choose_month');
            else setStep('choose_student');
          }}>
            <Ionicons name={opt.icon as any} size={iconSize.md} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.typeLabel}>{opt.label}</Text>
              <Text style={styles.typeDesc}>{opt.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.caption} />
          </TouchableOpacity>
        ))}
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => { setStep('choose_format'); setFormat(null); }}>
            <Text style={[styles.btnText, styles.btnTextSecondary]}>返回</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  // ── 选择学生 ──
  const renderStudentList = () => (
    <>
      <Text style={styles.title}>选择学生</Text>
      <ScrollView style={{ maxHeight: 300 }}>
        {students.map(s => (
          <TouchableOpacity key={s.id} style={[styles.optionItem, selectedStudent?.id === s.id && styles.optionActive]} onPress={() => setSelectedStudent(s)}>
            <Text style={styles.optionText}>{s.name}{s.phone ? `  ${s.phone}` : ''}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setStep('choose_scope')}>
          <Text style={[styles.btnText, styles.btnTextSecondary]}>返回</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary, !selectedStudent && styles.btnDisabled]} disabled={!selectedStudent} onPress={() => setStep(format === 'pdf' ? 'choose_month' : 'preview')}>
          <Text style={styles.btnText}>下一步</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ── 选择月份 ──
  const renderMonthPicker = () => (
    <>
      <Text style={styles.title}>选择月份</Text>
      {scope === 'student' && selectedStudent && <Text style={styles.subtitle}>{selectedStudent.name} 的账单月份</Text>}
      {scope === 'monthly' && <Text style={styles.subtitle}>选择要导出的月份</Text>}
      <ScrollView style={{ maxHeight: 300 }}>
        {months.map(m => (
          <TouchableOpacity key={m.value} style={[styles.optionItem, selectedMonth === m.value && styles.optionActive]} onPress={() => setSelectedMonth(m.value)}>
            <Text style={styles.optionText}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setStep(scope === 'student' ? 'choose_student' : 'choose_scope')}>
          <Text style={[styles.btnText, styles.btnTextSecondary]}>返回</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary, !selectedMonth && styles.btnDisabled]} disabled={!selectedMonth} onPress={() => setStep('preview')}>
          <Text style={styles.btnText}>预览</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ── 导出预览 ──
  const renderPreview = () => {
    const titleMap: Record<string, string> = {
      'excel_all': '全部数据 → Excel',
      'excel_monthly': `${selectedMonth}月 → Excel`,
      'excel_student': `${selectedStudent?.name || ''} → Excel`,
      'pdf_all': '全部数据 → PDF',
      'pdf_monthly': `${selectedMonth}月 → PDF`,
      'pdf_student': `${selectedStudent?.name || ''} ${selectedMonth} → PDF`,
    };
    const key = format && scope ? `${format}_${scope}` : '';

    return (
      <>
        <Text style={styles.title}>导出预览</Text>
        <Text style={styles.subtitle}>{titleMap[key] || ''}</Text>

        {previewData ? (
          <View style={styles.previewGrid}>
            <View style={styles.previewItem}>
              <Text style={styles.previewValue}>{previewData.lessonCount}节</Text>
              <Text style={styles.previewLabel}>课程数</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={styles.previewValue}>{previewData.totalHours.toFixed(1)}h</Text>
              <Text style={styles.previewLabel}>总课时</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={[styles.previewValue, { color: '#10B981' }]}>¥{previewData.totalPaid.toFixed(0)}</Text>
              <Text style={styles.previewLabel}>已收款</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={[styles.previewValue, { color: '#F59E0B' }]}>¥{previewData.totalPending.toFixed(0)}</Text>
              <Text style={styles.previewLabel}>待收款</Text>
            </View>
          </View>
        ) : (
          <Text style={{ textAlign: 'center', color: Colors.caption, marginBottom: spacing.lg }}>正在加载预览...</Text>
        )}

        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => {
            if (scope === 'all') setStep('choose_scope');
            else if (scope === 'monthly') setStep('choose_month');
            else if (scope === 'student' && format === 'pdf') setStep('choose_month');
            else setStep('choose_student');
          }}>
            <Text style={[styles.btnText, styles.btnTextSecondary]}>返回</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary, (exporting || !previewData) && styles.btnDisabled]} disabled={exporting || !previewData} onPress={handleExport}>
            <Text style={styles.btnText}>{exporting ? '导出中...' : '确认导出'}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {renderSteps()}
          {step === 'choose_format' && renderFormatOptions()}
          {step === 'choose_scope' && renderScopeOptions()}
          {step === 'choose_student' && renderStudentList()}
          {step === 'choose_month' && renderMonthPicker()}
          {step === 'preview' && renderPreview()}
        </View>
      </View>
    </Modal>
  );
};

export default ExportFlowModal;
