-- Rename the Big 3 squat exercise everywhere we persist its display name.

UPDATE public.exercises
SET name = 'Barbell Squat'
WHERE name = 'Barbell Back Squat';

UPDATE public.set_logs
SET exercise_name = 'Barbell Squat'
WHERE exercise_name = 'Barbell Back Squat';

UPDATE public.saved_workouts sw
SET exercises = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN exercise->>'name' = 'Barbell Back Squat'
          THEN jsonb_set(exercise, '{name}', to_jsonb('Barbell Squat'::TEXT))
        ELSE exercise
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(COALESCE(sw.exercises, '[]'::jsonb)) AS exercise
)
WHERE sw.exercises::TEXT LIKE '%Barbell Back Squat%';

UPDATE public.ai_workout_plans plan
SET exercises = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN exercise->>'name' = 'Barbell Back Squat'
          THEN jsonb_set(exercise, '{name}', to_jsonb('Barbell Squat'::TEXT))
        ELSE exercise
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(COALESCE(plan.exercises, '[]'::jsonb)) AS exercise
)
WHERE plan.exercises::TEXT LIKE '%Barbell Back Squat%';
