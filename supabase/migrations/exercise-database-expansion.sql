-- PUMPED Exercise Database Expansion
-- Run this in Supabase SQL Editor
-- Adds ~200 exercises across all muscle groups with proper metadata
-- Uses ON CONFLICT (name) DO NOTHING to avoid duplicates with existing exercises

-- 1) Ensure we can skip duplicate names: add UNIQUE(name) if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.exercises'::regclass AND conname = 'exercises_name_key'
  ) THEN
    ALTER TABLE public.exercises ADD CONSTRAINT exercises_name_key UNIQUE (name);
  END IF;
END $$;

-- 2) Allow fatigue_rating 0 (stretching/mobility); existing check is 1-5
DO $$
DECLARE
  cn name;
BEGIN
  SELECT conname INTO cn
  FROM pg_constraint
  WHERE conrelid = 'public.exercises'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%fatigue_rating%';
  IF cn IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.exercises DROP CONSTRAINT %I', cn);
  END IF;
  ALTER TABLE public.exercises ADD CONSTRAINT exercises_fatigue_rating_check
    CHECK (fatigue_rating >= 0 AND fatigue_rating <= 5);
END $$;

-- ═══════════════════════════════════════════════════════════
-- CHEST (primary_muscle: 'chest')
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets, is_big_three, big_three_type) VALUES
-- Barbell
('Barbell Bench Press', 'chest', '{triceps,front_delts}', 'horizontal_push', 'barbell', 'intermediate', 4, '{strength,hypertrophy,compound}', '{chest}', true, 'bench'),
('Incline Barbell Bench Press', 'chest', '{triceps,front_delts}', 'horizontal_push', 'barbell', 'intermediate', 4, '{hypertrophy,compound}', '{upper_chest}', false, NULL),
('Decline Barbell Bench Press', 'chest', '{triceps,front_delts}', 'horizontal_push', 'barbell', 'intermediate', 3, '{hypertrophy,compound}', '{chest}', false, NULL),
('Close-Grip Bench Press', 'chest', '{triceps,front_delts}', 'horizontal_push', 'barbell', 'intermediate', 3, '{strength,hypertrophy}', '{chest}', false, NULL),
-- Dumbbell
('Dumbbell Bench Press', 'chest', '{triceps,front_delts}', 'horizontal_push', 'dumbbell', 'beginner', 3, '{hypertrophy}', '{chest}', false, NULL),
('Incline Dumbbell Press', 'chest', '{triceps,front_delts}', 'horizontal_push', 'dumbbell', 'intermediate', 3, '{hypertrophy,aesthetic_priority}', '{upper_chest,v_taper}', false, NULL),
('Decline Dumbbell Press', 'chest', '{triceps,front_delts}', 'horizontal_push', 'dumbbell', 'intermediate', 3, '{hypertrophy}', '{chest}', false, NULL),
('Dumbbell Flyes', 'chest', '{front_delts}', 'isolation', 'dumbbell', 'beginner', 2, '{hypertrophy,aesthetic_priority}', '{chest}', false, NULL),
('Incline Dumbbell Flyes', 'chest', '{front_delts}', 'isolation', 'dumbbell', 'beginner', 2, '{hypertrophy,aesthetic_priority}', '{upper_chest}', false, NULL),
('Dumbbell Pullover', 'chest', '{lats,triceps}', 'isolation', 'dumbbell', 'intermediate', 2, '{hypertrophy}', '{chest}', false, NULL),
-- Cable
('Cable Flyes', 'chest', '{front_delts}', 'isolation', 'cable', 'beginner', 2, '{hypertrophy,aesthetic_priority}', '{chest}', false, NULL),
('Cable Crossover', 'chest', '{front_delts}', 'isolation', 'cable', 'beginner', 2, '{hypertrophy}', '{chest}', false, NULL),
('Low Cable Flyes', 'chest', '{front_delts}', 'isolation', 'cable', 'beginner', 2, '{hypertrophy}', '{upper_chest}', false, NULL),
-- Machine
('Machine Chest Press', 'chest', '{triceps,front_delts}', 'horizontal_push', 'machine', 'beginner', 3, '{hypertrophy}', '{chest}', false, NULL),
('Pec Deck Machine', 'chest', '{front_delts}', 'isolation', 'machine', 'beginner', 2, '{hypertrophy}', '{chest}', false, NULL),
('Smith Machine Bench Press', 'chest', '{triceps,front_delts}', 'horizontal_push', 'machine', 'beginner', 3, '{hypertrophy}', '{chest}', false, NULL),
('Smith Machine Incline Press', 'chest', '{triceps,front_delts}', 'horizontal_push', 'machine', 'beginner', 3, '{hypertrophy}', '{upper_chest}', false, NULL),
-- Bodyweight
('Push-Ups', 'chest', '{triceps,front_delts}', 'horizontal_push', 'bodyweight', 'beginner', 2, '{hypertrophy}', '{chest}', false, NULL),
('Incline Push-Ups', 'chest', '{triceps,front_delts}', 'horizontal_push', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{chest}', false, NULL),
('Decline Push-Ups', 'chest', '{triceps,front_delts}', 'horizontal_push', 'bodyweight', 'intermediate', 2, '{hypertrophy}', '{upper_chest}', false, NULL),
('Diamond Push-Ups', 'chest', '{triceps}', 'horizontal_push', 'bodyweight', 'intermediate', 2, '{hypertrophy}', '{chest}', false, NULL),
('Wide Push-Ups', 'chest', '{front_delts}', 'horizontal_push', 'bodyweight', 'beginner', 2, '{hypertrophy}', '{chest}', false, NULL),
('Dips', 'chest', '{triceps,front_delts}', 'horizontal_push', 'bodyweight', 'intermediate', 3, '{strength,hypertrophy}', '{chest}', false, NULL),
('Chest Dips (Weighted)', 'chest', '{triceps,front_delts}', 'horizontal_push', 'bodyweight', 'advanced', 4, '{strength,hypertrophy}', '{chest}', false, NULL)
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- BACK / LATS (primary_muscle: 'lats')
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets, is_big_three, big_three_type) VALUES
-- Barbell
('Barbell Row', 'lats', '{biceps,rear_delts,traps}', 'horizontal_pull', 'barbell', 'intermediate', 4, '{strength,hypertrophy,compound}', '{v_taper}', false, NULL),
('Pendlay Row', 'lats', '{biceps,rear_delts,traps}', 'horizontal_pull', 'barbell', 'advanced', 4, '{strength,compound}', '{v_taper}', false, NULL),
('T-Bar Row', 'lats', '{biceps,rear_delts,traps}', 'horizontal_pull', 'barbell', 'intermediate', 4, '{hypertrophy,compound}', '{v_taper}', false, NULL),
-- Dumbbell
('Dumbbell Row', 'lats', '{biceps,rear_delts}', 'horizontal_pull', 'dumbbell', 'beginner', 3, '{hypertrophy}', '{v_taper}', false, NULL),
('Chest-Supported Dumbbell Row', 'lats', '{biceps,rear_delts}', 'horizontal_pull', 'dumbbell', 'beginner', 2, '{hypertrophy}', '{v_taper}', false, NULL),
('Kroc Row', 'lats', '{biceps,rear_delts,forearms}', 'horizontal_pull', 'dumbbell', 'advanced', 4, '{strength,hypertrophy}', '{v_taper}', false, NULL),
-- Cable
('Seated Cable Row', 'lats', '{biceps,rear_delts,traps}', 'horizontal_pull', 'cable', 'beginner', 3, '{hypertrophy}', '{v_taper}', false, NULL),
('Lat Pulldown', 'lats', '{biceps,rear_delts}', 'vertical_pull', 'cable', 'beginner', 3, '{hypertrophy}', '{v_taper}', false, NULL),
('Wide-Grip Lat Pulldown', 'lats', '{biceps,rear_delts}', 'vertical_pull', 'cable', 'beginner', 3, '{hypertrophy,aesthetic_priority}', '{v_taper}', false, NULL),
('Close-Grip Lat Pulldown', 'lats', '{biceps}', 'vertical_pull', 'cable', 'beginner', 3, '{hypertrophy}', '{v_taper}', false, NULL),
('Straight-Arm Pulldown', 'lats', '{}', 'isolation', 'cable', 'intermediate', 2, '{hypertrophy}', '{v_taper}', false, NULL),
('Cable Pullover', 'lats', '{chest}', 'isolation', 'cable', 'intermediate', 2, '{hypertrophy}', '{v_taper}', false, NULL),
('Single-Arm Cable Row', 'lats', '{biceps,rear_delts}', 'horizontal_pull', 'cable', 'intermediate', 2, '{hypertrophy}', '{v_taper}', false, NULL),
-- Machine
('Machine Row', 'lats', '{biceps,rear_delts}', 'horizontal_pull', 'machine', 'beginner', 3, '{hypertrophy}', '{v_taper}', false, NULL),
('Assisted Pull-Up Machine', 'lats', '{biceps}', 'vertical_pull', 'machine', 'beginner', 2, '{hypertrophy}', '{v_taper}', false, NULL),
-- Bodyweight
('Pull-Ups', 'lats', '{biceps,rear_delts,forearms}', 'vertical_pull', 'bodyweight', 'intermediate', 3, '{strength,hypertrophy}', '{v_taper}', false, NULL),
('Chin-Ups', 'lats', '{biceps}', 'vertical_pull', 'bodyweight', 'intermediate', 3, '{strength,hypertrophy}', '{v_taper,arms}', false, NULL),
('Weighted Pull-Ups', 'lats', '{biceps,rear_delts,forearms}', 'vertical_pull', 'bodyweight', 'advanced', 4, '{strength}', '{v_taper}', false, NULL),
('Neutral-Grip Pull-Ups', 'lats', '{biceps,forearms}', 'vertical_pull', 'bodyweight', 'intermediate', 3, '{hypertrophy}', '{v_taper}', false, NULL),
('Inverted Row', 'lats', '{biceps,rear_delts}', 'horizontal_pull', 'bodyweight', 'beginner', 2, '{hypertrophy}', '{v_taper}', false, NULL)
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- TRAPS (primary_muscle: 'traps')
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets) VALUES
('Barbell Shrug', 'traps', '{forearms}', 'isolation', 'barbell', 'beginner', 2, '{hypertrophy}', '{traps}'),
('Dumbbell Shrug', 'traps', '{forearms}', 'isolation', 'dumbbell', 'beginner', 2, '{hypertrophy}', '{traps}'),
('Trap Bar Shrug', 'traps', '{forearms}', 'isolation', 'barbell', 'beginner', 2, '{hypertrophy}', '{traps}'),
('Behind-the-Back Barbell Shrug', 'traps', '{forearms}', 'isolation', 'barbell', 'intermediate', 2, '{hypertrophy}', '{traps}'),
('Cable Shrug', 'traps', '{}', 'isolation', 'cable', 'beginner', 2, '{hypertrophy}', '{traps}'),
('Face Pulls', 'traps', '{rear_delts}', 'horizontal_pull', 'cable', 'beginner', 2, '{hypertrophy,aesthetic_priority}', '{rear_delts,traps}'),
('Farmer''s Walk', 'traps', '{forearms,abs}', 'isolation', 'dumbbell', 'intermediate', 3, '{strength}', '{traps}')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- SHOULDERS / DELTS
-- ═══════════════════════════════════════════════════════════

