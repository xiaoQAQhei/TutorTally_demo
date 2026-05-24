/**
 * ── App.tsx ─────────────────────────────────────────────────────────────────
 * 应用入口组件：注册底部 Tab 导航器，管理应用初始化和数据库启动流程。
 * 5 个 Tab：首页、学生、课程记录、账单统计、设置。
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, UIManager, Platform } from 'react-native';

// ── Android 启用 LayoutAnimation（支持原生驱动的布局过渡动画，避免 JS 线程卡顿） ──
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './screens/HomeScreen';
import StudentScreen from './screens/StudentScreen';
import LessonScreen from './screens/LessonScreen';
import StatsScreen from './screens/StatsScreen';
import SettingsScreen from './screens/SettingsScreen';
import { ActionProvider } from './contexts/ActionContext';
import { ToastProvider } from './contexts/ToastContext';
import { initDatabase, migrateFromV1 } from './database';
import { requestPermission, scheduleAllReminders } from './utils/notifications';
import { Colors, FontSize, FontWeight, Spacing, Shadows, BorderRadius } from './styles/theme';
import { useResponsive, rem, scale } from './utils/responsive';

const Tab = createBottomTabNavigator();

/** Tab 页图标映射：选中态 / 未选中态图标名 */
const TAB_ICONS: Record<string, [string, string]> = {
  Home: ['home', 'home-outline'],
  Students: ['people', 'people-outline'],
  Lessons: ['book', 'book-outline'],
  Stats: ['stats-chart', 'stats-chart-outline'],
  Settings: ['settings', 'settings-outline'],
};

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { isTablet, fontSize, spacing, iconSize } = useResponsive();

  // 应用启动时：初始化数据库，迁移旧版数据，申请通知权限
  useEffect(() => {
    const setupDatabase = async () => {
      try { await initDatabase(); await migrateFromV1(); } catch (e) { console.warn('Database init failed:', e); }
      setIsLoading(false);
      requestPermission().then(granted => { if (granted) scheduleAllReminders(); });
    };
    setupDatabase();
  }, []);

  // 数据库加载中显示启动屏
  if (isLoading) {
    return (
      <View style={loadStyles.container}>
        <View style={loadStyles.iconBox}>
          <Ionicons name="wallet" size={48} color={Colors.primary} />
        </View>
        <Text style={loadStyles.text}>加载中...</Text>
      </View>
    );
  }

  return (
    <ToastProvider>
      <ActionProvider>
        <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            const [active, inactive] = TAB_ICONS[route.name] || ['help-circle', 'help-circle-outline'];
            return <Ionicons name={(focused ? active : inactive) as any} size={iconSize.lg} color={color} />;
          },
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.caption,
          tabBarLabelStyle: {
            fontSize: fontSize.small,
            fontWeight: FontWeight.medium,
          },
          tabBarStyle: {
            backgroundColor: Colors.white,
            borderTopWidth: 0,
            height: isTablet ? 72 : 60,
            paddingBottom: isTablet ? 14 : 8,
            paddingTop: isTablet ? 8 : 6,
            ...Shadows.topBar,
          },
          headerStyle: {
            backgroundColor: Colors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerTitleStyle: {
            fontSize: fontSize.h3,
            fontWeight: FontWeight.bold,
            color: Colors.title,
          },
          headerShadowVisible: false,
        })}
      >
        {/* 首页 Tab */}
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: '首页' }} />
        {/* 学生管理 Tab */}
        <Tab.Screen name="Students" component={StudentScreen} options={{ title: '学生' }} />
        {/* 课程记录 Tab */}
        <Tab.Screen name="Lessons" component={LessonScreen} options={{ title: '课程记录' }} />
        {/* 账单统计 Tab */}
        <Tab.Screen name="Stats" component={StatsScreen} options={{ title: '账单统计' }} />
        {/* 设置 Tab */}
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
      </Tab.Navigator>
      </NavigationContainer>
      </ActionProvider>
    </ToastProvider>
  );
};

const loadStyles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.background,
  },
  iconBox: {
    width: scale(80), height: scale(80), borderRadius: BorderRadius.card,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  text: { fontSize: FontSize.body, color: Colors.caption },
});

export default App;
