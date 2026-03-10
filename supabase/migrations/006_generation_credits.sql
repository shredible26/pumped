-- Daily AI generation credits (idempotent if already added manually)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS generation_credits_remaining INTEGER DEFAULT 2;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_reset_date DATE DEFAULT CURRENT_DATE;

-- Backfill existing rows
UPDATE public.profiles
SET
  generation_credits_remaining = COALESCE(generation_credits_remaining, 2),
  credits_reset_date = COALESCE(credits_reset_date, CURRENT_DATE)
WHERE generation_credits_remaining IS NULL OR credits_reset_date IS NULL;
