import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

export function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user?.full_name?.charAt(0) ?? '?'}</Text>
      </View>
      <Text style={styles.name}>{user?.full_name}</Text>
      <Text style={styles.detail}>{user?.email}</Text>
      <View style={styles.roleBadge}>
        <Text style={styles.roleText}>{user?.role.toUpperCase()}</Text>
      </View>
      {user?.employee_id && <Text style={styles.detail}>Employee ID: {user.employee_id}</Text>}

      <View style={styles.spacer} />
      <Button title="Log out" variant="danger" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24, alignItems: 'center', paddingTop: 60 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  roleBadge: {
    backgroundColor: '#E6F0FA',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 8,
  },
  roleText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  spacer: { flex: 1 },
});
