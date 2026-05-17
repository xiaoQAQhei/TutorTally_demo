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
import { View, Text, ScrollView, TouchableOpacity, Switch, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontWeight, BorderRadius, Shadows } from '../styles/theme';
import { useToast } from '../contexts/ToastContext';
import { useAction } from '../contexts/ActionContext';
import { pickAndImportCsv } from '../utils/import';
import { useResponsive } from '../utils/responsive';
import ExportFlowModal from '../components/ExportFlowModal';
import RecurringRulesScreen from './RecurringRulesScreen';

/**
 * SettingsScreen 组件
 *
 * 设置页面，提供数据导出/导入、周期规则管理、偏好开关等功能。
 */
const SettingsScreen: React.FC = () => {
  const [showExportModal, setShowExportModal] = useState(false);
  const [showRecurringRules, setShowRecurringRules] = useState(false);
  const { confirmBeforeChange, toggleConfirmBeforeChange } = useAction();
  const { showToast } = useToast();
  const { maxContentWidth, spacing, fontSize } = useResponsive();

  /**
   * handleImport - 执行数据导入
   *
   * 调用 pickAndImportCsv 选择并导入 Excel 文件，
   * 显示导入结果（成功条数和错误条数）。
   */
  const handleImport = async () => {
    try {
      const result = await pickAndImportCsv();
      showToast(`导入完成: ${result.imported} 条记录`, 'success');
      if (result.errors.length > 0) showToast(`${result.errors.length} 条错误`, 'error');
    } catch (e: any) { showToast(`导入失败: ${e.message}`, 'error'); }
  };

  const menuItems = [
    { icon: 'download-outline', label: '导出数据', subtitle: 'Excel / PDF 多方式导出', onPress: () => setShowExportModal(true), color: Colors.paid },
    { icon: 'upload-outline', label: '导入数据', subtitle: '从 Excel 文件恢复数据', onPress: handleImport, color: Colors.primary },
    { icon: 'repeat-outline', label: '周期课程规则', subtitle: '管理自动排课规则', onPress: () => setShowRecurringRules(true), color: '#AF52DE' },
  ];

  const styles = useMemo(() => ({
    container: { flex: 1, backgroundColor: Colors.background, width: '100%' as const, alignSelf: 'center' as const },
    list: { padding: spacing.xl },

    sectionTitle: { fontSize: fontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.caption, marginBottom: spacing.md, marginTop: spacing.xl, textTransform: 'uppercase' as const },

    menuItem: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: spacing.lg, marginBottom: spacing.md, gap: spacing.md },
    iconBox: { width: 44, height: 44, borderRadius: BorderRadius.iconContainer, justifyContent: 'center' as const, alignItems: 'center' as const },
    menuText: { flex: 1 },
    menuLabel: { fontSize: fontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title },
    menuSub: { fontSize: fontSize.small, color: Colors.caption, marginTop: 2 },

    aboutCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.card, padding: spacing.xl, alignItems: 'center' as const },
    aboutApp: { fontSize: fontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },
    aboutDesc: { fontSize: fontSize.small, color: Colors.caption, marginTop: spacing.xs },
    aboutDivider: { width: 40, height: 1, backgroundColor: Colors.divider, marginVertical: spacing.md },
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
          <Text style={styles.aboutApp}>家教账单 v1.2</Text>
          <Text style={styles.aboutDesc}>个人离线家教课程账单管理工具</Text>
          <View style={styles.aboutDivider} />
          <Text style={styles.aboutDesc}>数据安全：所有数据仅存储在您的设备上</Text>
          <Text style={styles.aboutDesc}>项目归属：xiaoQAQhei</Text>
        </View>
      </ScrollView>

      <ExportFlowModal visible={showExportModal} onClose={() => setShowExportModal(false)} />

      <Modal visible={showRecurringRules} animationType="slide" onRequestClose={() => setShowRecurringRules(false)}>
        <RecurringRulesScreen />
        <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 }} onPress={() => setShowRecurringRules(false)}>
          <Ionicons name="close-circle" size={28} color={Colors.caption} />
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default SettingsScreen;
