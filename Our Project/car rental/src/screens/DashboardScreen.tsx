import React, { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, formatCurrency } from '../theme';
import type { Booking, Vehicle } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [v, b, notifications] = await Promise.all([
        api.searchVehicles(),
        api.listBookings(),
        api.getNotifications(),
      ]);
      setVehicles(v);
      setBookings(b);
      setAlertCount(notifications.total_count);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load dashboard data. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const stats = [
    { label: 'Total vehicles', value: vehicles.length, icon: 'car-sport-outline' as const },
    { label: 'Available', value: vehicles.filter((v) => v.status === 'available').length, icon: 'checkmark-circle-outline' as const },
    { label: 'Currently rented', value: vehicles.filter((v) => v.status === 'rented').length, icon: 'key-outline' as const },
    { label: 'Confirmed bookings', value: bookings.filter((b) => b.status === 'confirmed').length, icon: 'calendar-outline' as const },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.name}>{user?.full_name}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role.toUpperCase()}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={styles.bellButton}
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {alertCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{alertCount > 9 ? '9+' : alertCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.heroCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>TODAY'S OPERATIONS</Text>
          <Text style={styles.heroTitle}>
            {user?.role === 'admin' ? 'System overview' : user?.role === 'manager' ? 'Fleet overview' : 'Rental operations'}
          </Text>
          <Text style={styles.heroBody}>
            Monitor vehicles, bookings and actions that need attention.
          </Text>
        </View>
        <Ionicons name="speedometer-outline" size={42} color="#fff" />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={18} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Fleet and booking status</Text>
      <View style={styles.grid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.card}>
            <Ionicons name={s.icon} size={22} color={colors.accent} />
            <Text style={styles.cardValue}>{s.value}</Text>
            <Text style={styles.cardLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent bookings</Text>
      </View>

      {bookings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptyBody}>New rental bookings will appear here.</Text>
        </View>
      ) : (
        bookings.slice(0, 5).map((b) => {
          const statusMap: Record<string, { bg: string; fg: string; label: string }> = {
            confirmed: { bg: '#FEF3C7', fg: '#92400E', label: 'Confirmed' },
            active: { bg: '#DBEAFE', fg: '#1E40AF', label: 'Active' },
            completed: { bg: '#DCFCE7', fg: '#166534', label: 'Completed' },
            cancelled: { bg: '#FEE2E2', fg: '#991B1B', label: 'Cancelled' },
          };
          const status = statusMap[b.status] ?? { bg: '#EDF2F7', fg: colors.text, label: b.status };
          return (
            <View key={b.id} style={styles.bookingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bookingId}>{b.id}</Text>
                <Text style={styles.bookingDetail}>
                  {b.start_date.slice(0, 10)} → {b.end_date.slice(0, 10)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                  <Text style={[styles.statusPillText, { color: status.fg }]}>{status.label}</Text>
                </View>
                <Text style={styles.amount}>{formatCurrency(b.total_amount)}</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 28 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, color: colors.textMuted, fontSize: 13 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  bellButton: {
    width: 42, height: 42, borderRadius: 11, backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -4, right: -4, backgroundColor: colors.danger,
    borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  welcome: { fontSize: 13, color: colors.textMuted },
  name: { fontSize: 21, fontWeight: '800', color: colors.text, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start', backgroundColor: '#E6F0FA', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 6,
  },
  roleText: { fontSize: 10.5, fontWeight: '800', color: colors.primary },
  heroCard: {
    backgroundColor: colors.primary, borderRadius: 16, padding: 18, marginBottom: 20,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  heroEyebrow: { color: '#BFDBFE', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7, marginBottom: 5 },
  heroTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  heroBody: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  errorBox: {
    flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, padding: 11, marginBottom: 16,
  },
  error: { flex: 1, color: colors.danger, fontSize: 12.5 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 },
  viewAll: { color: colors.accent, fontSize: 12.5, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  card: {
    width: '47.8%', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, padding: 14,
  },
  cardValue: { fontSize: 23, fontWeight: '800', color: colors.text, marginTop: 7 },
  cardLabel: { fontSize: 11.5, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 24, alignItems: 'center',
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 8 },
  emptyBody: { fontSize: 12.5, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  bookingRow: {
    backgroundColor: '#fff', borderRadius: 11, borderWidth: 1, borderColor: colors.border,
    padding: 13, marginBottom: 8, flexDirection: 'row', alignItems: 'center',
  },
  bookingId: { fontWeight: '800', fontSize: 13, color: colors.text },
  bookingDetail: { fontSize: 11.5, color: colors.textMuted, marginTop: 4 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { fontSize: 10.5, fontWeight: '800' },
  amount: { fontWeight: '800', fontSize: 12.5, color: colors.accent, marginTop: 5 },
});
