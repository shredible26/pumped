-- 002_exercises.sql
-- Master exercise database (read-only for all users)

CREATE TABLE public.exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT[] DEFAULT '{}',
  movement_pattern TEXT NOT NULL,
  equipment TEXT NOT NULL,
  difficulty TEXT DEFAULT 'intermediate',
  fatigue_rating INTEGER DEFAULT 3 CHECK (fatigue_rating BETWEEN 1 AND 5),
  is_big_three BOOLEAN DEFAULT FALSE,
  big_three_type TEXT CHECK (big_three_type IN ('squat', 'bench', 'deadlift')),
  goal_tags TEXT[] DEFAULT '{}',
  aesthetic_targets TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercises_read" ON public.exercises FOR SELECT USING (TRUE);

-- Seed the Big 3
INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, is_big_three, big_three_type, goal_tags) VALUES
  ('Barbell Back Squat', 'quads', ARRAY['glutes', 'hamstrings', 'abs'], 'squat', 'barbell', 'intermediate', 5, TRUE, 'squat', ARRAY['strength', 'hypertrophy']),
  ('Barbell Bench Press', 'chest', ARRAY['front_delts', 'triceps'], 'horizontal_push', 'barbell', 'intermediate', 4, TRUE, 'bench', ARRAY['strength', 'hypertrophy']),
  ('Barbell Deadlift', 'hamstrings', ARRAY['glutes', 'lats', 'traps', 'forearms'], 'hip_hinge', 'barbell', 'intermediate', 5, TRUE, 'deadlift', ARRAY['strength']);

