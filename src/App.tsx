import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './screens/HomeScreen';
import StudentScreen from './screens/StudentScreen';
import LessonScreen from './screens/LessonScreen';
import StatsScreen from './screens/StatsScreen';
import { ActionProvider } from './contexts/ActionContext';
import { initDatabase } from './database';
import { Colors, FontSize, FontWeight, Spacing, Shadows } from './styles/theme';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, [string, string]> = {
  Home: ['home', 'home-outline'],
  Students: ['people', 'people-outline'],
  Lessons: ['book', 'book-outline'],
  Stats: ['stats-chart', 'stats-chart-outline'],
};

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const setupDatabase = async () => {
      try { await initDatabase(); } catch (e) { console.warn('Database init failed:', e); }
      setIsLoading(false);
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
            return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />;
          },
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.caption,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: FontWeight.medium,
          },
          tabBarStyle: {
            backgroundColor: Colors.white,
            borderTopWidth: 0,
            height: 60,
            paddingBottom: 8,
            paddingTop: 6,
            ...Shadows.topBar,
          },
          headerStyle: {
            backgroundColor: Colors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerTitleStyle: {
            fontSize: FontSize.h3,
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
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  text: { fontSize: FontSize.body, color: Colors.caption },
});

export default App;
