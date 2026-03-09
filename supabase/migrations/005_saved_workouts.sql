-- Saved workouts (templates for reuse from Speed Log)
CREATE TABLE IF NOT EXISTS public.saved_workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  name TEXT NOT NULL,
  workout_type TEXT,
  exercises JSONB NOT NULL,
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.saved_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_saved" ON public.saved_workouts
  FOR ALL USING (auth.uid() = user_id);
