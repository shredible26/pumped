import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabase';
import { colors, font, spacing, radius } from '@/utils/theme';

const PROGRAM_OPTIONS = [
  { key: 'ppl', label: 'Push/Pull/Legs' },
  { key: 'upper_lower', label: 'Upper/Lower' },
  { key: 'bro_split', label: 'Bro Split' },
  { key: 'full_body', label: 'Full Body' },
  { key: 'ai_optimal', label: 'AI Optimal' },
];

const DAYS_OPTIONS = [2, 3, 4, 5, 6];

const EQUIP_OPTIONS = [
  { key: 'full_gym', label: 'Full Gym' },
  { key: 'home_gym', label: 'Home Gym' },
  { key: 'bodyweight', label: 'Bodyweight' },
];

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const setProfile = useAuthStore((s) => s.setProfile);
  const session = useAuthStore((s) => s.session);

  const [editingField, setEditingField] = useState<string | null>(null);

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

  const updateField = async (field: string, value: any) => {
    if (!session?.user?.id) return;
    await supabase
      .from('profiles')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (data) setProfile(data as any);
    setEditingField(null);
  };

  const initials = profile?.display_name
    ? profile.display_name.charAt(0).toUpperCase()
    : 'P';

  const memberSince = profile?.created_at
    ? format(new Date(profile.created_at), 'MMM yyyy')
    : 'Mar 2026';

  const programLabel = PROGRAM_OPTIONS.find(
    (p) => p.key === profile?.program_style,
  )?.label;

  const equipLabel = EQUIP_OPTIONS.find(
    (e) => e.key === profile?.equipment_access,
  )?.label;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>
            {profile?.display_name || 'Pumped User'}
          </Text>
          <View style={styles.subRow}>
            <Text style={styles.memberSince}>Since {memberSince}</Text>
            {programLabel && (
              <View style={styles.programPill}>
                <Text style={styles.programPillText}>{programLabel}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {profile?.strength_score ? Number(profile.strength_score).toLocaleString() : '—'}
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
          <Pressable
            style={styles.settingsRow}
            onPress={() => setEditingField('program_style')}
          >
            <Text style={styles.settingsLabel}>Program Style</Text>
            <View style={styles.settingsRight}>
              <Text style={styles.settingsValue}>{programLabel ?? '—'}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </View>
          </Pressable>

          <Pressable
            style={styles.settingsRow}
            onPress={() => setEditingField('training_frequency')}
          >
            <Text style={styles.settingsLabel}>Days / Week</Text>
            <View style={styles.settingsRight}>
              <Text style={styles.settingsValue}>
                {profile?.training_frequency ?? '—'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </View>
          </Pressable>

          <Pressable
            style={styles.settingsRow}
            onPress={() => setEditingField('equipment_access')}
          >
            <Text style={styles.settingsLabel}>Equipment</Text>
            <View style={styles.settingsRight}>
              <Text style={styles.settingsValue}>{equipLabel ?? '—'}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </View>
          </Pressable>

          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Body Stats</Text>
            <View style={styles.settingsRight}>
              <Text style={styles.settingsValue}>
                {profile?.height_inches
                  ? `${Math.floor(Number(profile.height_inches) / 12)}' ${Math.round(Number(profile.height_inches) % 12)}"`
                  : '—'}
                {profile?.weight_lbs ? ` · ${profile.weight_lbs} lbs` : ''}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </View>
          </View>

          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Units</Text>
            <View style={styles.settingsRight}>
              <Text style={styles.settingsValue}>lbs</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </View>
          </View>

          <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.settingsLabel}>Notifications</Text>
            <View style={styles.settingsRight}>
              <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </View>
          </View>
        </View>

        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal for editing program style */}
      <Modal
        visible={editingField === 'program_style'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingField(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingField(null)}>
          <View style={styles.modalSheet}>
            <Pressable>
              <Text style={styles.modalTitle}>Program Style</Text>
              {PROGRAM_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[
                    styles.modalOption,
                    profile?.program_style === opt.key && styles.modalOptionActive,
                  ]}
                  onPress={() => updateField('program_style', opt.key)}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      profile?.program_style === opt.key && styles.modalOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {profile?.program_style === opt.key && (
                    <Ionicons name="checkmark" size={18} color={colors.accent.primary} />
                  )}
                </Pressable>
              ))}
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Modal for editing training frequency */}
      <Modal
        visible={editingField === 'training_frequency'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingField(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingField(null)}>
          <View style={styles.modalSheet}>
            <Pressable>
              <Text style={styles.modalTitle}>Days Per Week</Text>
              <View style={styles.daysPillRow}>
                {DAYS_OPTIONS.map((d) => (
                  <Pressable
                    key={d}
                    style={[
                      styles.dayPill,
                      profile?.training_frequency === d && styles.dayPillActive,
                    ]}
                    onPress={() => updateField('training_frequency', d)}
                  >
                    <Text
                      style={[
                        styles.dayPillText,
                        profile?.training_frequency === d && styles.dayPillTextActive,
                      ]}
                    >
                      {d}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Modal for editing equipment */}
      <Modal
        visible={editingField === 'equipment_access'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingField(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingField(null)}>
          <View style={styles.modalSheet}>
            <Pressable>
              <Text style={styles.modalTitle}>Equipment Access</Text>
              {EQUIP_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[
                    styles.modalOption,
                    profile?.equipment_access === opt.key && styles.modalOptionActive,
                  ]}
                  onPress={() => updateField('equipment_access', opt.key)}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      profile?.equipment_access === opt.key && styles.modalOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {profile?.equipment_access === opt.key && (
                    <Ionicons name="checkmark" size={18} color={colors.accent.primary} />
                  )}
                </Pressable>
              ))}
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  memberSince: {
    fontSize: font.sm,
    color: colors.text.tertiary,
  },
  programPill: {
    backgroundColor: colors.accent.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  programPillText: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.accent.primary,
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
    fontSize: font.md,
    color: colors.text.primary,
    fontWeight: '500',
  },
  settingsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsValue: {
    fontSize: font.md,
    color: colors.text.secondary,
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  modalOptionActive: {
    backgroundColor: colors.accent.bg,
  },
  modalOptionText: {
    fontSize: font.lg,
    color: colors.text.primary,
  },
  modalOptionTextActive: {
    color: colors.accent.primary,
    fontWeight: '600',
  },
  daysPillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dayPill: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  dayPillActive: {
    backgroundColor: colors.accent.bg,
    borderColor: colors.accent.primary,
  },
  dayPillText: {
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  dayPillTextActive: {
    color: colors.accent.primary,
  },
});
