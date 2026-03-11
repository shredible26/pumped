-- 011_set_logs_actual_seconds.sql
-- Optional seconds for time-based exercises (planks, deadhangs, etc.)

ALTER TABLE public.set_logs
  ADD COLUMN IF NOT EXISTS actual_seconds INTEGER;
