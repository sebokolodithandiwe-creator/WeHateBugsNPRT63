import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { colors, formatCurrency, statusConfig } from '../theme';
import type { FleetUtilizationReport, RevenueReport } from '../types';

export function ReportsScreen() {
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [fleet, setFleet] = useState<FleetUtilizationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, f] = await Promise.all([api.getRevenueReport(), api.getFleetUtilizationReport()]);
      setRevenue(r);
      setFleet(f);
      setError('');
    } catch {
      setError('Could not load reports. Pull down to try again.');
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

  const maxDayAmount = useMemo(
    () => Math.max(1, ...(revenue?.by_day.map((d) => d.amount) ?? [1])),
    [revenue]
  );
  const maxVehicleRevenue = useMemo(
    () => Math.max(1, ...(fleet?.vehicles.map((v) => v.total_revenue) ?? [1])),
    [fleet]
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.sectionTitle}>Revenue (last 30 days)</Text>
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total revenue</Text>
          <Text style={styles.metricValue}>{formatCurrency(revenue?.total_revenue ?? 0)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Transactions</Text>
          <Text style={styles.metricValue}>{revenue?.transaction_count ?? 0}</Text>
        </View>
      </View>

      {revenue && revenue.by_method && Object.keys(revenue.by_method).length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>By payment method</Text>
          {Object.entries(revenue.by_method).map(([method, amount]) => (
            <View key={method} style={styles.row}>
              <Text style={styles.rowLabel}>{method.toUpperCase()}</Text>
              <Text style={styles.rowValue}>{formatCurrency(amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {revenue && revenue.by_day.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily revenue</Text>
          {revenue.by_day.map((d) => (
            <View key={d.date} style={styles.barRow}>
              <Text style={styles.barLabel}>{d.date.slice(5)}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(d.amount / maxDayAmount) * 100}%` }]} />
              </View>
              <Text style={styles.barValue}>{formatCurrency(d.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Fleet utilization</Text>
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Fleet size</Text>
          <Text style={styles.metricValue}>{fleet?.fleet_size ?? 0}</Text>
        </View>
      </View>

      {fleet && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status breakdown</Text>
          {Object.entries(fleet.status_breakdown).map(([status, count]) => {
            const config = statusConfig[status];
            return (
              <View key={status} style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: config?.bg ?? colors.neutral }]} />
                <Text style={styles.rowLabel}>{config?.label ?? status}</Text>
                <Text style={styles.rowValue}>{count}</Text>
              </View>
            );
          })}
        </View>
      )}

      {fleet && fleet.vehicles.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Revenue by vehicle</Text>
          {fleet.vehicles.map((v) => (
            <View key={v.vehicle_id} style={{ marginBottom: 12 }}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>
                  {v.make} {v.model} ({v.plate})
                </Text>
                <Text style={styles.rowValue}>{formatCurrency(v.total_revenue)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(v.total_revenue / maxVehicleRevenue) * 100}%` }]} />
              </View>
              <Text style={styles.subLabel}>
                {v.total_bookings} booking{v.total_bookings !== 1 ? 's' : ''} · {v.total_days_rented} day
                {v.total_days_rented !== 1 ? 's' : ''} rented
              </Text>
            </View>
          ))}
        </View>
      )}

      {fleet && fleet.vehicles.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="bar-chart-outline" size={30} color={colors.textMuted} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyText}>Add vehicles and bookings to see reports here.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, marginBottom: 12, fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  metricLabel: { fontSize: 11.5, color: colors.textMuted, marginBottom: 4 },
  metricValue: { fontSize: 19, fontWeight: '800', color: colors.text },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { fontSize: 13, color: colors.text, flexShrink: 1, paddingRight: 8 },
  rowValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  barRow: { marginBottom: 10 },
  barLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  barTrack: { height: 8, backgroundColor: '#EDF2F7', borderRadius: 4, overflow: 'hidden', marginVertical: 3 },
  barFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  barValue: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 2 },
  subLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
