import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './screens/HomeScreen';
import StudentScreen from './screens/StudentScreen';
import LessonScreen from './screens/LessonScreen';
import StatsScreen from './screens/StatsScreen';
import { initDatabase } from './database';

const Tab = createBottomTabNavigator();

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const setupDatabase = async () => {
      try {
        await initDatabase();
      } catch (e) {
        console.warn('Database init failed, using mock:', e);
      }
      setIsLoading(false);
    };
    setupDatabase();
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: string;
            switch (route.name) {
              case 'Home':
                iconName = focused ? 'home' : 'home-outline';
                break;
              case 'Students':
                iconName = focused ? 'users' : 'users-outline';
                break;
              case 'Lessons':
                iconName = focused ? 'book-open' : 'book-open-outline';
                break;
              case 'Stats':
                iconName = focused ? 'pie-chart' : 'pie-chart-outline';
                break;
              default:
                iconName = 'circle';
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#4CAF50',
          tabBarInactiveTintColor: '#999',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: 'bold',
            color: '#333',
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: '首页' }} />
        <Tab.Screen name="Students" component={StudentScreen} options={{ title: '学生管理' }} />
        <Tab.Screen name="Lessons" component={LessonScreen} options={{ title: '课程记录' }} />
        <Tab.Screen name="Stats" component={StatsScreen} options={{ title: '账单统计' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default App;
