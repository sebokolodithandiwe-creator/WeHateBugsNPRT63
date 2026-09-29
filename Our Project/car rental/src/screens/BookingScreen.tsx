import React, { useCallback, useEffect, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/Field';
import { api, ApiError } from '../api/client';
import { colors, formatCurrency } from '../theme';
import type { Booking, Customer } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = { params: RootStackParamList['Booking'] };

function toIsoAtTen(dateString: string): string {
  return `${dateString}T10:00:00`;
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function BookingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Route;
  const { vehicle } = route.params;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searching, setSearching] = useState(false);

  const today = new Date();
  const [startDate, setStartDate] = useState(formatDateInput(today));
  const [endDate, setEndDate] = useState(formatDateInput(addDays(today, 1)));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const searchCustomers = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const results = await api.searchCustomers(q || undefined);
      setCustomers(results);
    } catch {
      // Non-fatal - just show no results.
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => searchCustomers(customerQuery), 350);
    return () => clearTimeout(timeout);
  }, [customerQuery, searchCustomers]);

  const days = Math.max(
    1,
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
  );
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const invalidDateFormat = Number.isNaN(start.getTime()) || Number.isNaN(end.getTime());
  const dateError = invalidDateFormat || end <= start;
  const estimatedTotal = days * vehicle.daily_rate * 1.15;

  async function handleConfirm() {
    if (!selectedCustomer) return;
    setSubmitting(true);
    setError('');
    try {
      const booking = await api.createBooking({
        customer_id: selectedCustomer.id,
        vehicle_id: vehicle.id,
        start_date: toIsoAtTen(startDate),
        end_date: toIsoAtTen(endDate),
      });
      setConfirmedBooking(booking);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create the booking.');
    } finally {
      setSubmitting(false);
    }
  }

  const [contractLoading, setContractLoading] = useState(false);
  const [contractError, setContractError] = useState('');

  async function handleGenerateContract() {
    if (!confirmedBooking) return;
    setContractLoading(true);
    setContractError('');
    try {
      await api.downloadAndOpenContract(confirmedBooking.id);
    } catch (e) {
      setContractError(e instanceof ApiError ? e.message : 'Could not generate the contract.');
    } finally {
      setContractLoading(false);
    }
  }

  if (confirmedBooking) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
        <View style={styles.successCircle}>
          <Text style={styles.successCheck}>✓</Text>
        </View>
        <Text style={styles.confirmLabel}>Confirmation number</Text>
        <Text style={styles.confirmNumber}>{confirmedBooking.id}</Text>

        <View style={styles.summaryCard}>
          <Row label="Customer" value={selectedCustomer?.full_name ?? ''} />
          <Row label="Vehicle" value={`${vehicle.make} ${vehicle.model}`} />
          <Row label="Total days" value={String(confirmedBooking.total_days)} />
          <Row label="Total amount" value={formatCurrency(confirmedBooking.total_amount)} bold />
        </View>

        <ErrorBanner message={contractError} />

        <Button
          title="Generate contract"
          variant="secondary"
          onPress={handleGenerateContract}
          loading={contractLoading}
        />
        <Button
          title="Go to payment"
          onPress={() => navigation.replace('Payment', { booking: confirmedBooking })}
        />
        <Button title="Back to dashboard" variant="secondary" onPress={() => navigation.popToTop()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.stepper}>
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <View style={[styles.stepCircle, s <= step && styles.stepCircleActive]}>
              <Text style={[styles.stepNumber, s <= step && styles.stepNumberActive]}>{s}</Text>
            </View>
            {s < 3 && <View style={[styles.stepLine, s < step && styles.stepLineActive]} />}
          </React.Fragment>
        ))}
      </View>
      <Text style={styles.stepLabel}>Step {step} of 3</Text>

      <ErrorBanner message={error} />

      {step === 1 && (
        <View>
          <Text style={styles.sectionTitle}>Select customer</Text>
          <TextInput
            style={styles.input}
            placeholder="Search customers by name or phone"
            placeholderTextColor={colors.textMuted}
            value={customerQuery}
            onChangeText={setCustomerQuery}
          />
          {searching && <ActivityIndicator color={colors.primary} style={{ marginVertical: 10 }} />}
          {!searching && customerQuery.trim() && customers.length === 0 ? (
            <View style={styles.emptyCustomer}>
              <Text style={styles.emptyCustomerTitle}>No matching customer found</Text>
              <Text style={styles.emptyCustomerText}>Register the customer in the customer-management workflow before creating the booking.</Text>
            </View>
          ) : null}

          {customers.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setSelectedCustomer(c)}
              style={[styles.customerCard, selectedCustomer?.id === c.id && styles.customerCardSelected]}
            >
              <Text style={styles.customerName}>{c.full_name}</Text>
              <Text style={styles.customerDetail}>{c.phone}</Text>
            </TouchableOpacity>
          ))}
          <Button title="Continue" onPress={() => setStep(2)} disabled={!selectedCustomer} />
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.sectionTitle}>Select rental dates</Text>
          <Text style={styles.hint}>Use the format YYYY-MM-DD. The server will perform the final availability and price checks.</Text>
          <Text style={styles.label}>Start date</Text>
          <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="2026-08-27" />
          <Text style={styles.label}>End date</Text>
          <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="2026-08-30" />

          {dateError ? (
            <ErrorBanner message={invalidDateFormat ? 'Enter valid dates using YYYY-MM-DD.' : 'End date must be after the start date.'} />
          ) : (
            <Text style={styles.hint}>
              {days} day{days !== 1 ? 's' : ''} · estimated total {formatCurrency(estimatedTotal)}
            </Text>
          )}
          <Button title="Continue" onPress={() => setStep(3)} disabled={dateError} />
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={styles.sectionTitle}>Confirm booking</Text>
          <View style={styles.summaryCard}>
            <Row label="Customer" value={selectedCustomer?.full_name ?? ''} />
            <Row label="Vehicle" value={`${vehicle.make} ${vehicle.model} (${vehicle.plate})`} />
            <Row label="Start date" value={startDate} />
            <Row label="End date" value={endDate} />
            <Row label="Estimated total" value={formatCurrency(estimatedTotal)} bold />
          </View>
          <Text style={styles.hint}>Final total (with VAT) is calculated by the server on confirm.</Text>
          <Button title="Confirm booking" onPress={handleConfirm} loading={submitting} />
          <Button title="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
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
  stepper: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: { backgroundColor: colors.primary },
  stepNumber: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  stepNumberActive: { color: '#fff' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#EDF2F7', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 11.5, color: colors.textMuted, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: '#fff',
    marginBottom: 12,
    minHeight: 44,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  hint: { fontSize: 13, color: colors.text, marginBottom: 14 },
  customerCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  customerCardSelected: { borderColor: colors.primary, borderWidth: 2 },
  customerName: { fontWeight: '700', fontSize: 13.5, color: colors.text },
  customerDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  emptyCustomer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    marginBottom: 10,
  },
  emptyCustomerTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  emptyCustomerText: { fontSize: 11.5, color: colors.textMuted, lineHeight: 17, marginTop: 3 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  rowValueBold: { fontSize: 15, fontWeight: '800', color: colors.primary },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#C6F6D5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  successCheck: { fontSize: 28, color: colors.success, fontWeight: '800' },
  confirmLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  confirmNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 18,
  },
});
