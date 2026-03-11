import { supabase } from "./supabase";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

interface GenerateWorkoutParams {
  profile: any;
  fatigueMap: Record<string, any>;
  recentHistory: any[];
  exercises: any[];
  modifications?: string;
}

export interface GeneratedExercise {
  exercise_id: string;
  name: string;
  sets: number;
  target_reps: string;
  target_weight_lbs: number;
  /** Optional; for time-based bodyweight (plank, dead hang, etc.) */
  target_seconds?: number;
  rest_seconds: number;
  order: number;
  primary_muscle: string;
  why: string;
}

export interface GeneratedWorkout {
  name: string;
  type: string;
  estimated_minutes: number;
  /** AI reasoning — fatigue-aware explanation */
  description?: string;
  /** Muscle groups trained today */
  primary_targets?: string[];
  exercises: GeneratedExercise[];
}

/**
 * Invoke the Edge Function via fetch so we can capture status + body on failure.
 * supabase.functions.invoke hides the response body when status is non-2xx.
 */
export async function generateWorkout(params: GenerateWorkoutParams): Promise<GeneratedWorkout> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? supabaseAnonKey;

  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/generate-workout`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(params),
  });

  const bodyText = await res.text();
  let bodyJson: any = null;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    // Not JSON — keep as raw text for logging
  }

  if (!res.ok) {
    console.log("[generate-workout] non-2xx response", {
      status: res.status,
      statusText: res.statusText,
      url,
      bodyRaw: bodyText,
      bodyParsed: bodyJson,
    });
    const detail =
      bodyJson?.error ??
      bodyJson?.details ??
      bodyText?.slice(0, 500) ??
      res.statusText;
    throw new Error(
      `Failed to generate workout: ${res.status} ${res.statusText}${detail ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`
    );
  }

  const data = bodyJson ?? (bodyText ? JSON.parse(bodyText) : null);

  if (data?.error) {
    console.log("[generate-workout] 200 with error payload", data);
    throw new Error(`AI error: ${data.error}${data.details ? ` — ${data.details}` : ""}`);
  }

  if (!data || typeof data !== "object" || !Array.isArray((data as GeneratedWorkout).exercises)) {
    console.log("[generate-workout] unexpected success shape", data);
    throw new Error("AI returned an unexpected response shape (missing exercises array).");
  }

  return data as GeneratedWorkout;
}

// Check if we already have a cached plan for today
export async function getTodaysPlan(userId: string): Promise<GeneratedWorkout | null> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from("ai_workout_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_date", today)
    .maybeSingle();

  if (error || !data) return null;

  const stored = data.exercises as any;
  const exercisesArray = Array.isArray(stored) ? stored : (stored?.exercises ?? []);
  const estimated_minutes = stored?.estimated_minutes ?? 50;

  return {
    name: data.workout_name ?? stored?.name,
    type: data.workout_type ?? stored?.type ?? "workout",
    estimated_minutes,
    description: stored?.description,
    primary_targets: Array.isArray(stored?.primary_targets)
      ? stored.primary_targets
      : undefined,
    exercises: exercisesArray,
  };
}

// Save generated plan to cache
export async function savePlanToCache(
  userId: string,
  plan: GeneratedWorkout
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  await supabase.from("ai_workout_plans").upsert(
    {
      user_id: userId,
      plan_date: today,
      workout_name: plan.name,
      workout_type: plan.type,
      exercises: plan,
      generated_at: new Date().toISOString(),
      used: false,
    },
    { onConflict: "user_id,plan_date" }
  );
}
