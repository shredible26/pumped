-- 010_muscle_strain_log.sql
-- Workout-level strain tracking for scientific muscle readiness model.
-- Table may already exist in Supabase; CREATE IF NOT EXISTS for safety.

CREATE TABLE IF NOT EXISTS public.muscle_strain_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.workout_sessions(id) ON DELETE CASCADE NOT NULL,
  muscle_group TEXT NOT NULL,
  strain_score NUMERIC(5,1) NOT NULL,
  total_volume NUMERIC(10,1) DEFAULT 0,
  set_count INTEGER DEFAULT 0,
  exercise_count INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strain_user_muscle ON public.muscle_strain_log(user_id, muscle_group, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_strain_session ON public.muscle_strain_log(session_id);

ALTER TABLE public.muscle_strain_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_strain" ON public.muscle_strain_log;
CREATE POLICY "own_strain" ON public.muscle_strain_log FOR ALL USING (auth.uid() = user_id);
