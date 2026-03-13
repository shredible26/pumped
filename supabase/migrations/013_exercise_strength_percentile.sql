-- Aggregate percentile ranking for a user's best actual set on a selected exercise.
-- Exposes only derived stats, not other users' raw workout data.

CREATE OR REPLACE FUNCTION public.get_exercise_strength_percentile(target_exercise_id UUID)
RETURNS TABLE (
  participant_count INTEGER,
  stronger_user_count INTEGER,
  user_rank INTEGER,
  better_than_pct INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH ranked_sets AS (
    SELECT
      ws.user_id,
      sl.actual_weight::NUMERIC AS weight,
      COALESCE(sl.actual_reps, 0) AS reps,
      ROW_NUMBER() OVER (
        PARTITION BY ws.user_id
        ORDER BY
          sl.actual_weight DESC,
          COALESCE(sl.actual_reps, 0) DESC,
          COALESCE(ws.completed_at, ws.created_at) DESC,
          ws.date DESC,
          sl.created_at DESC
      ) AS user_set_rank
    FROM public.set_logs sl
    JOIN public.workout_sessions ws ON ws.id = sl.session_id
    WHERE sl.exercise_id = target_exercise_id
      AND COALESCE(sl.actual_weight, 0) > 0
      AND ws.completed = TRUE
      AND COALESCE(ws.is_rest_day, FALSE) = FALSE
  ),
  best_by_user AS (
    SELECT
      user_id,
      weight,
      reps
    FROM ranked_sets
    WHERE user_set_rank = 1
  ),
  me AS (
    SELECT
      weight,
      reps
    FROM best_by_user
    WHERE user_id = current_user_id
  ),
  totals AS (
    SELECT COUNT(*)::INTEGER AS participant_count
    FROM best_by_user
  ),
  stronger AS (
    SELECT COUNT(*)::INTEGER AS stronger_user_count
    FROM best_by_user b
    CROSS JOIN me
    WHERE b.user_id <> current_user_id
      AND (
        b.weight > me.weight
        OR (b.weight = me.weight AND b.reps > me.reps)
      )
  ),
  lower AS (
    SELECT COUNT(*)::INTEGER AS lower_user_count
    FROM best_by_user b
    CROSS JOIN me
    WHERE b.user_id <> current_user_id
      AND (
        b.weight < me.weight
        OR (b.weight = me.weight AND b.reps < me.reps)
      )
  )
  SELECT
    totals.participant_count,
    stronger.stronger_user_count,
    CASE
      WHEN totals.participant_count > 0 THEN stronger.stronger_user_count + 1
      ELSE NULL
    END AS user_rank,
    CASE
      WHEN totals.participant_count <= 1 THEN NULL
      ELSE ROUND((lower.lower_user_count::NUMERIC / (totals.participant_count - 1)) * 100)::INTEGER
    END AS better_than_pct
  FROM totals
  CROSS JOIN stronger
  CROSS JOIN lower
  WHERE EXISTS (SELECT 1 FROM me);
END;
$$;

REVOKE ALL ON FUNCTION public.get_exercise_strength_percentile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exercise_strength_percentile(UUID) TO authenticated;
