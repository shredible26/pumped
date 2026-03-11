import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, font, spacing, radius } from '@/utils/theme';

interface DurationInputProps {
  totalMinutes: number;
  onMinutesChange: (totalMinutes: number) => void;
}

export function DurationInput({ totalMinutes, onMinutesChange }: DurationInputProps) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const clamp = (n: number, min: number, max: number) =>
    Math.min(max, Math.max(min, isNaN(n) ? min : n));

  const handleHoursChange = (text: string) => {
    const h = clamp(parseInt(text.replace(/\D/g, '') || '0', 10), 0, 23);
    onMinutesChange(h * 60 + mins);
  };

  const handleMinutesChange = (text: string) => {
    const m = clamp(parseInt(text.replace(/\D/g, '') || '0', 10), 0, 59);
    onMinutesChange(hours * 60 + m);
  };

  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <Text style={styles.label}>Hours</Text>
        <TextInput
          style={styles.input}
          value={hours.toString()}
          onChangeText={handleHoursChange}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="0"
          placeholderTextColor={colors.text.tertiary}
        />
      </View>
      <View style={styles.sep}>
        <Text style={styles.sepText}>:</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Minutes</Text>
        <TextInput
          style={styles.input}
          value={mins.toString()}
          onChangeText={handleMinutesChange}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="0"
          placeholderTextColor={colors.text.tertiary}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
  },
  label: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
    minHeight: 48,
  },
  sep: {
    paddingBottom: spacing.md,
  },
  sepText: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.tertiary,
  },
});
