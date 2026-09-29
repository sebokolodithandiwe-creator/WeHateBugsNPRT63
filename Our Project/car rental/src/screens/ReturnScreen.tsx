import React, { useMemo, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/Field';
import { api, ApiError } from '../api/client';
import { colors, formatCurrency } from '../theme';
import type { VehicleCondition } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = { params: RootStackParamList['Return'] };

const LATE_FEE_PER_DAY = 150;
const FUEL_PENALTY_PER_PERCENT = 6;

export function ReturnScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Route;
  const { booking, vehicle } = route.params;

  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel] = useState(75);
  const [condition, setCondition] = useState<VehicleCondition>('good');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ total_penalty: number } | null>(null);

  // Client-side preview only - the server recalculates and is the source of truth.
  const daysOverdue = Math.max(
    0,
    Math.ceil((Date.now() - new Date(booking.end_date).getTime()) / 86400000)
  );
  const previewLateFee = daysOverdue * LATE_FEE_PER_DAY;
  const previewFuelPenalty = Math.max(0, 100 - fuel) * FUEL_PENALTY_PER_PERCENT;
  const previewTotal = useMemo(() => previewLateFee + previewFuelPenalty, [previewLateFee, previewFuelPenalty]);

  async function handleConfirm() {
    if (!odometer) {
      setError('Enter the ending odometer reading.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const record = await api.createReturn({
        booking_id: booking.id,
        ending_odometer: Number(odometer),
        ending_fuel_level: fuel,
        condition,
        damage_notes: notes || undefined,
      });
      setResult({ total_penalty: record.total_penalty });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not process the return.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.successCircle}>
          <Text style={styles.successCheck}>✓</Text>
        </View>
        <Text style={styles.doneTitle}>Vehicle returned</Text>
        <Text style={styles.doneSubtitle}>
          Total penalty: {formatCurrency(result.total_penalty)}
        </Text>
        <Button title="Done" onPress={() => navigation.popToTop()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.summaryCard}>
        <Row label="Vehicle" value={`${vehicle.make} ${vehicle.model} (${vehicle.plate})`} />
        <Row label="Check-out odometer" value={`${vehicle.mileage.toLocaleString()} km`} />
        <Row label="Expected return" value={booking.end_date.slice(0, 10)} />
      </View>

      <Text style={styles.label}>Ending odometer reading (km)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="e.g. 18620"
        value={odometer}
        onChangeText={setOdometer}
      />

      <Text style={styles.label}>Ending fuel level: {fuel}%</Text>
      <Slider
        style={{ marginBottom: 14 }}
        minimumValue={0}
        maximumValue={100}
        step={5}
        value={fuel}
        onValueChange={setFuel}
        minimumTrackTintColor={colors.primary}
      />

      <Text style={styles.label}>Vehicle condition</Text>
      <View style={styles.conditionRow}>
        {(['good', 'fair', 'poor'] as VehicleCondition[]).map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setCondition(c)}
            style={[styles.conditionButton, condition === c && styles.conditionButtonActive]}
          >
            <Text style={[styles.conditionText, condition === c && styles.conditionTextActive]}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Damage notes (optional)</Text>
      <TextInput
        style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
        multiline
        placeholder="Describe any damage found"
        value={notes}
        onChangeText={setNotes}
      />

      <ErrorBanner message={error} />

      <Text style={styles.sectionTitle}>Estimated penalty</Text>
      <View style={[styles.summaryCard, previewTotal > 0 && styles.penaltyCard]}>
        <Row label="Days overdue (approx.)" value={String(daysOverdue)} />
        <Row label="Late fee" value={formatCurrency(previewLateFee)} />
        <Row label="Fuel penalty" value={formatCurrency(previewFuelPenalty)} />
        <Row label="Estimated total" value={formatCurrency(previewTotal)} bold />
      </View>
      <Text style={styles.hint}>The server recalculates the final amount when you confirm.</Text>

      <Button title="Confirm return" variant="danger" onPress={handleConfirm} loading={submitting} />
      <Button title="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
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
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
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
  conditionRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  conditionButton: {
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
  conditionButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  conditionText: { fontWeight: '700', fontSize: 13, color: colors.text },
  conditionTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  penaltyCard: { backgroundColor: '#FFF5F5', borderColor: '#FEB2B2' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  rowValueBold: { fontSize: 15, fontWeight: '800', color: colors.primary },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 16 },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#C6F6D5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successCheck: { fontSize: 28, color: colors.success, fontWeight: '800' },
  doneTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 4 },
  doneSubtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 20, textAlign: 'center' },
});
