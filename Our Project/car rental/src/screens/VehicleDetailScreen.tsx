import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../api/client';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/Field';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { colors, formatCurrency } from '../theme';
import type { Booking, Vehicle } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Route = { params: RootStackParamList['VehicleDetail'] };

export function VehicleDetailScreen() {
  const route = useRoute() as Route;
  const { vehicleId } = route.params;
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [history, setHistory] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [dailyRate, setDailyRate] = useState('');
  const [mileage, setMileage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async () => {
    try {
      const [v, bookings] = await Promise.all([
        api.getVehicle(vehicleId),
        api.listBookings({ vehicle_id: vehicleId }),
      ]);
      setVehicle(v);
      setHistory(bookings);
      setDailyRate(String(v.daily_rate));
      setMileage(String(v.mileage));
      setError('');
    } catch {
      setError('Could not load this vehicle.');
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleSave() {
    if (!vehicle) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await api.updateVehicle(vehicle.id, {
        daily_rate: Number(dailyRate),
        mileage: Number(mileage),
      });
      setVehicle(updated);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkMaintenance() {
    if (!vehicle) return;
    setSaving(true);
    try {
      const updated = await api.updateVehicle(vehicle.id, { status: 'maintenance' });
      setVehicle(updated);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Could not update status.');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkAvailable() {
    if (!vehicle) return;
    setSaving(true);
    try {
      const updated = await api.updateVehicle(vehicle.id, { status: 'available' });
      setVehicle(updated);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Could not update status.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.error}>{error || 'Vehicle not found.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.heroCard}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="car-sport" size={40} color={colors.accent} />
        </View>
        <Text style={styles.make}>
          {vehicle.make} {vehicle.model}
        </Text>
        <Text style={styles.subLine}>
          {vehicle.year} · {vehicle.plate}
        </Text>
        <View style={{ marginTop: 10 }}>
          <StatusBadge status={vehicle.status} />
        </View>
      </View>

      <View style={styles.card}>
        <Row label="Fuel type" value={vehicle.fuel_type} />
        <Row label="Seats" value={String(vehicle.seats)} />
        <Row label="Color" value={vehicle.color ?? '—'} />
        <Row label="Mileage" value={`${vehicle.mileage.toLocaleString()} km`} />
      </View>

      <Text style={styles.sectionTitle}>Pricing</Text>
      <View style={styles.card}>
        <Row label="Daily rate" value={formatCurrency(vehicle.daily_rate)} bold />
        {vehicle.weekly_rate != null && <Row label="Weekly rate" value={formatCurrency(vehicle.weekly_rate)} />}
        {vehicle.monthly_rate != null && <Row label="Monthly rate" value={formatCurrency(vehicle.monthly_rate)} />}
      </View>

      {canEdit && (
        <>
          <Text style={styles.sectionTitle}>Manage vehicle</Text>
          <View style={styles.card}>
            {editing ? (
              <View>
                <Text style={styles.label}>Daily rate (R)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={dailyRate} onChangeText={setDailyRate} />
                <Text style={styles.label}>Mileage (km)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={mileage} onChangeText={setMileage} />
                <ErrorBanner message={saveError} />
                <Button title="Save changes" onPress={handleSave} loading={saving} />
                <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} />
              </View>
            ) : (
              <View>
                <Button title="Edit vehicle" variant="secondary" onPress={() => setEditing(true)} />
                {vehicle.status !== 'maintenance' ? (
                  <Button title="Mark as maintenance" variant="danger" onPress={handleMarkMaintenance} loading={saving} />
                ) : (
                  <Button title="Mark as available" onPress={handleMarkAvailable} loading={saving} />
                )}
              </View>
            )}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>Rental history</Text>
      {history.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>This vehicle has no bookings yet.</Text>
        </View>
      ) : (
        history.map((b) => (
          <View key={b.id} style={styles.card}>
            <View style={styles.historyTop}>
              <Text style={styles.historyId}>{b.id}</Text>
              <Text style={styles.historyStatus}>{b.status}</Text>
            </View>
            <Text style={styles.historyDates}>
              {b.start_date.slice(0, 10)} → {b.end_date.slice(0, 10)}
            </Text>
            <Text style={styles.historyAmount}>{formatCurrency(b.total_amount)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowValueBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, fontSize: 13 },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  make: { fontSize: 18, fontWeight: '800', color: colors.text },
  subLine: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  rowValueBold: { fontSize: 16, fontWeight: '800', color: colors.accent },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: '#fff',
    marginBottom: 14,
    minHeight: 44,
  },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between' },
  historyId: { fontWeight: '700', fontSize: 13, color: colors.text },
  historyStatus: { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize' },
  historyDates: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  historyAmount: { fontWeight: '700', fontSize: 13, color: colors.accent, marginTop: 4 },
});
