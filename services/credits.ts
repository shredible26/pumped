import { supabase } from './supabase';
import type { Profile } from '@/types/user';

const DAILY_LIMIT = 2;

function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Ensure profile row has credits reset if new day; return remaining count (0 if none).
 * Does not decrement — call consumeGenerationCredit after successful generation.
 */
export async function getGenerationCreditsRemaining(profile: Profile | null): Promise<number> {
  if (!profile?.id) return 0;
  const today = todayDateString();
  let remaining =
    profile.generation_credits_remaining != null
      ? Number(profile.generation_credits_remaining)
      : DAILY_LIMIT;
  let resetDate = profile.credits_reset_date ?? today;

  if (resetDate < today) {
    remaining = DAILY_LIMIT;
    resetDate = today;
    await supabase
      .from('profiles')
      .update({
        generation_credits_remaining: DAILY_LIMIT,
        credits_reset_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);
  }

  return Math.max(0, remaining);
}

/** After successful AI generation, decrement by 1 */
export async function consumeGenerationCredit(userId: string, currentRemaining: number): Promise<void> {
  const next = Math.max(0, currentRemaining - 1);
  await supabase
    .from('profiles')
    .update({
      generation_credits_remaining: next,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

export { DAILY_LIMIT };
