import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { colors, font, spacing, radius } from '@/utils/theme';
import { getReadinessColor, getReadinessStatus } from '@/utils/recoveryModel';
import { format, formatDistanceToNow } from 'date-fns';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = 300;

export interface MuscleFatigueData {
  muscle_group: string;
  recovery_pct: number | null;
  last_trained_at: string | null;
  volume_load?: number;
  last_strain_score?: number | null;
}

interface MuscleDetailSheetProps {
  visible: boolean;
  muscle: string | null;
  fatigueMap: MuscleFatigueData[];
  onClose: () => void;
}

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  front_delts: 'Front Delts',
  side_delts: 'Side Delts',
  rear_delts: 'Rear Delts',
  lats: 'Lats',
  traps: 'Traps',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
};

export default function MuscleDetailSheet({
  visible,
  muscle,
  fatigueMap,
  onClose,
}: MuscleDetailSheetProps) {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    }),
  ).current;

  const entry = fatigueMap.find((m) => m.muscle_group === muscle);
  const recovery = entry?.recovery_pct != null && entry.recovery_pct !== -1 ? entry.recovery_pct : null;
  const color = getReadinessColor(recovery);
  const status = getReadinessStatus(recovery);
  const label = muscle ? MUSCLE_LABELS[muscle] ?? muscle : '';
  const lastTrainedAt = entry?.last_trained_at;
  const lastTrainedLabel = lastTrainedAt
    ? format(new Date(lastTrainedAt), 'MMM d, yyyy')
    : null;
  const timeSinceTrained = lastTrainedAt
    ? formatDistanceToNow(new Date(lastTrainedAt), { addSuffix: true })
    : null;
  const volumeLoad = entry?.volume_load ?? 0;
  const lastStrainScore = entry?.last_strain_score ?? null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <Pressable>
            <View style={styles.handleBar} />

            <Text style={styles.muscleName}>{label}</Text>

            <View style={styles.recoveryRow}>
              <Text style={[styles.recoveryPct, { color }]}>
                {recovery !== null ? `${recovery}%` : '—'}
              </Text>
              <Text style={[styles.statusText, { color }]}>{status}</Text>
            </View>

            <View style={styles.recoveryBar}>
              <View
                style={[
                  styles.recoveryFill,
                  {
                    width: recovery !== null ? `${Math.min(100, recovery)}%` : '0%',
                    backgroundColor: color,
                  },
                ]}
              />
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last trained</Text>
              <Text style={styles.infoValue}>
                {lastTrainedLabel ?? 'Never trained'}
              </Text>
            </View>

            {timeSinceTrained ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Time since last trained</Text>
                <Text style={styles.infoValue}>{timeSinceTrained}</Text>
              </View>
            ) : null}

            {lastStrainScore != null && lastStrainScore > 0 ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Strain from last workout</Text>
                <Text style={styles.infoValue}>{lastStrainScore}%</Text>
              </View>
            ) : null}

            {volumeLoad > 0 && lastTrainedAt ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Volume last session</Text>
                <Text style={styles.infoValue}>
                  {Math.round(volumeLoad).toLocaleString()} lb·reps
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingTop: spacing.md,
    minHeight: SHEET_HEIGHT,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.tertiary,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  muscleName: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  recoveryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  recoveryPct: {
    fontSize: font.display,
    fontWeight: '800',
  },
  statusText: {
    fontSize: font.md,
    fontWeight: '600',
    flex: 1,
  },
  recoveryBar: {
    height: 6,
    backgroundColor: colors.bg.input,
    borderRadius: 3,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  recoveryFill: {
    height: '100%',
    borderRadius: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  infoLabel: {
    fontSize: font.md,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
});
