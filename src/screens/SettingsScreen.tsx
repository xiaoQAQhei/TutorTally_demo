/**
 * ── 模块功能 ─────────────────────────────────────────────
 * SettingsScreen - 设置页面
 *
 * 数据管理：导出/导入、周期规则管理、偏好设置、测试数据。
 */
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontWeight, BorderRadius, Shadows } from '../styles/theme';
import { useToast } from '../contexts/ToastContext';
import { useAction } from '../contexts/ActionContext';
import { pickAndImportCsv } from '../utils/import';
import { useResponsive } from '../utils/responsive';
import ExportFlowModal from '../components/ExportFlowModal';
import RecurringRulesScreen from './RecurringRulesScreen';
import { seedTestData } from '../database';

const SettingsScreen: React.FC = () => {
  const [showExportModal, setShowExportModal] = useState(false);
  const [showRecurringRules, setShowRecurringRules] = useState(false);
  const { confirmBeforeChange, toggleConfirmBeforeChange } = useAction();
  const { showToast } = useToast();
  const { maxContentWidth, spacing, fontSize } = useResponsive();

  const handleImport = async () => {
    try {
      const result = await pickAndImportCsv();
      showToast(`导入完成: ${result.imported} 条记录`, 'success');
      if (result.errors.length > 0) showToast(`${result.errors.length} 条错误`, 'error');
    } catch (e: any) { showToast(`导入失败: ${e.message}`, 'error'); }
  };

  const handleSeedData = () => {
    Alert.alert('生成测试数据', '将插入 3 个学生、5 个科目、20 节课、5 条支付、2 条周期规则。确定吗？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: async () => {
        try {
          await seedTestData();
          showToast('测试数据已生成，请刷新页面', 'success');
        } catch (e: any) {
          showToast(`生成失败: ${e.message}`, 'error');
        }
      }},
    ]);
  };

  const menuItems = [
    { icon: 'download-outline', label: '导出数据', subtitle: 'Excel / PDF 多方式导出', onPress: () => setShowExportModal(true), color: Colors.paid },
    { icon: 'upload-outline', label: '导入数据', subtitle: '从 Excel 文件恢复数据', onPress: handleImport, color: Colors.primary },
    { icon: 'flask-outline', label: '生成测试数据', subtitle: '插入 30 条演示数据', onPress: handleSeedData, color: '#AF52DE' },
    { icon: 'repeat-outline', label: '周期课程规则', subtitle: '管理自动排课规则', onPress: () => setShowRecurringRules(true), color: '#FF9500' },
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
        <RecurringRulesScreen onClose={() => setShowRecurringRules(false)} />
      </Modal>
    </View>
  );
};

export default SettingsScreen;
