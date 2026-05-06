import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../styles/theme';
import Toast from '../components/Toast';
import { useAction } from '../contexts/ActionContext';
import { exportAllToExcel } from '../utils/export';
import { pickAndImportCsv } from '../utils/import';
import { generateStudentPdf } from '../utils/pdf';

type ExportMode = 'all' | 'month' | 'student' | null;

interface Props {
  onNavigateToRecurringRules?: () => void;
  onNavigateToStudentSelect?: (mode: 'pdf' | 'export') => void;
}

const SettingsScreen: React.FC<Props> = ({ onNavigateToRecurringRules, onNavigateToStudentSelect }) => {
  const [exportMode, setExportMode] = useState<ExportMode>(null);
  const { confirmBeforeChange, toggleConfirmBeforeChange } = useAction();
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({ visible: false, message: '', type: 'success' });

  const handleExport = async (mode: ExportMode) => {
    setExportMode(null);
    try {
      if (mode === 'all') await exportAllToExcel();
      else if (mode === 'student') { onNavigateToStudentSelect?.('export'); return; }
      else if (mode === 'month') { onNavigateToStudentSelect?.('export'); return; }
      setToast({ visible: true, message: '导出成功', type: 'success' });
    } catch (e: any) { setToast({ visible: true, message: `导出失败: ${e.message}`, type: 'error' }); }
  };

  const handleImport = async () => {
    try {
      const result = await pickAndImportCsv();
      setToast({ visible: true, message: `导入完成: ${result.imported} 条记录`, type: 'success' });
      if (result.errors.length > 0) setToast({ visible: true, message: `${result.errors.length} 条错误`, type: 'error' });
    } catch (e: any) { setToast({ visible: true, message: `导入失败: ${e.message}`, type: 'error' }); }
  };

  const menuItems = [
    { icon: 'download-outline', label: '导出数据', subtitle: '按全部/月份/学生导出 Excel', onPress: () => setExportMode('all'), color: Colors.paid },
    { icon: 'upload-outline', label: '导入数据', subtitle: '从 Excel 文件恢复数据', onPress: handleImport, color: Colors.primary },
    { icon: 'document-text-outline', label: '导出 PDF 账单', subtitle: '按学生 + 月份生成正式账单', onPress: () => onNavigateToStudentSelect?.('pdf'), color: Colors.pending },
    { icon: 'repeat-outline', label: '周期课程规则', subtitle: '管理自动排课规则', onPress: () => onNavigateToRecurringRules?.(), color: '#AF52DE' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>数据管理</Text>
        {menuItems.map((item, i) => (
          <TouchableOpacity key={i} style={[styles.menuItem, Shadows.subtle]} activeOpacity={0.7} onPress={item.onPress}>
            <View style={[styles.iconBox, { backgroundColor: item.color + '14' }]}>
              <Ionicons name={item.icon as any} size={22} color={item.color} />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuSub}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.caption} />
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>偏好设置</Text>
        <View style={[styles.menuItem, Shadows.subtle]}>
          <View style={styles.menuText}>
            <Text style={styles.menuLabel}>状态变更前提醒</Text>
            <Text style={styles.menuSub}>点击 badge 切换状态时弹窗确认</Text>
          </View>
          <Switch value={confirmBeforeChange} onValueChange={toggleConfirmBeforeChange} trackColor={{ false: Colors.divider, true: Colors.primary }} />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>关于</Text>
        <View style={[styles.aboutCard, Shadows.subtle]}>
          <Text style={styles.aboutApp}>家教账单 v2.0</Text>
          <Text style={styles.aboutDesc}>个人离线家教课程账单管理工具</Text>
          <View style={styles.aboutDivider} />
          <Text style={styles.aboutDesc}>数据安全：所有数据仅存储在您的设备上</Text>
        </View>
      </ScrollView>

      {exportMode && (
        <View style={styles.overlay}>
          <View style={[styles.exportModal, Shadows.floating]}>
            <Text style={styles.modalTitle}>选择导出范围</Text>
            {[
              { key: 'all' as ExportMode, label: '全部数据', icon: 'server-outline' },
              { key: 'month' as ExportMode, label: '按月份', icon: 'calendar-outline' },
              { key: 'student' as ExportMode, label: '按学生', icon: 'person-outline' },
            ].map(opt => (
              <TouchableOpacity key={opt.key} style={styles.exportOption} onPress={() => handleExport(opt.key)}>
                <Ionicons name={opt.icon as any} size={20} color={Colors.primary} />
                <Text style={styles.exportOptionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setExportMode(null)}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast({ ...toast, visible: false })} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.xl },
  sectionTitle: { fontSize: FontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.caption, marginBottom: Spacing.md, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.md },
  iconBox: { width: 44, height: 44, borderRadius: BorderRadius.iconContainer, justifyContent: 'center', alignItems: 'center' },
  menuText: { flex: 1 },
  menuLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title },
  menuSub: { fontSize: FontSize.small, color: Colors.caption, marginTop: 2 },
  aboutCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: Spacing.xl, alignItems: 'center' },
  aboutApp: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },
  aboutDesc: { fontSize: FontSize.small, color: Colors.caption, marginTop: Spacing.xs },
  aboutDivider: { width: 40, height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.md },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center' },
  exportModal: { backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: Spacing.xl, width: '80%' },
  modalTitle: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: Spacing.lg, textAlign: 'center' },
  exportOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  exportOptionText: { fontSize: FontSize.body, color: Colors.title },
  cancelBtn: { marginTop: Spacing.lg, alignItems: 'center', paddingVertical: Spacing.sm },
  cancelBtnText: { fontSize: FontSize.body, color: Colors.caption },
});

export default SettingsScreen;
