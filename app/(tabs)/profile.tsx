import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { colors, font, spacing, radius } from '@/utils/theme';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to sign out.');
          }
        },
      },
    ]);
  };

  const initials = profile?.display_name
    ? profile.display_name.charAt(0).toUpperCase()
    : 'P';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.displayName}>
          {profile?.display_name || 'Pumped User'}
        </Text>
        <Text style={styles.memberSince}>Since Mar 2026</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {profile?.strength_score || '—'}
          </Text>
          <Text style={styles.statLabel}>Score</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {profile?.total_workouts || 0}
          </Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {profile?.current_streak_days || 0}
          </Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
      </View>

      <View style={styles.settingsGroup}>
        {[
          { label: 'Program Style', value: profile?.program_style?.replace('_', '/') },
          { label: 'Days / Week', value: profile?.training_frequency },
          { label: 'Equipment', value: profile?.equipment_access?.replace('_', ' ') },
          { label: 'Body Stats', value: null },
          { label: 'Notifications', value: null },
          { label: 'Units', value: 'lbs' },
        ].map((item) => (
          <Pressable key={item.label} style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>{item.label}</Text>
            <View style={styles.settingsRight}>
              {item.value != null && (
                <Text style={styles.settingsValue}>{item.value}</Text>
              )}
              <Text style={styles.settingsChevron}>›</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: font.xxxl,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent.bg,
    borderWidth: 2,
    borderColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.accent.primary,
  },
  displayName: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  memberSince: {
    fontSize: font.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
  statNumber: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: font.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  settingsGroup: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  settingsLabel: {
    fontSize: font.lg,
    color: colors.text.primary,
  },
  settingsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsValue: {
    fontSize: font.md,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  settingsChevron: {
    fontSize: font.xxl,
    color: colors.text.tertiary,
  },
  signOutButton: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  signOutText: {
    color: colors.error,
    fontSize: font.lg,
    fontWeight: '600',
  },
});
