import React, { useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/Field';
import { api, ApiError } from '../api/client';
import { colors, formatCurrency } from '../theme';
import type { PaymentMethod } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = { params: RootStackParamList['Payment'] };

export function PaymentScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Route;
  const { booking } = route.params;

  const [method, setMethod] = useState<PaymentMethod>('card');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositRef, setDepositRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [amount, setAmount] = useState(String(booking.total_amount));

  async function handlePay() {
    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError('Enter a valid payment amount greater than R0.00.');
      return;
    }

    if (method === 'eft' && !depositRef.trim()) {
      setError('Enter the EFT/deposit reference before processing an EFT payment.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.createPayment({
        booking_id: booking.id,
        amount: paymentAmount,
        method,
        deposit_amount: depositAmount ? Number(depositAmount) : undefined,
        deposit_reference: depositRef.trim() || undefined,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Payment failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.successCircle}>
          <Text style={styles.successCheck}>✓</Text>
        </View>
        <Text style={styles.doneTitle}>Payment received</Text>
        <Text style={styles.doneSubtitle}>Booking {booking.id}</Text>
        <Button title="Done" onPress={() => navigation.popToTop()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.summaryCard}>
        <Row label="Booking" value={booking.id} />
        <Row label="Amount due" value={formatCurrency(booking.total_amount)} bold />
      </View>

      <Text style={styles.label}>Payment amount</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
      />

      <View style={styles.methodRow}>
        {(['cash', 'card', 'eft'] as PaymentMethod[]).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMethod(m)}
            style={[styles.methodButton, method === m && styles.methodButtonActive]}
          >
            <Text style={[styles.methodText, method === m && styles.methodTextActive]}>
              {m.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Deposit amount (optional)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="0.00"
        value={depositAmount}
        onChangeText={setDepositAmount}
      />
      <Text style={styles.label}>Deposit reference (optional)</Text>
      <TextInput style={styles.input} placeholder="e.g. DEP-2201" value={depositRef} onChangeText={setDepositRef} />

      <ErrorBanner message={error} />

      <Button title="Process payment" onPress={handlePay} loading={submitting} />
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
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  methodButton: {
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
  methodButtonActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  methodText: { fontWeight: '700', fontSize: 13, color: colors.text },
  methodTextActive: { color: '#fff' },
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
  doneSubtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 20 },
});
