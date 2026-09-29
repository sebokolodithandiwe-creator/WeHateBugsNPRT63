import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import type { AuditLogEntry, CurrentUser, UserRole } from '../types';

const ROLES: UserRole[] = ['clerk', 'manager', 'admin'];

export function AdminScreen() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<'users' | 'audit'>('users');
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, log] = await Promise.all([api.listUsers(), api.getAuditLog()]);
      setUsers(u);
      setAuditLog(log);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load admin data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    setBusyUserId(userId);
    try {
      const updated = await api.updateUser(userId, { role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (e) {
      Alert.alert('Could not update role', e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleToggleActive(user: CurrentUser) {
    setBusyUserId(user.id);
    try {
      const updated = await api.updateUser(user.id, { is_active: !user.is_active });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
    } catch (e) {
      Alert.alert('Could not update status', e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusyUserId(null);
    }
  }

  function confirmDelete(user: CurrentUser) {
    Alert.alert('Delete user', `Remove ${user.full_name}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyUserId(user.id);
          try {
            await api.deleteUser(user.id);
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
          } catch (e) {
            Alert.alert('Could not delete user', e instanceof ApiError ? e.message : 'Something went wrong.');
          } finally {
            setBusyUserId(null);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        <TouchableOpacity onPress={() => setTab('users')} style={[styles.tab, tab === 'users' && styles.tabActive]}>
          <Text style={[styles.tabText, tab === 'users' && styles.tabTextActive]}>Users</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('audit')} style={[styles.tab, tab === 'audit' && styles.tabActive]}>
          <Text style={[styles.tabText, tab === 'audit' && styles.tabTextActive]}>Audit log</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {tab === 'users' ? (
        <FlatList
          contentContainerStyle={{ padding: 16, gap: 10 }}
          data={users}
          keyExtractor={(u) => u.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const isSelf = item.id === currentUser?.id;
            const isBusy = busyUserId === item.id;
            return (
              <View style={styles.card}>
                <View style={styles.userTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>
                      {item.full_name} {isSelf ? '(you)' : ''}
                    </Text>
                    <Text style={styles.userDetail}>{item.username}</Text>
                  </View>
                  <View style={[styles.activePill, item.is_active ? styles.activePillOn : styles.activePillOff]}>
                    <Text style={[styles.activePillText, item.is_active ? styles.activePillTextOn : styles.activePillTextOff]}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                <View style={styles.roleRow}>
                  {ROLES.map((r) => (
                    <TouchableOpacity
                      key={r}
                      disabled={isBusy}
                      onPress={() => handleRoleChange(item.id, r)}
                      style={[styles.roleButton, item.role === r && styles.roleButtonActive]}
                    >
                      <Text style={[styles.roleText, item.role === r && styles.roleTextActive]}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    disabled={isSelf || isBusy}
                    onPress={() => handleToggleActive(item)}
                    style={[styles.actionButton, styles.actionButtonSecondary, isSelf && styles.disabled]}
                  >
                    <Text style={styles.actionTextSecondary}>{item.is_active ? 'Deactivate' : 'Activate'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={isSelf || isBusy}
                    onPress={() => confirmDelete(item)}
                    style={[styles.actionButton, styles.actionButtonDanger, isSelf && styles.disabled]}
                  >
                    <Text style={styles.actionTextDanger}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, gap: 8 }}
          data={auditLog}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={28} color={colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>No activity recorded yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.logCard}>
              <View style={styles.logTop}>
                <Text style={styles.logAction}>{item.action}</Text>
                <Text style={styles.logTable}>{item.affected_table}</Text>
              </View>
              {item.detail && <Text style={styles.logDetail}>{item.detail}</Text>}
              <Text style={styles.logTime}>{item.timestamp.replace('T', ' ').slice(0, 19)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, fontSize: 13, paddingHorizontal: 16, paddingTop: 10 },
  tabsRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  tab: {
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
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { fontWeight: '700', fontSize: 13, color: colors.text },
  tabTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  userTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  userName: { fontWeight: '700', fontSize: 14, color: colors.text },
  userDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  activePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  activePillOn: { backgroundColor: '#DCFCE7' },
  activePillOff: { backgroundColor: '#FEE2E2' },
  activePillText: { fontSize: 11, fontWeight: '700' },
  activePillTextOn: { color: '#166534' },
  activePillTextOff: { color: '#991B1B' },
  roleRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  roleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  roleButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleText: { fontSize: 12, fontWeight: '700', color: colors.text },
  roleTextActive: { color: '#fff' },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: 'center', minHeight: 40, justifyContent: 'center' },
  actionButtonSecondary: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.accent },
  actionButtonDanger: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.danger },
  actionTextSecondary: { color: colors.accent, fontWeight: '700', fontSize: 12.5 },
  actionTextDanger: { color: colors.danger, fontWeight: '700', fontSize: 12.5 },
  disabled: { opacity: 0.4 },
  logCard: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12 },
  logTop: { flexDirection: 'row', justifyContent: 'space-between' },
  logAction: { fontWeight: '700', fontSize: 12.5, color: colors.accent },
  logTable: { fontSize: 11.5, color: colors.textMuted },
  logDetail: { fontSize: 12.5, color: colors.text, marginTop: 4 },
  logTime: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 13, color: colors.textMuted },
});
