import { useState, useCallback } from 'react';
import { fetchFatigueMap } from '@/services/fatigue';
import { useAuthStore } from '@/stores/authStore';

export interface FatigueEntry {
  muscle_group: string;
  recovery_pct: number | null;
  last_trained_at: string | null;
  volume_load: number;
  last_strain_score?: number | null;
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
      setFatigueMap(
        data.map((m) => ({
          muscle_group: m.muscle_group,
          recovery_pct: m.recovery_pct,
          last_trained_at: m.last_trained_at,
          volume_load: Number(m.volume_load) || 0,
          last_strain_score: m.last_strain_score ?? null,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  return { fatigueMap, loading, refreshFatigue };
}
