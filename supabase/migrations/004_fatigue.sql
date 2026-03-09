-- 004_fatigue.sql
-- Muscle fatigue tracking, strength history, and AI workout plan cache

CREATE TABLE public.muscle_fatigue (
  user_id UUID REFERENCES public.profiles(id),
  muscle_group TEXT NOT NULL,
  last_trained_at TIMESTAMPTZ,
  volume_load NUMERIC(10,1) DEFAULT 0,
  recovery_pct NUMERIC(5,1) DEFAULT 100,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, muscle_group)
);

ALTER TABLE public.muscle_fatigue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_fatigue" ON public.muscle_fatigue FOR ALL USING (auth.uid() = user_id);

CREATE TABLE public.strength_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  squat_e1rm NUMERIC(6,1),
  bench_e1rm NUMERIC(6,1),
  deadlift_e1rm NUMERIC(6,1),
  total_score NUMERIC(8,1),
  recorded_at DATE DEFAULT CURRENT_DATE,
  UNIQUE(user_id, recorded_at)
);

ALTER TABLE public.strength_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_strength" ON public.strength_history FOR ALL USING (auth.uid() = user_id);

CREATE TABLE public.ai_workout_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  plan_date DATE DEFAULT CURRENT_DATE,
  workout_name TEXT NOT NULL,
  workout_type TEXT,
  exercises JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  used BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, plan_date)
);

ALTER TABLE public.ai_workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_plans" ON public.ai_workout_plans FOR ALL USING (auth.uid() = user_id);
