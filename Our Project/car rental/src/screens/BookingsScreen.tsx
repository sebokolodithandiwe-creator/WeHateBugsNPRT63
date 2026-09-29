import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../api/client';
import { colors, formatCurrency } from '../theme';
import type { Booking, BookingStatus, Vehicle } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type FilterTab = 'all' | BookingStatus;

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function BookingsScreen() {
  const navigation = useNavigation<Nav>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehiclesById, setVehiclesById] = useState<Record<string, Vehicle>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [contractLoadingId, setContractLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const load = useCallback(async () => {
    const [b, v] = await Promise.all([api.listBookings(), api.searchVehicles()]);
    setBookings(b);
    setVehiclesById(Object.fromEntries(v.map((vehicle) => [vehicle.id, vehicle])));
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

  async function handleViewContract(bookingId: string) {
    setContractLoadingId(bookingId);
    try {
      await api.downloadAndOpenContract(bookingId);
    } catch (e) {
      console.warn(e instanceof ApiError ? e.message : 'Could not open contract');
    } finally {
      setContractLoadingId(null);
    }
  }

  const metrics = useMemo(() => {
    const active = bookings.filter((b) => b.status === 'confirmed' || b.status === 'active');
    const revenue = bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => sum + b.total_amount, 0);
    return {
      total: bookings.length,
      active: active.length,
      revenue,
    };
  }, [bookings]);

  const counts = useMemo(() => {
    const c: Record<FilterTab, number> = { all: bookings.length, confirmed: 0, active: 0, completed: 0, cancelled: 0 };
    for (const b of bookings) c[b.status] += 1;
    return c;
  }, [bookings]);

  const filtered = activeTab === 'all' ? bookings : bookings.filter((b) => b.status === activeTab);

  return (
    <View style={styles.container}>
      <ScrollView horizontal={false} contentContainerStyle={{ paddingBottom: 4 }}>
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Bookings</Text>
            <Text style={styles.metricValue}>{metrics.total}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Active</Text>
            <Text style={styles.metricValue}>{metrics.active}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Revenue</Text>
            <Text style={styles.metricValue}>{formatCurrency(metrics.revenue)}</Text>
          </View>
        </View>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsRow}>
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)} style={[styles.tab, isActive && styles.tabActive]}>
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {t.label} ({counts[t.key]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 10 }}
        data={filtered}
        keyExtractor={(b) => b.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={32} color={colors.textMuted} style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'all' ? 'Create your first booking' : `No ${activeTab} bookings`}
            </Text>
            <Text style={styles.emptyBody}>
              {activeTab === 'all'
                ? 'Bookings you create will show up here with live status and revenue.'
                : 'Try a different tab to see other bookings.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const vehicle = vehiclesById[item.vehicle_id];
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.bookingId}>{item.id}</Text>
                <View style={[styles.statusPill, statusPillStyle(item.status)]}>
                  <Text style={[styles.statusPillText, statusTextStyle(item.status)]}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.detail}>{vehicle ? `${vehicle.make} ${vehicle.model}` : item.vehicle_id}</Text>
              <Text style={styles.amount}>{formatCurrency(item.total_amount)}</Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                  onPress={() => handleViewContract(item.id)}
                  disabled={contractLoadingId === item.id}
                >
                  {contractLoadingId === item.id ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={[styles.actionText, styles.actionTextPrimaryOutline]}>Contract</Text>
                  )}
                </TouchableOpacity>
                {item.status === 'confirmed' && (
                  <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Payment', { booking: item })}>
                    <Text style={styles.actionText}>Take payment</Text>
                  </TouchableOpacity>
                )}
                {(item.status === 'confirmed' || item.status === 'active') && vehicle && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonDanger]}
                    onPress={() => navigation.navigate('Return', { booking: item, vehicle })}
                  >
                    <Text style={[styles.actionText, styles.actionTextSecondary]}>Return</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

function statusPillStyle(status: BookingStatus) {
  switch (status) {
    case 'confirmed':
      return { backgroundColor: '#FEF3C7' };
    case 'active':
      return { backgroundColor: '#DBEAFE' };
    case 'completed':
      return { backgroundColor: '#DCFCE7' };
    case 'cancelled':
      return { backgroundColor: '#FEE2E2' };
  }
}

function statusTextStyle(status: BookingStatus) {
  switch (status) {
    case 'confirmed':
      return { color: '#92400E' };
    case 'active':
      return { color: '#1E40AF' };
    case 'completed':
      return { color: '#166534' };
    case 'cancelled':
      return { color: '#991B1B' };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  metricsRow: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 8 },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  metricLabel: { fontSize: 11.5, color: colors.textMuted, marginBottom: 4 },
  metricValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  tabsScroll: { flexGrow: 0 },
  tabsRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { fontSize: 12.5, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: '#fff' },
  emptyState: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingId: { fontWeight: '700', fontSize: 14, color: colors.text },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  detail: { fontSize: 12.5, color: colors.textMuted, marginTop: 6 },
  amount: { fontWeight: '700', fontSize: 13.5, color: colors.accent, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonSecondary: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.accent },
  actionButtonDanger: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.danger },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
  actionTextPrimaryOutline: { color: colors.accent },
  actionTextSecondary: { color: colors.danger },
});
