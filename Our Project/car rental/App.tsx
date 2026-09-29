import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';

function ActivityTracker({ children }: { children: React.ReactNode }) {
  const { recordActivity } = useAuth();

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        recordActivity();
        return false;
      }}
      onResponderGrant={recordActivity}
    >
      {children}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ActivityTracker>
          <RootNavigator />
        </ActivityTracker>
      </AuthProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
