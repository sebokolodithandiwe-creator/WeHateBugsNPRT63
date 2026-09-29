import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { colors, formatCurrency } from '../theme';
import type { Vehicle } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function VehicleSearchScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const results = await api.searchVehicles({ q: q || undefined });
      setVehicles(results);
      setError('');
    } catch (e) {
      setError('Could not load vehicles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(query);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    const timeout = setTimeout(() => load(query), 350);
    return () => clearTimeout(timeout);
  }, [query, load]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search make, model or plate"
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : vehicles.length === 0 ? (
        <Text style={styles.empty}>No vehicles found.</Text>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('VehicleDetail', { vehicleId: item.id })}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.make}>
                    {item.make} {item.model}
                  </Text>
                  <Text style={styles.plate}>
                    {item.plate} · {item.vehicle_type}
                  </Text>
                  <Text style={styles.rate}>{formatCurrency(item.daily_rate)}/day</Text>
                </View>
                <StatusBadge status={item.status} />
              </View>
              <TouchableOpacity
                disabled={item.status !== 'available'}
                onPress={() => navigation.navigate('Booking', { vehicle: item })}
                style={[styles.bookButton, item.status !== 'available' && styles.bookButtonDisabled]}
              >
                <Text style={styles.bookButtonText}>
                  {item.status === 'available' ? 'Book now' : 'Unavailable'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  searchInput: {
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
  error: { color: colors.danger, textAlign: 'center', marginTop: 30 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 30 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  make: { fontWeight: '700', fontSize: 15, color: colors.text },
  plate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rate: { fontWeight: '700', fontSize: 13.5, color: colors.secondary, marginTop: 6 },
  bookButton: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  bookButtonDisabled: { backgroundColor: '#A0AEC0' },
  bookButtonText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
});
