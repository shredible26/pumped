import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, font, spacing, radius } from '@/utils/theme';
import { sanitizeDurationInputPart } from '@/utils/exerciseUtils';

interface MinuteSecondInputProps {
  minutes: string;
  seconds: string;
  onMinutesChange: (value: string) => void;
  onSecondsChange: (value: string) => void;
}

export function MinuteSecondInput({
  minutes,
  seconds,
  onMinutesChange,
  onSecondsChange,
}: MinuteSecondInputProps) {
  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <Text style={styles.label}>Minutes</Text>
        <TextInput
          style={styles.input}
          value={minutes}
          onChangeText={(text) => onMinutesChange(sanitizeDurationInputPart(text, 99))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.text.tertiary}
          maxLength={2}
          selectTextOnFocus
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Seconds</Text>
        <TextInput
          style={styles.input}
          value={seconds}
          onChangeText={(text) => onSecondsChange(sanitizeDurationInputPart(text, 59))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.text.tertiary}
          maxLength={2}
          selectTextOnFocus
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
  },
  label: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 48,
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text.primary,
    fontSize: font.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
});
