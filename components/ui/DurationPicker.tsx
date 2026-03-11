import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { colors, font, spacing, radius } from '@/utils/theme';

const HOURS = [0, 1, 2, 3];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface DurationPickerProps {
  totalMinutes: number;
  onMinutesChange: (totalMinutes: number) => void;
}

export function DurationPicker({ totalMinutes, onMinutesChange }: DurationPickerProps) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const minutesIndex = MINUTES.indexOf(mins);
  const effectiveMins = minutesIndex >= 0 ? mins : Math.round(mins / 5) * 5;

  const hoursScrollRef = useRef<ScrollView>(null);
  const minutesScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const h = Math.min(Math.max(0, hours), 3);
    const mIdx = MINUTES.indexOf(effectiveMins);
    const clampedM = mIdx >= 0 ? effectiveMins : MINUTES[Math.min(9, Math.round(effectiveMins / 5))];
    hoursScrollRef.current?.scrollTo({ y: HOURS.indexOf(h) * ITEM_HEIGHT, animated: false });
    const mi = MINUTES.indexOf(clampedM);
    if (mi >= 0) {
      minutesScrollRef.current?.scrollTo({ y: mi * ITEM_HEIGHT, animated: false });
    }
  }, []);

  const handleHoursScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const h = HOURS[Math.min(Math.max(0, index), HOURS.length - 1)];
    const newTotal = h * 60 + (totalMinutes % 60);
    onMinutesChange(newTotal);
  };

  const handleMinutesScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const m = MINUTES[Math.min(Math.max(0, index), MINUTES.length - 1)];
    const newTotal = Math.floor(totalMinutes / 60) * 60 + m;
    onMinutesChange(newTotal);
  };

  const snapHours = () => {
    const h = Math.min(Math.max(0, hours), 3);
    const idx = HOURS.indexOf(h);
    if (idx >= 0) {
      hoursScrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
    }
  };

  const snapMinutes = () => {
    const idx = MINUTES.indexOf(effectiveMins);
    const i = idx >= 0 ? idx : Math.min(MINUTES.length - 1, Math.round(effectiveMins / 5));
    const clamped = Math.min(Math.max(0, i), MINUTES.length - 1);
    minutesScrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
  };

  const displayLabel =
    totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
      : `${totalMinutes} min`;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{displayLabel}</Text>
      <View style={styles.pickerRow}>
        <View style={styles.column}>
          <Text style={styles.columnLabel}>Hours</Text>
          <View style={styles.scrollMask}>
            <ScrollView
              ref={hoursScrollRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              snapToAlignment="center"
              decelerationRate="fast"
              onMomentumScrollEnd={handleHoursScroll}
              onScrollEndDrag={snapHours}
              contentContainerStyle={{
                paddingVertical: ITEM_HEIGHT,
              }}
              style={[styles.scroll, { height: PICKER_HEIGHT }]}
            >
              {HOURS.map((h) => (
                <View key={h} style={styles.item}>
                  <Text
                    style={[
                      styles.itemText,
                      hours === h && styles.itemTextSelected,
                    ]}
                  >
                    {h}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
        <View style={styles.column}>
          <Text style={styles.columnLabel}>Minutes</Text>
          <View style={styles.scrollMask}>
            <ScrollView
              ref={minutesScrollRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              snapToAlignment="center"
              decelerationRate="fast"
              onMomentumScrollEnd={handleMinutesScroll}
              onScrollEndDrag={snapMinutes}
              contentContainerStyle={{
                paddingVertical: ITEM_HEIGHT,
              }}
              style={[styles.scroll, { height: PICKER_HEIGHT }]}
            >
              {MINUTES.map((m) => (
                <View key={m} style={styles.item}>
                  <Text
                    style={[
                      styles.itemText,
                      effectiveMins === m && styles.itemTextSelected,
                    ]}
                  >
                    {m}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: spacing.sm,
  },
  label: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  column: {
    alignItems: 'center',
  },
  columnLabel: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  scrollMask: {
    height: PICKER_HEIGHT,
    overflow: 'hidden',
  },
  scroll: {
    width: 56,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: font.xl,
    color: colors.text.tertiary,
  },
  itemTextSelected: {
    color: colors.text.primary,
    fontWeight: '700',
  },
});
