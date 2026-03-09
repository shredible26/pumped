import { useState, useCallback } from 'react';
import { MuscleFatigue } from '@/types/workout';
import { fetchFatigueMap } from '@/services/fatigue';
import { calculateRecovery } from '@/utils/recoveryModel';
import { useAuthStore } from '@/stores/authStore';

export interface FatigueEntry {
  muscle_group: string;
  recovery_pct: number | null;
  last_trained_at: string | null;
  volume_load: number;
}

export function useFatigue() {
  const { session } = useAuthStore();
  const [fatigueMap, setFatigueMap] = useState<FatigueEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshFatigue = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const data = await fetchFatigueMap(session.user.id);
      const updated: FatigueEntry[] = data.map((m) => ({
        muscle_group: m.muscle_group,
        volume_load: m.volume_load ?? 0,
        last_trained_at: m.last_trained_at ?? null,
        recovery_pct: m.last_trained_at
          ? calculateRecovery(m.muscle_group, new Date(m.last_trained_at), m.volume_load ?? 0)
          : null,
      }));
      setFatigueMap(updated);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  return { fatigueMap, loading, refreshFatigue };
}
