export const colors = {
  primary: '#1A365D',
  primaryDark: '#122845',
  accent: '#2563EB',
  accentDark: '#1D4ED8',
  secondary: '#319795',
  success: '#38A169',
  warning: '#D69E2E',
  danger: '#E53E3E',
  neutral: '#718096',
  bg: '#F7FAFC',
  white: '#FFFFFF',
  text: '#2D3748',
  textMuted: '#718096',
  border: '#E2E8F0',
};

export const heroGradient: [string, string] = ['#1A365D', '#2563EB'];

export const statusConfig: Record<string, { bg: string; fg: string; label: string }> = {
  available: { bg: colors.success, fg: '#FFFFFF', label: 'Available' },
  booked: { bg: colors.warning, fg: '#1A202C', label: 'Booked' },
  rented: { bg: colors.danger, fg: '#FFFFFF', label: 'Rented' },
  maintenance: { bg: colors.neutral, fg: '#FFFFFF', label: 'Maintenance' },
};

export function formatCurrency(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
