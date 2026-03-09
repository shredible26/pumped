-- 003_workouts.sql
-- Workout sessions and individual set logs

CREATE TABLE public.workout_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  name TEXT NOT NULL,
  workout_type TEXT,
  source TEXT DEFAULT 'ai_generated',
  duration_seconds INTEGER,
  total_volume NUMERIC(10,1) DEFAULT 0,
  exercise_count INTEGER DEFAULT 0,
  set_count INTEGER DEFAULT 0,
  pr_count INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON public.workout_sessions(user_id, date DESC);

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sessions" ON public.workout_sessions FOR ALL USING (auth.uid() = user_id);

CREATE TABLE public.set_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES public.exercises(id),
  exercise_name TEXT NOT NULL,
  exercise_order INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  target_weight NUMERIC(6,1),
  target_reps INTEGER,
  actual_weight NUMERIC(6,1),
  actual_reps INTEGER,
  is_warmup BOOLEAN DEFAULT FALSE,
  is_pr BOOLEAN DEFAULT FALSE,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sets_session ON public.set_logs(session_id, exercise_order, set_number);
CREATE INDEX idx_sets_exercise ON public.set_logs(exercise_id);

ALTER TABLE public.set_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sets" ON public.set_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = set_logs.session_id AND ws.user_id = auth.uid())
);