-- Seed common exercises
INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets) VALUES
  -- Push
  ('Incline Dumbbell Press', 'chest', ARRAY['front_delts', 'triceps'], 'horizontal_push', 'dumbbell', 'intermediate', 3, ARRAY['hypertrophy'], ARRAY['upper_chest']),
  ('Overhead Press', 'front_delts', ARRAY['triceps', 'side_delts'], 'vertical_push', 'barbell', 'intermediate', 4, ARRAY['strength', 'hypertrophy'], ARRAY[]),
  ('Dumbbell Lateral Raise', 'side_delts', ARRAY[]::TEXT[], 'isolation_push', 'dumbbell', 'beginner', 2, ARRAY['hypertrophy'], ARRAY['v_taper', 'side_delts']),
  ('Tricep Pushdown', 'triceps', ARRAY[]::TEXT[], 'isolation_push', 'cable', 'beginner', 2, ARRAY['hypertrophy'], ARRAY[]),
  ('Dips', 'chest', ARRAY['triceps', 'front_delts'], 'vertical_push', 'bodyweight', 'intermediate', 3, ARRAY['strength', 'hypertrophy'], ARRAY[]),
  ('Cable Flyes', 'chest', ARRAY['front_delts'], 'isolation_push', 'cable', 'beginner', 2, ARRAY['hypertrophy'], ARRAY['upper_chest']),
  ('Skull Crushers', 'triceps', ARRAY[]::TEXT[], 'isolation_push', 'barbell', 'intermediate', 2, ARRAY['hypertrophy'], ARRAY[]),
  ('Dumbbell Shoulder Press', 'front_delts', ARRAY['triceps', 'side_delts'], 'vertical_push', 'dumbbell', 'intermediate', 3, ARRAY['hypertrophy'], ARRAY[]),
  -- Pull
  ('Barbell Row', 'lats', ARRAY['biceps', 'rear_delts', 'traps'], 'horizontal_pull', 'barbell', 'intermediate', 4, ARRAY['strength', 'hypertrophy'], ARRAY['v_taper']),
  ('Pull Ups', 'lats', ARRAY['biceps', 'rear_delts'], 'vertical_pull', 'bodyweight', 'intermediate', 3, ARRAY['strength', 'hypertrophy'], ARRAY['v_taper']),
  ('Lat Pulldown', 'lats', ARRAY['biceps', 'rear_delts'], 'vertical_pull', 'cable', 'beginner', 3, ARRAY['hypertrophy'], ARRAY['v_taper']),
  ('Seated Cable Row', 'lats', ARRAY['biceps', 'traps', 'rear_delts'], 'horizontal_pull', 'cable', 'beginner', 3, ARRAY['hypertrophy'], ARRAY[]),
  ('Face Pulls', 'rear_delts', ARRAY['traps'], 'horizontal_pull', 'cable', 'beginner', 2, ARRAY['hypertrophy'], ARRAY[]),
  ('Barbell Curl', 'biceps', ARRAY['forearms'], 'isolation_pull', 'barbell', 'beginner', 2, ARRAY['hypertrophy'], ARRAY[]),
  ('Dumbbell Curl', 'biceps', ARRAY['forearms'], 'isolation_pull', 'dumbbell', 'beginner', 2, ARRAY['hypertrophy'], ARRAY[]),
  ('Hammer Curl', 'biceps', ARRAY['forearms'], 'isolation_pull', 'dumbbell', 'beginner', 2, ARRAY['hypertrophy'], ARRAY[]),
  ('Dumbbell Row', 'lats', ARRAY['biceps', 'rear_delts'], 'horizontal_pull', 'dumbbell', 'beginner', 3, ARRAY['hypertrophy'], ARRAY[]),
  -- Legs
  ('Romanian Deadlift', 'hamstrings', ARRAY['glutes'], 'hip_hinge', 'barbell', 'intermediate', 4, ARRAY['strength', 'hypertrophy'], ARRAY[]),
  ('Leg Press', 'quads', ARRAY['glutes'], 'squat', 'machine', 'beginner', 4, ARRAY['hypertrophy'], ARRAY[]),
  ('Bulgarian Split Squat', 'quads', ARRAY['glutes', 'hamstrings'], 'lunge', 'dumbbell', 'intermediate', 3, ARRAY['hypertrophy'], ARRAY[]),
  ('Leg Curl', 'hamstrings', ARRAY[]::TEXT[], 'isolation_pull', 'machine', 'beginner', 2, ARRAY['hypertrophy'], ARRAY[]),
  ('Leg Extension', 'quads', ARRAY[]::TEXT[], 'isolation_push', 'machine', 'beginner', 2, ARRAY['hypertrophy'], ARRAY[]),
  ('Calf Raise', 'calves', ARRAY[]::TEXT[], 'isolation_push', 'machine', 'beginner', 2, ARRAY['hypertrophy'], ARRAY[]),
  ('Hip Thrust', 'glutes', ARRAY['hamstrings'], 'hip_hinge', 'barbell', 'intermediate', 3, ARRAY['hypertrophy'], ARRAY[]),
  ('Walking Lunges', 'quads', ARRAY['glutes', 'hamstrings'], 'lunge', 'dumbbell', 'intermediate', 3, ARRAY['hypertrophy'], ARRAY[]),
  ('Goblet Squat', 'quads', ARRAY['glutes', 'abs'], 'squat', 'dumbbell', 'beginner', 3, ARRAY['hypertrophy'], ARRAY[]),
  ('Front Squat', 'quads', ARRAY['glutes', 'abs'], 'squat', 'barbell', 'advanced', 5, ARRAY['strength'], ARRAY[]),
  -- Core
  ('Hanging Leg Raise', 'abs', ARRAY[]::TEXT[], 'core', 'bodyweight', 'intermediate', 2, ARRAY['hypertrophy'], ARRAY[]),
  ('Cable Crunch', 'abs', ARRAY[]::TEXT[], 'core', 'cable', 'beginner', 2, ARRAY['hypertrophy'], ARRAY[]),
  ('Plank', 'abs', ARRAY[]::TEXT[], 'core', 'bodyweight', 'beginner', 1, ARRAY['hypertrophy'], ARRAY[]),
  -- Traps / Shrugs
  ('Barbell Shrug', 'traps', ARRAY['forearms'], 'isolation_pull', 'barbell', 'beginner', 2, ARRAY['hypertrophy'], ARRAY[]);
