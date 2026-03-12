-- Increase daily AI generation credits: 3 to start, 3 per day max (was 2).
ALTER TABLE public.profiles
  ALTER COLUMN generation_credits_remaining SET DEFAULT 3;

-- Give all users 3 credits remaining; ensure reset date is set for new users
UPDATE public.profiles
SET
  generation_credits_remaining = 3,
  credits_reset_date = COALESCE(credits_reset_date, CURRENT_DATE);
