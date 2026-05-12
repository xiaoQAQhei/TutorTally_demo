import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './screens/HomeScreen';
import StudentScreen from './screens/StudentScreen';
import LessonScreen from './screens/LessonScreen';
import StatsScreen from './screens/StatsScreen';
import SettingsScreen from './screens/SettingsScreen';
import { ActionProvider } from './contexts/ActionContext';
import { initDatabase, migrateFromV1 } from './database';
import { requestPermission, scheduleAllReminders } from './utils/notifications';
import { Colors, FontSize, FontWeight, Spacing, Shadows, BorderRadius } from './styles/theme';
import { useResponsive, rem, scale } from './utils/responsive';

const Tab = createBottomTabNavigator();

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

  useEffect(() => {
    const setupDatabase = async () => {
      try { await initDatabase(); await migrateFromV1(); } catch (e) { console.warn('Database init failed:', e); }
      setIsLoading(false);
      requestPermission().then(granted => { if (granted) scheduleAllReminders(); });
    };
    setupDatabase();
  }, []);

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
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: '首页' }} />
        <Tab.Screen name="Students" component={StudentScreen} options={{ title: '学生' }} />
        <Tab.Screen name="Lessons" component={LessonScreen} options={{ title: '课程记录' }} />
        <Tab.Screen name="Stats" component={StatsScreen} options={{ title: '账单统计' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
      </Tab.Navigator>
      </NavigationContainer>
    </ActionProvider>
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
