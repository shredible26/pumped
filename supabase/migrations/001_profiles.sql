-- 001_profiles.sql
-- User profile table, created automatically on signup via trigger

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  age INTEGER,
  height_inches NUMERIC(5,1),
  weight_lbs NUMERIC(5,1),
  program_style TEXT CHECK (program_style IN (
    'ppl', 'upper_lower', 'bro_split', 'full_body', 'ai_optimal'
  )) DEFAULT 'ppl',
  training_frequency INTEGER DEFAULT 4,
  equipment_access TEXT CHECK (equipment_access IN (
    'full_gym', 'home_gym', 'bodyweight'
  )) DEFAULT 'full_gym',
  experience_level TEXT CHECK (experience_level IN (
    'beginner', 'intermediate', 'advanced'
  )) DEFAULT 'beginner',
  strength_score NUMERIC(8,1) DEFAULT 0,
  squat_e1rm NUMERIC(6,1) DEFAULT 0,
  bench_e1rm NUMERIC(6,1) DEFAULT 0,
  deadlift_e1rm NUMERIC(6,1) DEFAULT 0,
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  total_workouts INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own_profile_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "own_profile_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
