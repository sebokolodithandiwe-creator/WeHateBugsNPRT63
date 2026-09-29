import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { ErrorBanner, Field } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { colors, heroGradient } from '../theme';
import type { UserRole } from '../types';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'clerk', label: 'Clerk' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Administrator' },
];

export function LoginScreen() {
  const navigation = useNavigation();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('clerk');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await login(username.trim(), password, role);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Ionicons name="car-sport" size={18} color={colors.accent} />
            </View>
            <Text style={styles.brandName}>VRMS</Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="car-sport" size={72} color="rgba(255,255,255,0.92)" />
          </View>

          <Text style={styles.heroTitle}>
            Vehicle Rental{'\n'}
            <Text style={styles.heroTitleAccent}>Management System</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Manage customers, vehicles, bookings, payments and returns in one place.
          </Text>
        </LinearGradient>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Staff sign in</Text>
          <Text style={styles.formSubtitle}>
            Select the role assigned to your account. Your actual role is verified by the server.
          </Text>

          <Text style={styles.label}>Sign in as</Text>
          <View style={styles.roleRow}>
            {ROLES.map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => setRole(item.value)}
                style={[styles.roleButton, role === item.value && styles.roleButtonActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: role === item.value }}
              >
                <Text style={[styles.roleText, role === item.value && styles.roleTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field
            label="Username"
            placeholder="Enter your username"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />

          <View>
            <Field
              label="Password"
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <ErrorBanner message={error} />

          <Button title="Sign in" onPress={handleLogin} loading={loading} />

          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={17} color={colors.secondary} />
            <Text style={styles.securityText}>Access is controlled by your account permissions.</Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Register' as never)} style={styles.registerLink}>
            <Text style={styles.registerText}>
              Need a staff account? <Text style={styles.registerTextBold}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: {
    paddingTop: 56,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 28 },
  brandIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  heroIconWrap: { alignItems: 'flex-start', marginBottom: 18 },
  heroTitle: { fontSize: 30, fontWeight: '800', color: '#fff', lineHeight: 36 },
  heroTitleAccent: { color: '#BFDBFE' },
  heroSubtitle: { fontSize: 14.5, color: 'rgba(255,255,255,0.85)', marginTop: 10, maxWidth: '92%', lineHeight: 21 },
  formCard: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 28,
  },
  formTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  formSubtitle: { fontSize: 12.5, color: colors.textMuted, lineHeight: 18, marginTop: 6, marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: '#fff',
    minHeight: 44,
    justifyContent: 'center',
  },
  roleButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleText: { fontWeight: '700', fontSize: 11.5, color: colors.text },
  roleTextActive: { color: '#fff' },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    bottom: 19,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 16,
  },
  securityText: { fontSize: 11.5, color: colors.textMuted },
  registerLink: { marginTop: 18, alignItems: 'center' },
  registerText: { fontSize: 13.5, color: colors.textMuted },
  registerTextBold: { color: colors.accent, fontWeight: '700' },
});
