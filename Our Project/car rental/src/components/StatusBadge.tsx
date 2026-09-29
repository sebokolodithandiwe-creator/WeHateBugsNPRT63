import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { statusConfig } from '../theme';

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? statusConfig.available;
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.fg }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
