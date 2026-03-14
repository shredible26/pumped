import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabase';
import { colors, font, spacing, radius } from '@/utils/theme';
import { PROGRAM_STYLES } from '@/utils/constants';
import { formatWeight, formatHeightInches, formatVolume as formatVolumeWithUnit, type Units } from '@/utils/units';
import { fetchDashboardStats } from '@/services/dashboardStats';

const PROGRAM_OPTIONS = PROGRAM_STYLES.map((p) => ({
  key: p.id,
  label: p.label,
  subtitle: p.description,
}));

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
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [bodyStatsDraft, setBodyStatsDraft] = useState({
    heightInches: '',
    weightLbs: '',
    manualSquat: '',
    manualBench: '',
    manualDeadlift: '',
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [volumeTotal, setVolumeTotal] = useState<number | null>(null);
  const [workoutCount, setWorkoutCount] = useState(0);
  const autoRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (err: unknown) {
            Alert.alert('Error', (err as Error)?.message || 'Failed to sign out.');
          }
        },
      },
    ]);
  };

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (data) setProfile(data as never);
  }, [session?.user?.id, setProfile]);

  const updateField = async (
    field: string,
    value: unknown,
    options?: { showProgramConfirmation?: boolean }
  ) => {
    if (!session?.user?.id) return;
    await supabase
      .from('profiles')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);
    await refreshProfile();
    setEditingField(null);
    if (options?.showProgramConfirmation) {
      Alert.alert(
        'Updated',
        'Your next AI workout will follow the new program.'
      );
    }
  };

  const saveDisplayName = () => {
    const name = displayNameDraft.trim();
    if (name) updateField('display_name', name);
    setEditingField(null);
  };

  const openDisplayNameEdit = () => {
    setDisplayNameDraft(profile?.display_name || '');
    setEditingField('display_name');
  };

  const saveBodyStats = async () => {
    if (!session?.user?.id) return;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const hi = parseFloat(bodyStatsDraft.heightInches);
    if (!Number.isNaN(hi) && hi > 0) {
      updates.height_inches = units === 'kg' ? hi / 2.54 : hi;
    }
    const w = parseFloat(bodyStatsDraft.weightLbs);
    if (!Number.isNaN(w) && w > 0) {
      updates.weight_lbs = units === 'kg' ? w / 0.453592 : w;
    }
    const ms = parseFloat(bodyStatsDraft.manualSquat);
    if (!Number.isNaN(ms) && ms >= 0) {
      updates.manual_squat_1rm = units === 'kg' ? ms / 0.453592 : ms;
    }
    const mb = parseFloat(bodyStatsDraft.manualBench);
    if (!Number.isNaN(mb) && mb >= 0) {
      updates.manual_bench_1rm = units === 'kg' ? mb / 0.453592 : mb;
    }
    const md = parseFloat(bodyStatsDraft.manualDeadlift);
    if (!Number.isNaN(md) && md >= 0) {
      updates.manual_deadlift_1rm = units === 'kg' ? md / 0.453592 : md;
    }
    await supabase.from('profiles').update(updates).eq('id', session.user.id);
    await refreshProfile();
    setEditingField(null);
  };

  const openBodyStatsEdit = () => {
    const p = profile as { height_inches?: number; weight_lbs?: number; manual_squat_1rm?: number; manual_bench_1rm?: number; manual_deadlift_1rm?: number } | null;
    if (units === 'kg') {
      setBodyStatsDraft({
        heightInches: p?.height_inches != null ? String(Math.round(Number(p.height_inches) * 2.54)) : '',
        weightLbs: p?.weight_lbs != null ? String((Number(p.weight_lbs) * 0.453592).toFixed(1)) : '',
        manualSquat: p?.manual_squat_1rm != null ? String((Number(p.manual_squat_1rm) * 0.453592).toFixed(1)) : '',
        manualBench: p?.manual_bench_1rm != null ? String((Number(p.manual_bench_1rm) * 0.453592).toFixed(1)) : '',
        manualDeadlift: p?.manual_deadlift_1rm != null ? String((Number(p.manual_deadlift_1rm) * 0.453592).toFixed(1)) : '',
      });
    } else {
      setBodyStatsDraft({
        heightInches: p?.height_inches != null ? String(p.height_inches) : '',
        weightLbs: p?.weight_lbs != null ? String(p.weight_lbs) : '',
        manualSquat: p?.manual_squat_1rm != null ? String(p.manual_squat_1rm) : '',
        manualBench: p?.manual_bench_1rm != null ? String(p.manual_bench_1rm) : '',
        manualDeadlift: p?.manual_deadlift_1rm != null ? String(p.manual_deadlift_1rm) : '',
      });
    }
    setEditingField('body_stats');
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to photos to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !session?.user?.id) return;
    const uri = result.assets[0].uri;
    setAvatarUploading(true);
    try {
      const response = await fetch(uri, { method: 'GET' });
      const arrayBuffer = await response.arrayBuffer();
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${session.user.id}/avatar.${ext}`;
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { upsert: true, contentType });
      if (uploadError) {
        Alert.alert('Upload failed', 'Could not upload photo. You can create an "avatars" bucket in Supabase Storage.');
        return;
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const urlWithCache = `${urlData.publicUrl}?t=${Date.now()}`;
      await updateField('avatar_url', urlData.publicUrl);
    } catch (e) {
      Alert.alert('Error', 'Failed to upload photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const initials = profile?.display_name
    ? profile.display_name.trim().charAt(0).toUpperCase()
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

  const units: Units = (profile as { units?: Units })?.units ?? 'lbs';
  const heightDisplay = formatHeightInches(
    profile?.height_inches != null ? Number(profile.height_inches) : null,
    units
  );
  const weightDisplay = profile?.weight_lbs != null
    ? formatWeight(Number(profile.weight_lbs), units)
    : '—';
  const totalVolumeDisplay =
    volumeTotal != null
      ? formatVolumeWithUnit(volumeTotal, units).replace(` ${units}`, '')
      : '—';

  const refreshStats = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const stats = await fetchDashboardStats(session.user.id);
      setVolumeTotal(stats.volumeTotal);
      setWorkoutCount(stats.workoutCount);
    } catch {
      setVolumeTotal(null);
      setWorkoutCount(0);
    }
  }, [session?.user?.id]);

  const refreshScreenData = useCallback(async () => {
    await Promise.all([refreshProfile(), refreshStats()]);
  }, [refreshProfile, refreshStats]);

  useEffect(() => {
    void refreshScreenData();
  }, [refreshScreenData]);

  useFocusEffect(
    useCallback(() => {
      void refreshScreenData();
    }, [refreshScreenData])
  );

  useEffect(() => {
    if (!session?.user?.id) return;

    const userId = session.user.id;
    const scheduleRefresh = () => {
      if (autoRefreshTimeoutRef.current) {
        clearTimeout(autoRefreshTimeoutRef.current);
      }
      autoRefreshTimeoutRef.current = setTimeout(() => {
        void refreshScreenData();
      }, 250);
    };

    const channel = supabase
      .channel(`profile-stats-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workout_sessions',
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (autoRefreshTimeoutRef.current) {
        clearTimeout(autoRefreshTimeoutRef.current);
        autoRefreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [refreshScreenData, session?.user?.id]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.profileHeader}>
          <Pressable
            onPress={pickAvatar}
            style={styles.avatar}
            disabled={avatarUploading}
          >
            {avatarUploading ? (
              <ActivityIndicator color={colors.accent.primary} />
            ) : (profile as { avatar_url?: string })?.avatar_url ? (
              <Image
                source={{
                  uri: (profile as { avatar_url: string }).avatar_url.split('?')[0] + '?t=' + (profile?.updated_at || Date.now()),
                }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </Pressable>
          <Pressable onPress={openDisplayNameEdit} style={styles.displayNameWrap}>
            <Text style={styles.displayName}>
              {profile?.display_name || 'Pumped User'}
            </Text>
            <Text style={styles.tapToEditHint}>tap to edit</Text>
          </Pressable>
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
            <Text style={styles.statNumber}>{workoutCount}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile?.current_streak_days || 0}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{totalVolumeDisplay}</Text>
            <Text style={styles.statLabel}>{units === 'kg' ? 'Kg total' : 'Lbs total'}</Text>
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

          <Pressable style={styles.settingsRow} onPress={openBodyStatsEdit}>
            <Text style={styles.settingsLabel}>Body Stats</Text>
            <View style={styles.settingsRight}>
              <Text style={styles.settingsValue}>
                {heightDisplay}
                {profile?.weight_lbs != null ? ` · ${weightDisplay}` : ''}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </View>
          </Pressable>

          <Pressable
            style={styles.settingsRow}
            onPress={() => setEditingField('units')}
          >
            <Text style={styles.settingsLabel}>Units</Text>
            <View style={styles.settingsRight}>
              <Text style={styles.settingsValue}>
                {units === 'kg' ? 'kg / cm' : 'lbs / ft-in'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </View>
          </Pressable>
        </View>

        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Display name modal */}
      <Modal
        visible={editingField === 'display_name'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingField(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingField(null)} />
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Display Name</Text>
            <TextInput
              style={styles.textInput}
              value={displayNameDraft}
              onChangeText={setDisplayNameDraft}
              placeholder="Your name"
              placeholderTextColor={colors.text.tertiary}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalButtonSecondary} onPress={() => setEditingField(null)}>
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalButtonPrimary} onPress={saveDisplayName}>
                <Text style={styles.modalButtonPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Body stats modal */}
      <Modal
        visible={editingField === 'body_stats'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingField(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingField(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Body Stats</Text>
            <Text style={styles.inputLabel}>Height ({units === 'kg' ? 'cm' : 'inches'})</Text>
            <TextInput
              style={styles.textInput}
              value={bodyStatsDraft.heightInches}
              onChangeText={(t) => setBodyStatsDraft((p) => ({ ...p, heightInches: t }))}
              placeholder={units === 'kg' ? 'e.g. 178' : 'e.g. 70'}
              placeholderTextColor={colors.text.tertiary}
              keyboardType="decimal-pad"
            />
            <Text style={styles.inputLabel}>Weight ({units})</Text>
            <TextInput
              style={styles.textInput}
              value={bodyStatsDraft.weightLbs}
              onChangeText={(t) => setBodyStatsDraft((p) => ({ ...p, weightLbs: t }))}
              placeholder={units === 'kg' ? 'e.g. 75' : 'e.g. 165'}
              placeholderTextColor={colors.text.tertiary}
              keyboardType="decimal-pad"
            />
            <Text style={styles.inputLabel}>Manual 1RM (optional, {units})</Text>
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={bodyStatsDraft.manualSquat}
                onChangeText={(t) => setBodyStatsDraft((p) => ({ ...p, manualSquat: t }))}
                placeholder="Squat"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={bodyStatsDraft.manualBench}
                onChangeText={(t) => setBodyStatsDraft((p) => ({ ...p, manualBench: t }))}
                placeholder="Bench"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={bodyStatsDraft.manualDeadlift}
                onChangeText={(t) => setBodyStatsDraft((p) => ({ ...p, manualDeadlift: t }))}
                placeholder="Deadlift"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalButtonSecondary} onPress={() => setEditingField(null)}>
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalButtonPrimary} onPress={saveBodyStats}>
                <Text style={styles.modalButtonPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Units modal */}
      <Modal
        visible={editingField === 'units'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingField(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingField(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Units</Text>
            {(['lbs', 'kg'] as const).map((u) => (
              <Pressable
                key={u}
                style={[
                  styles.modalOption,
                  units === u && styles.modalOptionActive,
                ]}
                onPress={() => updateField('units', u)}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    units === u && styles.modalOptionTextActive,
                  ]}
                >
                  {u === 'lbs' ? 'lbs / ft-in' : 'kg / cm'}
                </Text>
                {units === u && (
                  <Ionicons name="checkmark" size={18} color={colors.accent.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Program style modal */}
      <Modal
        visible={editingField === 'program_style'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingField(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingField(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Program Style</Text>
            {PROGRAM_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[
                  styles.modalOption,
                  profile?.program_style === opt.key && styles.modalOptionActive,
                ]}
                onPress={() => updateField('program_style', opt.key, { showProgramConfirmation: true })}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.modalOptionText,
                      profile?.program_style === opt.key && styles.modalOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {'subtitle' in opt && opt.subtitle && (
                    <Text style={styles.modalOptionSubtitle}>{opt.subtitle}</Text>
                  )}
                </View>
                {profile?.program_style === opt.key && (
                  <Ionicons name="checkmark" size={18} color={colors.accent.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Days per week modal */}
      <Modal
        visible={editingField === 'training_frequency'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingField(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingField(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Days Per Week</Text>
            <View style={styles.daysPillRow}>
              {DAYS_OPTIONS.map((d) => (
                <Pressable
                  key={d}
                  style={[
                    styles.dayPill,
                    profile?.training_frequency === d && styles.dayPillActive,
                  ]}
                  onPress={() => updateField('training_frequency', d, { showProgramConfirmation: true })}
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
          </View>
        </Pressable>
      </Modal>

      {/* Equipment modal */}
      <Modal
        visible={editingField === 'equipment_access'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingField(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingField(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Equipment Access</Text>
            {EQUIP_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[
                  styles.modalOption,
                  profile?.equipment_access === opt.key && styles.modalOptionActive,
                ]}
                onPress={() => updateField('equipment_access', opt.key, { showProgramConfirmation: true })}
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarText: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.accent.primary,
  },
  displayNameWrap: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  displayName: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  tapToEditHint: {
    fontSize: font.xs,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: 2,
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
  textInput: {
    backgroundColor: colors.bg.input,
    borderRadius: radius.md,
    padding: spacing.lg,
    fontSize: font.md,
    color: colors.text.primary,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  inputLabel: {
    fontSize: font.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: font.md,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  modalButtonSecondaryText: {
    color: colors.text.secondary,
    fontSize: font.md,
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
  },
  modalOptionSubtitle: {
    fontSize: font.xs,
    color: colors.text.tertiary,
    marginTop: 2,
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
