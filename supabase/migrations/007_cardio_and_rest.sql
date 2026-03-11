-- 007_cardio_and_rest.sql
-- Add rest day and cardio support to workout_sessions; seed cardio exercises

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS is_rest_day BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_cardio BOOLEAN DEFAULT FALSE;

-- Cardio exercises: movement_pattern = 'cardio', primary_muscle = 'cardio', equipment = 'cardio_machine' or 'bodyweight', difficulty = 'beginner'
INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating)
VALUES
  ('Walking', 'cardio', '{}', 'cardio', 'bodyweight', 'beginner', 1),
  ('Running', 'cardio', '{}', 'cardio', 'bodyweight', 'beginner', 2),
  ('Treadmill (Incline Walk)', 'cardio', '{}', 'cardio', 'cardio_machine', 'beginner', 1),
  ('Stairmaster', 'cardio', '{}', 'cardio', 'cardio_machine', 'beginner', 2),
  ('Stationary Bike', 'cardio', '{}', 'cardio', 'cardio_machine', 'beginner', 1),
  ('Elliptical', 'cardio', '{}', 'cardio', 'cardio_machine', 'beginner', 1),
  ('Jump Rope', 'cardio', '{}', 'cardio', 'bodyweight', 'beginner', 2),
  ('Rowing Machine', 'cardio', '{}', 'cardio', 'cardio_machine', 'beginner', 2),
  ('Swimming', 'cardio', '{}', 'cardio', 'bodyweight', 'beginner', 2);