-- FRONT DELTS (primary_muscle: 'front_delts')
INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets) VALUES
('Overhead Press (Barbell)', 'front_delts', '{triceps,side_delts}', 'vertical_push', 'barbell', 'intermediate', 4, '{strength,hypertrophy,compound}', '{side_delts}'),
('Seated Overhead Press', 'front_delts', '{triceps,side_delts}', 'vertical_push', 'barbell', 'intermediate', 3, '{hypertrophy,compound}', '{side_delts}'),
('Dumbbell Shoulder Press', 'front_delts', '{triceps,side_delts}', 'vertical_push', 'dumbbell', 'beginner', 3, '{hypertrophy,compound}', '{side_delts}'),
('Seated Dumbbell Shoulder Press', 'front_delts', '{triceps,side_delts}', 'vertical_push', 'dumbbell', 'beginner', 3, '{hypertrophy}', '{side_delts}'),
('Arnold Press', 'front_delts', '{triceps,side_delts}', 'vertical_push', 'dumbbell', 'intermediate', 3, '{hypertrophy,aesthetic_priority}', '{side_delts}'),
('Machine Shoulder Press', 'front_delts', '{triceps,side_delts}', 'vertical_push', 'machine', 'beginner', 3, '{hypertrophy}', '{side_delts}'),
('Smith Machine Overhead Press', 'front_delts', '{triceps,side_delts}', 'vertical_push', 'machine', 'beginner', 3, '{hypertrophy}', '{side_delts}'),
('Push Press', 'front_delts', '{triceps,side_delts,quads}', 'vertical_push', 'barbell', 'advanced', 4, '{strength}', '{side_delts}'),
('Barbell Front Raise', 'front_delts', '{}', 'isolation', 'barbell', 'beginner', 1, '{hypertrophy}', '{front_delts}'),
('Dumbbell Front Raise', 'front_delts', '{}', 'isolation', 'dumbbell', 'beginner', 1, '{hypertrophy}', '{front_delts}'),
('Cable Front Raise', 'front_delts', '{}', 'isolation', 'cable', 'beginner', 1, '{hypertrophy}', '{front_delts}'),
('Plate Front Raise', 'front_delts', '{}', 'isolation', 'barbell', 'beginner', 1, '{hypertrophy}', '{front_delts}'),
('Handstand Push-Ups', 'front_delts', '{triceps}', 'vertical_push', 'bodyweight', 'advanced', 3, '{strength}', '{side_delts}'),
('Pike Push-Ups', 'front_delts', '{triceps}', 'vertical_push', 'bodyweight', 'intermediate', 2, '{hypertrophy}', '{side_delts}')
ON CONFLICT (name) DO NOTHING;

