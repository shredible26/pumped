-- 008_program_style_four_only.sql
-- Restrict program_style to PPL, Upper/Lower, Aesthetic, AI Optimal only.
-- Migrate any existing bro_split/full_body to ppl.

UPDATE public.profiles
SET program_style = 'ppl', updated_at = NOW()
WHERE program_style IN ('bro_split', 'full_body');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_program_style_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_program_style_check
  CHECK (program_style IN ('ppl', 'upper_lower', 'aesthetic', 'ai_optimal'));
