import { useState, useCallback } from 'react';
import { MuscleFatigue } from '@/types/workout';
import { fetchFatigueMap } from '@/services/fatigue';
import { calculateRecovery } from '@/utils/recoveryModel';
import { useAuthStore } from '@/stores/authStore';

export function useFatigue() {
  const { session } = useAuthStore();
  const [fatigueMap, setFatigueMap] = useState<MuscleFatigue[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshFatigue = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const data = await fetchFatigueMap(session.user.id);
      const updated = data.map((m) => ({
        ...m,
        recovery_pct: m.last_trained_at
          ? calculateRecovery(m.muscle_group, new Date(m.last_trained_at), m.volume_load)
          : 100,
      }));
      setFatigueMap(updated);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  return { fatigueMap, loading, refreshFatigue };
}