-- SIDE DELTS (primary_muscle: 'side_delts')
INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets) VALUES
('Dumbbell Lateral Raise', 'side_delts', '{}', 'isolation', 'dumbbell', 'beginner', 1, '{hypertrophy,aesthetic_priority}', '{side_delts,v_taper}'),
('Cable Lateral Raise', 'side_delts', '{}', 'isolation', 'cable', 'beginner', 1, '{hypertrophy,aesthetic_priority}', '{side_delts,v_taper}'),
('Machine Lateral Raise', 'side_delts', '{}', 'isolation', 'machine', 'beginner', 1, '{hypertrophy}', '{side_delts,v_taper}'),
('Behind-the-Back Cable Lateral Raise', 'side_delts', '{}', 'isolation', 'cable', 'intermediate', 1, '{hypertrophy,aesthetic_priority}', '{side_delts,v_taper}'),
('Dumbbell Y-Raise', 'side_delts', '{front_delts}', 'isolation', 'dumbbell', 'beginner', 1, '{hypertrophy}', '{side_delts}'),
('Upright Row (Dumbbell)', 'side_delts', '{traps,front_delts}', 'vertical_pull', 'dumbbell', 'intermediate', 2, '{hypertrophy}', '{side_delts}'),
('Upright Row (Barbell)', 'side_delts', '{traps,front_delts}', 'vertical_pull', 'barbell', 'intermediate', 2, '{hypertrophy}', '{side_delts}'),
('Cable Upright Row', 'side_delts', '{traps,front_delts}', 'vertical_pull', 'cable', 'intermediate', 2, '{hypertrophy}', '{side_delts}'),
('Lu Raise', 'side_delts', '{front_delts}', 'isolation', 'dumbbell', 'intermediate', 2, '{hypertrophy,aesthetic_priority}', '{side_delts,v_taper}')
ON CONFLICT (name) DO NOTHING;

