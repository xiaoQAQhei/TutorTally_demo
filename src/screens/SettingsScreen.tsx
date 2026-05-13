/**
 * ── 模块功能 ─────────────────────────────────────────────
 * SettingsScreen - 设置页面
 *
 * 数据管理：导出 Excel（全部/按月份/按学生）、导入 Excel、导出 PDF 账单。
 * 周期规则管理：跳转到 RecurringRulesScreen 管理自动排课。
 * 偏好设置：状态变更前确认弹窗开关。
 * 关于信息：App 名称、版本、数据安全说明。
 */
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontWeight, BorderRadius, Shadows } from '../styles/theme';
import Toast from '../components/Toast';
import { useAction } from '../contexts/ActionContext';
import { exportAllToExcel } from '../utils/export';
import { pickAndImportCsv } from '../utils/import';
import { generateStudentPdf } from '../utils/pdf';
import { useResponsive } from '../utils/responsive';

type ExportMode = 'all' | 'month' | 'student' | null;

interface Props {
  onNavigateToRecurringRules?: () => void;
  onNavigateToStudentSelect?: (mode: 'pdf' | 'export') => void;
}

/**
 * SettingsScreen 组件
 *
 * 设置页面，提供数据导出/导入、周期规则管理、偏好开关等功能。
 * 依赖父组件传来的导航回调以跳转到学生选择或周期规则页面。
 */
const SettingsScreen: React.FC<Props> = ({ onNavigateToRecurringRules, onNavigateToStudentSelect }) => {
  const [exportMode, setExportMode] = useState<ExportMode>(null);             // 导出模式弹窗
  const { confirmBeforeChange, toggleConfirmBeforeChange } = useAction();
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({ visible: false, message: '', type: 'success' });
  const { maxContentWidth, spacing, fontSize } = useResponsive();

  /**
   * handleExport - 执行数据导出
   *
   * 按不同模式处理：全部导出调用 exportAllToExcel；
   * 按学生/月份导出跳转到学生选择页面。
   * @param mode 导出模式
   */
  const handleExport = async (mode: ExportMode) => {
    setExportMode(null);
    try {
      if (mode === 'all') await exportAllToExcel();
      else if (mode === 'student') { onNavigateToStudentSelect?.('export'); return; }
      else if (mode === 'month') { onNavigateToStudentSelect?.('export'); return; }
      setToast({ visible: true, message: '导出成功', type: 'success' });
    } catch (e: any) { setToast({ visible: true, message: `导出失败: ${e.message}`, type: 'error' }); }
  };

  /**
   * handleImport - 执行数据导入
   *
   * 调用 pickAndImportCsv 选择并导入 Excel 文件，
   * 显示导入结果（成功条数和错误条数）。
   */
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

  const styles = useMemo(() => ({
    // ═══════════════ 页面容器 ═══════════════
    container: { flex: 1, backgroundColor: Colors.background, width: '100%' as const, alignSelf: 'center' as const },
    list: { padding: spacing.xl },                                                                    // 列表滚动内边距

    // ═══════════════ 分组标题 ═══════════════
    sectionTitle: { fontSize: fontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.caption, marginBottom: spacing.md, marginTop: spacing.xl, textTransform: 'uppercase' as const },

    // ═══════════════ 菜单项 ═══════════════
    menuItem: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: spacing.lg, marginBottom: spacing.md, gap: spacing.md },
    iconBox: { width: 44, height: 44, borderRadius: BorderRadius.iconContainer, justifyContent: 'center' as const, alignItems: 'center' as const }, // 菜单图标容器
    menuText: { flex: 1 },                                                                            // 菜单文字区域
    menuLabel: { fontSize: fontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title },    // 菜单标题
    menuSub: { fontSize: fontSize.small, color: Colors.caption, marginTop: 2 },                       // 菜单副标题

    // ═══════════════ 关于卡片 ═══════════════
    aboutCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: spacing.xl, alignItems: 'center' as const },
    aboutApp: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },           // App 名称
    aboutDesc: { fontSize: fontSize.small, color: Colors.caption, marginTop: spacing.xs },            // App 描述
    aboutDivider: { width: 40, height: 1, backgroundColor: Colors.divider, marginVertical: spacing.md },

    // ═══════════════ 导出弹窗 ═══════════════
    overlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.overlay, justifyContent: 'center' as const, alignItems: 'center' as const },
    exportModal: { backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: spacing.xl, width: '80%' as const, maxWidth: 400 },
    modalTitle: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: spacing.lg, textAlign: 'center' as const },
    exportOption: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider },
    exportOptionText: { fontSize: fontSize.body, color: Colors.title },
    cancelBtn: { marginTop: spacing.lg, alignItems: 'center' as const, paddingVertical: spacing.sm },         // 取消按钮
    cancelBtnText: { fontSize: fontSize.body, color: Colors.caption },
  }), [spacing, fontSize]);

  return (
    <View style={[styles.container, { maxWidth: maxContentWidth }]}>
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

        <Text style={styles.sectionTitle}>偏好设置</Text>
        <View style={[styles.menuItem, Shadows.subtle]}>
          <View style={styles.menuText}>
            <Text style={styles.menuLabel}>状态变更前提醒</Text>
            <Text style={styles.menuSub}>切换状态时是否需要弹窗确认</Text>
          </View>
          <Switch value={confirmBeforeChange} onValueChange={toggleConfirmBeforeChange} trackColor={{ false: Colors.divider, true: Colors.primary }} />
        </View>

        <Text style={styles.sectionTitle}>关于</Text>
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

export default SettingsScreen;
