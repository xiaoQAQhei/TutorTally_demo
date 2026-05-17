/**
 * ── notifications.ts ───────────────────────────────────────────────────────
 * 本地通知管理模块：基于 expo-notifications。
 * 提供权限申请、课程上课提醒（课前 30 分钟）、收款提醒（课后 2 小时）功能。
 * ────────────────────────────────────────────────────────────────────────────
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getAllLessons } from '../database';

// 非 Web 平台：配置通知处理器，允许弹窗和声音
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** 申请通知权限，返回是否已授权 */
export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;      // Web 不支持本地通知
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * 清除所有已安排的提醒，重新扫描全部课程并安排提醒。
 * - "待上课"状态的课程：上课前 30 分钟发"上课提醒"
 * - "待收款"状态的课程：下课后 2 小时发"收款提醒"
 */
export async function scheduleAllReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync(); // 先清除旧的提醒
  const lessons = await getAllLessons();
  const now = new Date();

  for (const l of lessons) {
    // ── 上课提醒：scheduled 状态，在开始时间前 30 分钟触发 ──
    if (l.status === 'scheduled' && l.timeSlot) {
      const parts = l.timeSlot.split('-')[0]?.trim()?.split(':'); // 取开始时间（如 "14:00"）
      if (parts && parts.length >= 2) {
        const h = parseInt(parts[0]) || 0;
        const m = parseInt(parts[1]) || 0;
        const d = new Date(`${l.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
        const remindTime = new Date(d.getTime() - 30 * 60000); // 提前 30 分钟
        if (remindTime > now) {
          await Notifications.scheduleNotificationAsync({
            content: { title: '上课提醒', body: `${l.date} ${l.timeSlot} 有课程安排`, data: { lessonId: l.id } },
            trigger: { date: remindTime },
          });
        }
      }
    }
    // ── 收款提醒：pendingPayment 状态，在结束时间后 2 小时触发 ──
    if (l.status === 'pendingPayment' && l.timeSlot) {
      const parts = l.timeSlot.split('-')[1]?.trim()?.split(':'); // 取结束时间（如 "16:00"）
      if (parts && parts.length >= 2) {
        const h = parseInt(parts[0]) || 0;
        const m = parseInt(parts[1]) || 0;
        const d = new Date(`${l.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
        const remindTime = new Date(d.getTime() + 2 * 3600000); // 课后 2 小时
        if (remindTime > now) {
          await Notifications.scheduleNotificationAsync({
            content: { title: '收款提醒', body: '课程已结束，请确认收款', data: { lessonId: l.id } },
            trigger: { date: remindTime },
          });
        }
      }
    }
  }
}
