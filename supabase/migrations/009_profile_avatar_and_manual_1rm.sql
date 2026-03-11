-- 009_profile_avatar_and_manual_1rm.sql
-- Add avatar_url, manual 1RM fields, and units preference for Profile tab

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS manual_squat_1rm NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS manual_bench_1rm NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS manual_deadlift_1rm NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS units TEXT DEFAULT 'lbs' CHECK (units IN ('lbs', 'kg'));

-- Create storage bucket for profile avatars (Supabase Dashboard > Storage > New bucket):
-- Name: avatars, Public: true. Add policy: "Users can upload their own avatar"
-- (e.g. (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
