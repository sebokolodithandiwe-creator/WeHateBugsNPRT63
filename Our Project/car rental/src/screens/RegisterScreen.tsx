import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { ErrorBanner, Field } from '../components/Field';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, heroGradient } from '../theme';

export function RegisterScreen() {
  const navigation = useNavigation();
  const { login } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (!fullName.trim() || !email.trim() || !username.trim() || !password) {
      return 'Please fill in your name, email, username, and password.';
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return 'Enter a valid email address.';
    }
    if (password.length < 8) {
      return 'Password should be at least 8 characters.';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }
    return null;
  }

  async function handleRegister() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Public registration creates a Clerk account only.
      // Privileged roles must be assigned by an Administrator.
      await api.register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        username: username.trim(),
        password,
        role: 'clerk',
        employee_id: employeeId.trim() || undefined,
      });

      await login(username.trim(), password, 'clerk');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create your account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Ionicons name="person-add" size={40} color="rgba(255,255,255,0.92)" style={{ marginBottom: 10 }} />
          <Text style={styles.heroTitle}>Create staff account</Text>
          <Text style={styles.heroSubtitle}>New registrations receive Clerk access. Administrators manage privileged roles.</Text>
        </LinearGradient>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Account details</Text>

          <Field label="Full name" placeholder="Jane Doe" value={fullName} onChangeText={setFullName} />
          <Field
            label="Email"
            placeholder="name@rentalco.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field label="Phone (optional)" placeholder="082 555 0142" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Field label="Username" placeholder="janedoe" autoCapitalize="none" value={username} onChangeText={setUsername} />

          <View>
            <Field
              label="Password"
              placeholder="At least 8 characters"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPassword((v) => !v)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View>
            <Field
              label="Confirm password"
              placeholder="Re-enter your password"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowConfirmPassword((v) => !v)}>
              <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.roleInfo}>
            <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.roleInfoTitle}>Account role: Clerk</Text>
              <Text style={styles.roleInfoText}>
                Manager and Administrator permissions can only be assigned by an authorised Administrator.
              </Text>
            </View>
          </View>

          <Field label="Employee ID (optional)" placeholder="EMP-001" value={employeeId} onChangeText={setEmployeeId} />

          <ErrorBanner message={error} />
          <Button title="Create account" onPress={handleRegister} loading={loading} />

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Already have an account? Sign in</Text>
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
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 6 },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 19 },
  formCard: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: -18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 26,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 18 },
  roleInfo: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  roleInfoTitle: { fontSize: 13, fontWeight: '800', color: colors.primary },
  roleInfoText: { fontSize: 11.5, color: colors.textMuted, lineHeight: 17, marginTop: 2 },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    bottom: 19,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLink: { marginTop: 16, alignItems: 'center' },
  backLinkText: { color: colors.accent, fontWeight: '700', fontSize: 13.5 },
});
