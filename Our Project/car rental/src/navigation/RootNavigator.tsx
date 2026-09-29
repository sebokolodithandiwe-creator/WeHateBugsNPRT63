import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { VehicleSearchScreen } from '../screens/VehicleSearchScreen';
import { BookingsScreen } from '../screens/BookingsScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { AdminScreen } from '../screens/AdminScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { VehicleDetailScreen } from '../screens/VehicleDetailScreen';
import { BookingScreen } from '../screens/BookingScreen';
import { PaymentScreen } from '../screens/PaymentScreen';
import { ReturnScreen } from '../screens/ReturnScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { colors } from '../theme';
import type { RootStackParamList, MainTabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<keyof MainTabParamList, { active: IconName; inactive: IconName }> = {
  Dashboard: { active: 'home', inactive: 'home-outline' },
  Vehicles: { active: 'car-sport', inactive: 'car-sport-outline' },
  Bookings: { active: 'clipboard', inactive: 'clipboard-outline' },
  Reports: { active: 'bar-chart', inactive: 'bar-chart-outline' },
  Admin: { active: 'shield-checkmark', inactive: 'shield-checkmark-outline' },
  Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
};

function MainTabs() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canViewReports = user?.role === 'admin' || user?.role === 'manager';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof MainTabParamList];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Vehicles" component={VehicleSearchScreen} options={{ title: 'Vehicles' }} />
      <Tab.Screen name="Bookings" component={BookingsScreen} options={{ title: 'Bookings' }} />
      {canViewReports && <Tab.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports' }} />}
      {isAdmin && <Tab.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin' }} />}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
            headerBackTitle: 'Back',
          }}
        >
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} options={{ title: 'Vehicle details' }} />
          <Stack.Screen name="Booking" component={BookingScreen} options={{ title: 'New booking' }} />
          <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Payment' }} />
          <Stack.Screen name="Return" component={ReturnScreen} options={{ title: 'Vehicle return' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
        </Stack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: true, title: 'Create account' }}
          />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
