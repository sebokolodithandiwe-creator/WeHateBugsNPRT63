import React, { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import type { NotificationsResponse } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const canService = user?.role === 'admin' || user?.role === 'manager';

  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [servicingId, setServicingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.getNotifications();
      setData(result);
      setError('');
    } catch {
      setError('Could not load notifications.');
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

  async function handleRecordService(vehicleId: string) {
    setServicingId(vehicleId);
    try {
      await api.recordService(vehicleId);
      await load();
    } catch (e) {
      Alert.alert('Could not record service', e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setServicingId(null);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const noAlerts = data && data.total_count === 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {noAlerts && (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={36} color={colors.success} style={{ marginBottom: 10 }} />
          <Text style={styles.emptyTitle}>All clear</Text>
          <Text style={styles.emptyBody}>No overdue returns, service reminders, or fuel alerts right now.</Text>
        </View>
      )}

      {data && data.overdue_returns.length > 0 && (
        <Section title="Overdue returns" icon="alert-circle" color={colors.danger}>
          {data.overdue_returns.map((a) => (
            <TouchableOpacity
              key={a.booking_id}
              style={styles.card}
              onPress={() => navigation.navigate('VehicleDetail', { vehicleId: a.vehicle_id })}
            >
              <Text style={styles.cardTitle}>{a.vehicle}</Text>
              <Text style={styles.cardBody}>
                {a.customer} · due back {a.end_date.slice(0, 10)}
              </Text>
              <Text style={[styles.cardTag, { color: colors.danger }]}>
                {a.days_overdue} day{a.days_overdue !== 1 ? 's' : ''} overdue
              </Text>
            </TouchableOpacity>
          ))}
        </Section>
      )}

      {data && data.service_due.length > 0 && (
        <Section title="Service due" icon="construct" color={colors.warning}>
          {data.service_due.map((a) => (
            <View key={a.vehicle_id} style={styles.card}>
              <Text style={styles.cardTitle}>{a.vehicle}</Text>
              <Text style={styles.cardBody}>
                {a.km_since_service.toLocaleString()} km since last service ({a.mileage.toLocaleString()} km total)
              </Text>
              {canService && (
                <TouchableOpacity
                  style={styles.serviceButton}
                  onPress={() => handleRecordService(a.vehicle_id)}
                  disabled={servicingId === a.vehicle_id}
                >
                  {servicingId === a.vehicle_id ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={styles.serviceButtonText}>Mark as serviced</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </Section>
      )}

      {data && data.low_fuel.length > 0 && (
        <Section title="Low fuel" icon="water" color={colors.secondary}>
          {data.low_fuel.map((a) => (
            <TouchableOpacity
              key={a.vehicle_id}
              style={styles.card}
              onPress={() => navigation.navigate('VehicleDetail', { vehicleId: a.vehicle_id })}
            >
              <Text style={styles.cardTitle}>{a.vehicle}</Text>
              <Text style={styles.cardBody}>Returned at {a.fuel_level}% fuel — refuel before next rental</Text>
            </TouchableOpacity>
          ))}
        </Section>
      )}

      {data && data.in_maintenance.length > 0 && (
        <Section title="In maintenance" icon="build" color={colors.neutral}>
          {data.in_maintenance.map((a) => (
            <TouchableOpacity
              key={a.vehicle_id}
              style={styles.card}
              onPress={() => navigation.navigate('VehicleDetail', { vehicleId: a.vehicle_id })}
            >
              <Text style={styles.cardTitle}>{a.vehicle}</Text>
              <Text style={styles.cardBody}>Currently unavailable for booking</Text>
            </TouchableOpacity>
          ))}
        </Section>
      )}
    </ScrollView>
  );
}

function Section({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, fontSize: 13, marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 6 },
  emptyBody: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 30 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardTitle: { fontWeight: '700', fontSize: 13.5, color: colors.text },
  cardBody: { fontSize: 12.5, color: colors.textMuted, marginTop: 4 },
  cardTag: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  serviceButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  serviceButtonText: { color: colors.accent, fontWeight: '700', fontSize: 12.5 },
});
