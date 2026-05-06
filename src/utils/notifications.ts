import * as Notifications from 'expo-notifications';
import { getAllLessons } from '../database';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const lessons = await getAllLessons();
  const now = new Date();

  for (const l of lessons) {
    if (l.status === 'scheduled' && l.timeSlot) {
      const parts = l.timeSlot.split('-')[0]?.trim()?.split(':');
      if (parts && parts.length >= 2) {
        const h = parseInt(parts[0]) || 0;
        const m = parseInt(parts[1]) || 0;
        const d = new Date(`${l.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
        const remindTime = new Date(d.getTime() - 30 * 60000);
        if (remindTime > now) {
          await Notifications.scheduleNotificationAsync({
            content: { title: '上课提醒', body: `${l.date} ${l.timeSlot} 有课程安排`, data: { lessonId: l.id } },
            trigger: { date: remindTime },
          });
        }
      }
    }
    if (l.status === 'completed' && l.timeSlot) {
      const parts = l.timeSlot.split('-')[1]?.trim()?.split(':');
      if (parts && parts.length >= 2) {
        const h = parseInt(parts[0]) || 0;
        const m = parseInt(parts[1]) || 0;
        const d = new Date(`${l.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
        const remindTime = new Date(d.getTime() + 2 * 3600000);
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