-- REAR DELTS (primary_muscle: 'rear_delts')
INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets) VALUES
('Dumbbell Reverse Fly', 'rear_delts', '{traps}', 'isolation', 'dumbbell', 'beginner', 1, '{hypertrophy,aesthetic_priority}', '{rear_delts}'),
('Cable Reverse Fly', 'rear_delts', '{traps}', 'isolation', 'cable', 'beginner', 1, '{hypertrophy}', '{rear_delts}'),
('Machine Reverse Fly', 'rear_delts', '{traps}', 'isolation', 'machine', 'beginner', 1, '{hypertrophy}', '{rear_delts}'),
('Bent-Over Dumbbell Reverse Fly', 'rear_delts', '{traps}', 'isolation', 'dumbbell', 'beginner', 1, '{hypertrophy}', '{rear_delts}'),
('Band Pull-Apart', 'rear_delts', '{traps}', 'isolation', 'band', 'beginner', 1, '{hypertrophy}', '{rear_delts}')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- BICEPS (primary_muscle: 'biceps')
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets) VALUES
('Barbell Curl', 'biceps', '{forearms}', 'isolation_pull', 'barbell', 'beginner', 2, '{hypertrophy}', '{arms}'),
('EZ-Bar Curl', 'biceps', '{forearms}', 'isolation_pull', 'barbell', 'beginner', 2, '{hypertrophy}', '{arms}'),
('Dumbbell Curl', 'biceps', '{forearms}', 'isolation_pull', 'dumbbell', 'beginner', 2, '{hypertrophy}', '{arms}'),
('Dumbbell Alternating Curl', 'biceps', '{forearms}', 'isolation_pull', 'dumbbell', 'beginner', 2, '{hypertrophy}', '{arms}'),
('Hammer Curl', 'biceps', '{forearms}', 'isolation_pull', 'dumbbell', 'beginner', 2, '{hypertrophy}', '{arms}'),
('Incline Dumbbell Curl', 'biceps', '{forearms}', 'isolation_pull', 'dumbbell', 'intermediate', 2, '{hypertrophy,aesthetic_priority}', '{arms}'),
('Preacher Curl (Barbell)', 'biceps', '{}', 'isolation_pull', 'barbell', 'intermediate', 2, '{hypertrophy}', '{arms}'),
('Preacher Curl (Dumbbell)', 'biceps', '{}', 'isolation_pull', 'dumbbell', 'intermediate', 2, '{hypertrophy}', '{arms}'),
('Concentration Curl', 'biceps', '{}', 'isolation_pull', 'dumbbell', 'beginner', 1, '{hypertrophy}', '{arms}'),
('Cable Curl', 'biceps', '{forearms}', 'isolation_pull', 'cable', 'beginner', 2, '{hypertrophy}', '{arms}'),
('Cable Hammer Curl (Rope)', 'biceps', '{forearms}', 'isolation_pull', 'cable', 'beginner', 2, '{hypertrophy}', '{arms}'),
('Spider Curl', 'biceps', '{}', 'isolation_pull', 'dumbbell', 'intermediate', 2, '{hypertrophy,aesthetic_priority}', '{arms}'),
('Machine Curl', 'biceps', '{}', 'isolation_pull', 'machine', 'beginner', 2, '{hypertrophy}', '{arms}'),
('Bayesian Cable Curl', 'biceps', '{}', 'isolation_pull', 'cable', 'intermediate', 2, '{hypertrophy,aesthetic_priority}', '{arms}'),
('Drag Curl', 'biceps', '{}', 'isolation_pull', 'barbell', 'intermediate', 2, '{hypertrophy}', '{arms}'),
('Zottman Curl', 'biceps', '{forearms}', 'isolation_pull', 'dumbbell', 'intermediate', 2, '{hypertrophy}', '{arms,forearms}'),
('21s (Bicep Curl)', 'biceps', '{forearms}', 'isolation_pull', 'barbell', 'intermediate', 3, '{hypertrophy}', '{arms}')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- TRICEPS (primary_muscle: 'triceps')
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets) VALUES
('Tricep Pushdown', 'triceps', '{}', 'isolation_push', 'cable', 'beginner', 2, '{hypertrophy}', '{arms}'),
('Tricep Rope Pushdown', 'triceps', '{}', 'isolation_push', 'cable', 'beginner', 2, '{hypertrophy}', '{arms}'),
('Overhead Tricep Extension (Cable)', 'triceps', '{}', 'isolation_push', 'cable', 'intermediate', 2, '{hypertrophy,aesthetic_priority}', '{arms}'),
('Overhead Tricep Extension (Dumbbell)', 'triceps', '{}', 'isolation_push', 'dumbbell', 'intermediate', 2, '{hypertrophy}', '{arms}'),
('Skull Crushers', 'triceps', '{}', 'isolation_push', 'barbell', 'intermediate', 2, '{hypertrophy}', '{arms}'),
('Skull Crushers (Dumbbell)', 'triceps', '{}', 'isolation_push', 'dumbbell', 'intermediate', 2, '{hypertrophy}', '{arms}'),
('Tricep Kickbacks', 'triceps', '{}', 'isolation_push', 'dumbbell', 'beginner', 1, '{hypertrophy}', '{arms}'),
('Cable Kickbacks', 'triceps', '{}', 'isolation_push', 'cable', 'beginner', 1, '{hypertrophy}', '{arms}'),
('Single-Arm Tricep Pushdown', 'triceps', '{}', 'isolation_push', 'cable', 'beginner', 1, '{hypertrophy}', '{arms}'),
('EZ-Bar Skull Crusher', 'triceps', '{}', 'isolation_push', 'barbell', 'intermediate', 2, '{hypertrophy}', '{arms}'),
('Machine Tricep Extension', 'triceps', '{}', 'isolation_push', 'machine', 'beginner', 2, '{hypertrophy}', '{arms}'),
('Bench Dips', 'triceps', '{chest,front_delts}', 'horizontal_push', 'bodyweight', 'beginner', 2, '{hypertrophy}', '{arms}'),
('Tricep Dips (Weighted)', 'triceps', '{chest,front_delts}', 'horizontal_push', 'bodyweight', 'advanced', 3, '{strength,hypertrophy}', '{arms}'),
('Diamond Push-Ups (Tricep Focus)', 'triceps', '{chest}', 'horizontal_push', 'bodyweight', 'intermediate', 2, '{hypertrophy}', '{arms}'),
('JM Press', 'triceps', '{chest}', 'horizontal_push', 'barbell', 'advanced', 3, '{strength}', '{arms}')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- FOREARMS (primary_muscle: 'forearms')
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets) VALUES
('Wrist Curl (Barbell)', 'forearms', '{}', 'isolation', 'barbell', 'beginner', 1, '{hypertrophy}', '{forearms}'),
('Reverse Wrist Curl', 'forearms', '{}', 'isolation', 'barbell', 'beginner', 1, '{hypertrophy}', '{forearms}'),
('Wrist Curl (Dumbbell)', 'forearms', '{}', 'isolation', 'dumbbell', 'beginner', 1, '{hypertrophy}', '{forearms}'),
('Reverse Curl (Barbell)', 'forearms', '{biceps}', 'isolation_pull', 'barbell', 'beginner', 2, '{hypertrophy}', '{forearms}'),
('Reverse Curl (Dumbbell)', 'forearms', '{biceps}', 'isolation_pull', 'dumbbell', 'beginner', 1, '{hypertrophy}', '{forearms}'),
('Dead Hang', 'forearms', '{lats}', 'isolation', 'bodyweight', 'beginner', 1, '{strength}', '{forearms}'),
('Plate Pinch', 'forearms', '{}', 'isolation', 'barbell', 'intermediate', 1, '{strength}', '{forearms}'),
('Farmer''s Carry', 'forearms', '{traps,abs}', 'isolation', 'dumbbell', 'intermediate', 3, '{strength}', '{forearms,traps}')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- QUADRICEPS (primary_muscle: 'quads')
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets, is_big_three, big_three_type) VALUES
('Barbell Back Squat', 'quads', '{glutes,hamstrings,abs}', 'squat', 'barbell', 'intermediate', 5, '{strength,hypertrophy,compound}', '{quads}', true, 'squat'),
('Front Squat', 'quads', '{glutes,abs}', 'squat', 'barbell', 'advanced', 5, '{strength,hypertrophy,compound}', '{quads}', false, NULL),
('Goblet Squat', 'quads', '{glutes}', 'squat', 'dumbbell', 'beginner', 3, '{hypertrophy}', '{quads}', false, NULL),
('Leg Press', 'quads', '{glutes,hamstrings}', 'squat', 'machine', 'beginner', 4, '{hypertrophy,compound}', '{quads}', false, NULL),
('Hack Squat', 'quads', '{glutes}', 'squat', 'machine', 'intermediate', 4, '{hypertrophy}', '{quads}', false, NULL),
('Smith Machine Squat', 'quads', '{glutes}', 'squat', 'machine', 'beginner', 4, '{hypertrophy}', '{quads}', false, NULL),
('V-Squat', 'quads', '{glutes}', 'squat', 'machine', 'intermediate', 4, '{hypertrophy}', '{quads}', false, NULL),
('Leg Extension', 'quads', '{}', 'isolation', 'machine', 'beginner', 2, '{hypertrophy}', '{quads}', false, NULL),
('Bulgarian Split Squat', 'quads', '{glutes,hamstrings}', 'lunge', 'dumbbell', 'intermediate', 3, '{hypertrophy}', '{quads,glutes}', false, NULL),
('Walking Lunges', 'quads', '{glutes,hamstrings}', 'lunge', 'dumbbell', 'beginner', 3, '{hypertrophy}', '{quads,glutes}', false, NULL),
('Reverse Lunges', 'quads', '{glutes,hamstrings}', 'lunge', 'dumbbell', 'beginner', 3, '{hypertrophy}', '{quads,glutes}', false, NULL),
('Barbell Lunges', 'quads', '{glutes,hamstrings}', 'lunge', 'barbell', 'intermediate', 3, '{hypertrophy}', '{quads}', false, NULL),
('Step-Ups', 'quads', '{glutes}', 'lunge', 'dumbbell', 'beginner', 2, '{hypertrophy}', '{quads,glutes}', false, NULL),
('Sissy Squat', 'quads', '{}', 'squat', 'bodyweight', 'advanced', 2, '{hypertrophy}', '{quads}', false, NULL),
('Pistol Squat', 'quads', '{glutes}', 'squat', 'bodyweight', 'advanced', 3, '{strength}', '{quads}', false, NULL),
('Wall Sit', 'quads', '{}', 'squat', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{quads}', false, NULL),
('Bodyweight Squat', 'quads', '{glutes}', 'squat', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{quads}', false, NULL),
('Jump Squat', 'quads', '{glutes,calves}', 'squat', 'bodyweight', 'intermediate', 3, '{strength}', '{quads}', false, NULL),
('Pendulum Squat', 'quads', '{glutes}', 'squat', 'machine', 'intermediate', 3, '{hypertrophy}', '{quads}', false, NULL)
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- HAMSTRINGS (primary_muscle: 'hamstrings')
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets) VALUES
('Romanian Deadlift', 'hamstrings', '{glutes,lats}', 'hip_hinge', 'barbell', 'intermediate', 4, '{strength,hypertrophy,compound}', '{hamstrings}'),
('Dumbbell Romanian Deadlift', 'hamstrings', '{glutes}', 'hip_hinge', 'dumbbell', 'beginner', 3, '{hypertrophy}', '{hamstrings}'),
('Single-Leg Romanian Deadlift', 'hamstrings', '{glutes}', 'hip_hinge', 'dumbbell', 'intermediate', 2, '{hypertrophy}', '{hamstrings}'),
('Stiff-Leg Deadlift', 'hamstrings', '{glutes,lats}', 'hip_hinge', 'barbell', 'intermediate', 4, '{hypertrophy}', '{hamstrings}'),
('Lying Leg Curl', 'hamstrings', '{}', 'isolation', 'machine', 'beginner', 2, '{hypertrophy}', '{hamstrings}'),
('Seated Leg Curl', 'hamstrings', '{}', 'isolation', 'machine', 'beginner', 2, '{hypertrophy}', '{hamstrings}'),
('Leg Curl (Standing)', 'hamstrings', '{}', 'isolation', 'machine', 'beginner', 2, '{hypertrophy}', '{hamstrings}'),
('Nordic Hamstring Curl', 'hamstrings', '{}', 'isolation', 'bodyweight', 'advanced', 3, '{strength,hypertrophy}', '{hamstrings}'),
('Good Morning', 'hamstrings', '{glutes,lats}', 'hip_hinge', 'barbell', 'advanced', 4, '{strength}', '{hamstrings}'),
('Glute-Ham Raise', 'hamstrings', '{glutes}', 'hip_hinge', 'bodyweight', 'advanced', 3, '{strength,hypertrophy}', '{hamstrings}'),
('Cable Pull-Through', 'hamstrings', '{glutes}', 'hip_hinge', 'cable', 'beginner', 2, '{hypertrophy}', '{hamstrings,glutes}'),
('Kettlebell Swing', 'hamstrings', '{glutes,abs}', 'hip_hinge', 'kettlebell', 'intermediate', 3, '{strength}', '{hamstrings,glutes}')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- GLUTES (primary_muscle: 'glutes')
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets) VALUES
('Hip Thrust (Barbell)', 'glutes', '{hamstrings}', 'hip_hinge', 'barbell', 'intermediate', 3, '{hypertrophy,aesthetic_priority}', '{glutes}'),
('Hip Thrust (Dumbbell)', 'glutes', '{hamstrings}', 'hip_hinge', 'dumbbell', 'beginner', 2, '{hypertrophy}', '{glutes}'),
('Hip Thrust (Machine)', 'glutes', '{hamstrings}', 'hip_hinge', 'machine', 'beginner', 3, '{hypertrophy}', '{glutes}'),
('Glute Bridge', 'glutes', '{hamstrings}', 'hip_hinge', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{glutes}'),
('Single-Leg Glute Bridge', 'glutes', '{hamstrings}', 'hip_hinge', 'bodyweight', 'intermediate', 2, '{hypertrophy}', '{glutes}'),
('Cable Hip Extension', 'glutes', '{hamstrings}', 'isolation', 'cable', 'beginner', 1, '{hypertrophy}', '{glutes}'),
('Cable Kickback', 'glutes', '{}', 'isolation', 'cable', 'beginner', 1, '{hypertrophy,aesthetic_priority}', '{glutes}'),
('Sumo Deadlift', 'glutes', '{quads,hamstrings,lats}', 'hip_hinge', 'barbell', 'intermediate', 5, '{strength,compound}', '{glutes}'),
('Hip Abduction (Machine)', 'glutes', '{}', 'isolation', 'machine', 'beginner', 1, '{hypertrophy}', '{glutes}'),
('Hip Adduction (Machine)', 'glutes', '{}', 'isolation', 'machine', 'beginner', 1, '{hypertrophy}', '{glutes}'),
('Donkey Kicks', 'glutes', '{}', 'isolation', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{glutes}'),
('Fire Hydrants', 'glutes', '{}', 'isolation', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{glutes}'),
('Frog Pumps', 'glutes', '{}', 'isolation', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{glutes}')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- CALVES (primary_muscle: 'calves')
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets) VALUES
('Standing Calf Raise (Machine)', 'calves', '{}', 'isolation', 'machine', 'beginner', 2, '{hypertrophy}', '{calves}'),
('Seated Calf Raise', 'calves', '{}', 'isolation', 'machine', 'beginner', 2, '{hypertrophy}', '{calves}'),
('Smith Machine Calf Raise', 'calves', '{}', 'isolation', 'machine', 'beginner', 2, '{hypertrophy}', '{calves}'),
('Leg Press Calf Raise', 'calves', '{}', 'isolation', 'machine', 'beginner', 2, '{hypertrophy}', '{calves}'),
('Dumbbell Calf Raise', 'calves', '{}', 'isolation', 'dumbbell', 'beginner', 1, '{hypertrophy}', '{calves}'),
('Bodyweight Calf Raise', 'calves', '{}', 'isolation', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{calves}'),
('Single-Leg Calf Raise', 'calves', '{}', 'isolation', 'bodyweight', 'intermediate', 2, '{hypertrophy}', '{calves}'),
('Tibialis Raise', 'calves', '{}', 'isolation', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{calves}')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- DEADLIFT VARIATIONS (primary_muscle varies)
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets, is_big_three, big_three_type) VALUES
('Barbell Deadlift', 'hamstrings', '{glutes,lats,traps,forearms,quads}', 'hip_hinge', 'barbell', 'intermediate', 5, '{strength,compound}', '{}', true, 'deadlift'),
('Trap Bar Deadlift', 'quads', '{glutes,hamstrings,traps}', 'hip_hinge', 'barbell', 'intermediate', 5, '{strength,compound}', '{}', false, NULL),
('Deficit Deadlift', 'hamstrings', '{glutes,lats,traps}', 'hip_hinge', 'barbell', 'advanced', 5, '{strength}', '{}', false, NULL),
('Rack Pull', 'hamstrings', '{glutes,lats,traps,forearms}', 'hip_hinge', 'barbell', 'intermediate', 4, '{strength}', '{}', false, NULL),
('Snatch-Grip Deadlift', 'hamstrings', '{glutes,lats,traps}', 'hip_hinge', 'barbell', 'advanced', 5, '{strength}', '{}', false, NULL),
('Block Pull', 'hamstrings', '{glutes,traps}', 'hip_hinge', 'barbell', 'intermediate', 4, '{strength}', '{}', false, NULL),
('Dumbbell Deadlift', 'hamstrings', '{glutes,quads}', 'hip_hinge', 'dumbbell', 'beginner', 3, '{hypertrophy}', '{}', false, NULL)
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- CORE / ABS (primary_muscle: 'abs')
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags, aesthetic_targets) VALUES
('Hanging Leg Raise', 'abs', '{}', 'core', 'bodyweight', 'intermediate', 2, '{hypertrophy}', '{abs}'),
('Hanging Knee Raise', 'abs', '{}', 'core', 'bodyweight', 'beginner', 2, '{hypertrophy}', '{abs}'),
('Cable Crunch', 'abs', '{}', 'core', 'cable', 'beginner', 2, '{hypertrophy}', '{abs}'),
('Plank', 'abs', '{}', 'core', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{abs}'),
('Side Plank', 'abs', '{}', 'core', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{abs}'),
('Ab Wheel Rollout', 'abs', '{}', 'core', 'bodyweight', 'intermediate', 2, '{hypertrophy}', '{abs}'),
('Crunches', 'abs', '{}', 'core', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{abs}'),
('Bicycle Crunches', 'abs', '{}', 'core', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{abs}'),
('Russian Twist', 'abs', '{}', 'core', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{abs}'),
('Russian Twist (Weighted)', 'abs', '{}', 'core', 'dumbbell', 'intermediate', 2, '{hypertrophy}', '{abs}'),
('Mountain Climbers', 'abs', '{}', 'core', 'bodyweight', 'beginner', 2, '{hypertrophy}', '{abs}'),
('Dead Bug', 'abs', '{}', 'core', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{abs}'),
('Pallof Press', 'abs', '{}', 'core', 'cable', 'intermediate', 1, '{hypertrophy}', '{abs}'),
('Decline Sit-Up', 'abs', '{}', 'core', 'bodyweight', 'intermediate', 2, '{hypertrophy}', '{abs}'),
('V-Up', 'abs', '{}', 'core', 'bodyweight', 'intermediate', 2, '{hypertrophy}', '{abs}'),
('Toe Touch', 'abs', '{}', 'core', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{abs}'),
('Flutter Kicks', 'abs', '{}', 'core', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{abs}'),
('Leg Raises (Lying)', 'abs', '{}', 'core', 'bodyweight', 'beginner', 1, '{hypertrophy}', '{abs}'),
('L-Sit', 'abs', '{}', 'core', 'bodyweight', 'advanced', 2, '{strength}', '{abs}'),
('Dragon Flag', 'abs', '{}', 'core', 'bodyweight', 'advanced', 3, '{strength}', '{abs}'),
('Woodchop (Cable)', 'abs', '{}', 'core', 'cable', 'intermediate', 2, '{hypertrophy}', '{abs}'),
('Machine Crunch', 'abs', '{}', 'core', 'machine', 'beginner', 2, '{hypertrophy}', '{abs}')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- CARDIO (primary_muscle: 'cardio')
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating) VALUES
-- Already seeded but including here with ON CONFLICT for completeness
('Walking', 'cardio', '{}', 'cardio', 'bodyweight', 'beginner', 1),
('Running', 'cardio', '{}', 'cardio', 'bodyweight', 'intermediate', 3),
('Treadmill (Incline Walk)', 'cardio', '{}', 'cardio', 'cardio_machine', 'beginner', 2),
('Stairmaster', 'cardio', '{}', 'cardio', 'cardio_machine', 'intermediate', 3),
('Stationary Bike', 'cardio', '{}', 'cardio', 'cardio_machine', 'beginner', 2),
('Elliptical', 'cardio', '{}', 'cardio', 'cardio_machine', 'beginner', 2),
('Jump Rope', 'cardio', '{}', 'cardio', 'bodyweight', 'intermediate', 3),
('Rowing Machine', 'cardio', '{}', 'cardio', 'cardio_machine', 'intermediate', 3),
('Swimming', 'cardio', '{}', 'cardio', 'bodyweight', 'intermediate', 3),
-- NEW CARDIO
('Sprints', 'cardio', '{}', 'cardio', 'bodyweight', 'advanced', 4),
('Hill Sprints', 'cardio', '{}', 'cardio', 'bodyweight', 'advanced', 5),
('Battle Ropes', 'cardio', '{forearms}', 'cardio', 'bodyweight', 'intermediate', 3),
('Box Jumps', 'cardio', '{quads,glutes,calves}', 'cardio', 'bodyweight', 'intermediate', 3),
('Burpees', 'cardio', '{chest,quads}', 'cardio', 'bodyweight', 'intermediate', 4),
('Assault Bike', 'cardio', '{}', 'cardio', 'cardio_machine', 'intermediate', 4),
('Ski Erg', 'cardio', '{lats}', 'cardio', 'cardio_machine', 'intermediate', 3),
('Cycling (Outdoor)', 'cardio', '{}', 'cardio', 'bodyweight', 'beginner', 2),
('Hiking', 'cardio', '{}', 'cardio', 'bodyweight', 'beginner', 2),
('Sled Push', 'cardio', '{quads,glutes}', 'cardio', 'machine', 'intermediate', 4),
('Sled Pull', 'cardio', '{lats,hamstrings}', 'cardio', 'machine', 'intermediate', 4),
('Treadmill Running', 'cardio', '{}', 'cardio', 'cardio_machine', 'beginner', 3),
('Jumping Jacks', 'cardio', '{}', 'cardio', 'bodyweight', 'beginner', 1),
('High Knees', 'cardio', '{}', 'cardio', 'bodyweight', 'beginner', 2),
('Shadow Boxing', 'cardio', '{}', 'cardio', 'bodyweight', 'beginner', 2),
('Kettlebell Snatch', 'cardio', '{front_delts,hamstrings}', 'cardio', 'kettlebell', 'advanced', 4),
('Medicine Ball Slams', 'cardio', '{abs,lats}', 'cardio', 'bodyweight', 'intermediate', 3),
('Treadmill Sprint Intervals', 'cardio', '{}', 'cardio', 'cardio_machine', 'advanced', 4)
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- STRETCHING / MOBILITY (primary_muscle: varies)
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, fatigue_rating, goal_tags) VALUES
('Foam Rolling (Full Body)', 'abs', '{}', 'core', 'bodyweight', 'beginner', 0, '{recovery}'),
('Hip Flexor Stretch', 'quads', '{}', 'core', 'bodyweight', 'beginner', 0, '{recovery}'),
('Hamstring Stretch', 'hamstrings', '{}', 'core', 'bodyweight', 'beginner', 0, '{recovery}'),
('Chest Doorway Stretch', 'chest', '{}', 'core', 'bodyweight', 'beginner', 0, '{recovery}'),
('Cat-Cow Stretch', 'abs', '{}', 'core', 'bodyweight', 'beginner', 0, '{recovery}'),
('Child''s Pose', 'lats', '{}', 'core', 'bodyweight', 'beginner', 0, '{recovery}'),
('Pigeon Stretch', 'glutes', '{}', 'core', 'bodyweight', 'beginner', 0, '{recovery}'),
('Shoulder Dislocates', 'front_delts', '{rear_delts}', 'core', 'band', 'beginner', 0, '{recovery}')
ON CONFLICT (name) DO NOTHING;
