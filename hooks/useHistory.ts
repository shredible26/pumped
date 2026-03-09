import { useState, useCallback } from 'react';
import { WorkoutSession } from '@/types/workout';
import { fetchSessions } from '@/services/workouts';
import { useAuthStore } from '@/stores/authStore';

export function useHistory() {
  const { session } = useAuthStore();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadSessions = useCallback(
    async (reset = false) => {
      if (!session?.user?.id) return;
      setLoading(true);
      try {
        const offset = reset ? 0 : sessions.length;
        const data = await fetchSessions(session.user.id, 20, offset);
        if (reset) {
          setSessions(data);
        } else {
          setSessions((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === 20);
      } finally {
        setLoading(false);
      }
    },
    [session?.user?.id, sessions.length],
  );

  return { sessions, loading, hasMore, loadSessions };
}
