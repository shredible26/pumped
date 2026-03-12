# PUMPED — AI Workout Generation Integration
## Cursor Prompt — Reference for Agents

---

This document describes the AI workout generation flow and how it integrates with the rest of the app. Reference @docs/pumped-technical-spec-v2.md for database schemas and theme tokens, and @docs/pumped-muscle-readiness-model.md for the science-based fatigue model.

## CURRENT IMPLEMENTATION (handoff reference)

### Muscle Readiness (fatigue input to AI)
- The AI receives a **fatigueMap** built from the **strain-based recovery model** (see `docs/pumped-muscle-readiness-model.md`).
- Data comes from `muscle_strain_log` and `utils/recoveryModel.ts` (`calculateCumulativeReadiness`, etc.). The frontend calls `getBodyMapReadiness(userId, date)` in `services/fatigue.ts` and passes the result as `fatigueMap` to the edge function.
- Each muscle has `recovery_pct` (0–100, null = no data), `last_trained_at`, and optionally `last_strain_score`. The AI is instructed to avoid primary targeting of muscles below 30% recovery, use moderate volume for 30–60%, and full programming above 60%.

### What the client sends to the edge function
- **profile**: `program_style`, `experience_level`, `equipment_access`, `training_frequency`, `weight_lbs`, **`gender`** (`'male' | 'female'` from onboarding; used for suggested weights and exercise selection).
- **fatigueMap**: Per-muscle readiness from the strain-based model (see above).
- **recentHistory**: Last 7–14 days of completed sessions (date, name, total_volume).
- **exercises**: Filtered by equipment; each has `id`, `name`, `primary_muscle`, `equipment`, `difficulty`.
- **modifications**: Optional user text (injuries, time limits, etc.).

The edge function computes **today's scheduled type** from `program_style` and `training_frequency` (same logic as `utils/schedule.ts`): Push/Pull/Legs for PPL, Upper/Lower for upper_lower, rest on non–workout days, and "ai_decides" for aesthetic/ai_optimal. All generations use this type, user stats, fatigue, history, and modifications.

### Gender in AI generation
- Onboarding "About You" collects **Gender** as **Male** or **Female** only (no "Other").
- The edge function receives `profile.gender` and instructs the model to suggest higher loads for males and appropriate loads/exercise choices for females (e.g. progressions, alternatives) without reducing volume. As the user logs more workouts, the AI should rely more on actual history than gender defaults.

### Active Recovery (rest) days
- When **today** is a scheduled rest/active recovery day, the Today tab shows an "Active Recovery" card with:
  - **Generate with customizations** — opens the modifications screen for a cardio/recovery-style AI workout.
  - **Speed Log** — log any workout (including cardio) manually.
- There is **no** "Log Cardio" or "Log Rest Day" button; cardio is logged via Speed Log.

### Cost and safeguards
- NEVER call the AI API in a loop, useEffect, or on screen mount.
- ONLY call when the user explicitly taps "Generate Workout" or "Generate without modifications" (or "Generate with customizations" on rest day).
- Cache plans in `ai_workout_plans`; show cached plan when available.
- Loading state prevents double-tap. Preview screen uses **"Customize"** (not "Regenerate") with a credit warning.
- Model: `claude-sonnet-4-20250514`; `max_tokens` is set in the edge function (e.g. 2800).

---

## STEP 1: Supabase Edge Function

Create a new Edge Function. In the terminal, run:
```bash
npx supabase functions new generate-workout
```

Then replace the contents of `supabase/functions/generate-workout/index.ts` with:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { profile, fatigueMap, recentHistory, exercises, modifications } = await req.json();

    // Determine today's workout type based on program rotation (only 4 styles: ppl, upper_lower, aesthetic, ai_optimal)
    const programRotations: Record<string, string[]> = {
      ppl: ["push", "pull", "legs", "push", "pull", "legs", "rest"],
      upper_lower: ["upper", "lower", "rest", "upper", "lower", "rest", "rest"],
      aesthetic: [],  // AI decides
      ai_optimal: [], // AI decides
    };

    const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon, ...
    const rotation = programRotations[profile.program_style] || [];
    const todayType = rotation.length > 0 ? rotation[dayOfWeek] : "ai_decides";

    // Build the system prompt
    const systemPrompt = `You are the workout AI for a fitness app called Pumped. You generate personalized workout sessions based on exercise science principles.

STRICT RULES:
1. Select exercises ONLY from the provided exercise list (use exact exercise IDs and names).
2. Generate between 4-7 exercises per workout.
3. Each exercise should have 3-5 sets.
4. NEVER target a muscle group that has recovery below 30% as a PRIMARY target. You can include it as a secondary muscle if recovery is above 20%.
5. Apply progressive overload: if the user performed this exercise recently, suggest slightly higher weight or reps.
6. For EVERY exercise, write a "why" field (2-3 sentences) explaining why this specific exercise was chosen, referencing the user's recovery state, program style, and goals.
7. Estimate total workout duration in minutes.
8. If the user provided modifications (like injuries, time constraints, equipment limitations), respect them completely.
9. Return ONLY valid JSON — no markdown, no backticks, no commentary before or after the JSON.

JSON FORMAT (return exactly this structure):
{
  "name": "Push Day",
  "type": "push",
  "estimated_minutes": 50,
  "exercises": [
    {
      "exercise_id": "uuid-from-database",
      "name": "Exercise Name",
      "sets": 4,
      "target_reps": "8-10",
      "target_weight_lbs": 135,
      "rest_seconds": 120,
      "order": 1,
      "primary_muscle": "chest",
      "why": "Your chest is 85% recovered and ready for heavy compound work. Bench press is the foundational horizontal push and your last session was 130lbs x 10 — we're progressing to 135lbs."
    }
  ]
}`;

    // Build the user prompt with all context
    let userPrompt = `Generate today's workout for this user.

USER PROFILE:
- Program style: ${profile.program_style}
- Experience level: ${profile.experience_level || "intermediate"}
- Equipment: ${profile.equipment_access || "full_gym"}
- Training frequency: ${profile.training_frequency || 4} days/week
- Weight: ${profile.weight_lbs || "unknown"} lbs

TODAY'S SCHEDULED TYPE: ${todayType === "rest" ? "This is a scheduled rest day, but the user wants to train anyway. Suggest a light recovery or accessory workout." : todayType === "ai_decides" ? "You decide the best workout type based on the fatigue data below." : todayType}

MUSCLE FATIGUE (recovery percentage, 100% = fully recovered, 0% = just trained):
${Object.entries(fatigueMap || {}).map(([muscle, data]: [string, any]) =>
  `- ${muscle}: ${data.recovery_pct ?? "no data"}% recovered (last trained: ${data.last_trained_at || "never"})`
).join("\n")}

RECENT WORKOUT HISTORY (last 7 days):
${(recentHistory || []).map((w: any) => `- ${w.date}: ${w.name} (${w.total_volume} lbs volume)`).join("\n") || "No recent workouts"}

AVAILABLE EXERCISES (use ONLY these — use exact IDs):
${(exercises || []).map((e: any) => `- ID: ${e.id} | ${e.name} | Primary: ${e.primary_muscle} | Equipment: ${e.equipment} | Difficulty: ${e.difficulty}`).join("\n")}`;

    if (modifications && modifications.trim()) {
      userPrompt += `\n\nUSER MODIFICATIONS FOR TODAY:\n${modifications}\nRespect these modifications completely.`;
    }

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI generation failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const aiText = data.content[0].text;

    // Parse the JSON response — handle potential markdown wrapping
    let workoutPlan;
    try {
      const cleaned = aiText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      workoutPlan = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiText);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: aiText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(workoutPlan),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

After creating the function, deploy it:
```bash
npx supabase functions deploy generate-workout --no-verify-jwt
```

Then set the secret API key (this goes in Supabase's secure environment, NOT in the app).
**Do not paste your real key into any file committed to git.** Run this in your terminal only:
```bash
npx supabase secrets set ANTHROPIC_API_KEY=<paste-your-key-here>
```
Or set it in the Supabase Dashboard → Project Settings → Edge Functions → Secrets.

---

## STEP 2: Frontend Service for AI Generation

Create or update `services/ai.ts`:

```typescript
import { supabase } from "./supabase";

interface GenerateWorkoutParams {
  profile: any;
  fatigueMap: Record<string, any>;
  recentHistory: any[];
  exercises: any[];
  modifications?: string;
}

interface GeneratedExercise {
  exercise_id: string;
  name: string;
  sets: number;
  target_reps: string;
  target_weight_lbs: number;
  rest_seconds: number;
  order: number;
  primary_muscle: string;
  why: string;
}

interface GeneratedWorkout {
  name: string;
  type: string;
  estimated_minutes: number;
  exercises: GeneratedExercise[];
}

export async function generateWorkout(params: GenerateWorkoutParams): Promise<GeneratedWorkout> {
  const { data, error } = await supabase.functions.invoke("generate-workout", {
    body: params,
  });

  if (error) {
    throw new Error(`Failed to generate workout: ${error.message}`);
  }

  if (data.error) {
    throw new Error(`AI error: ${data.error}`);
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
    .single();

  if (error || !data) return null;

  return {
    name: data.workout_name,
    type: data.workout_type,
    estimated_minutes: data.exercises?.estimated_minutes || 50,
    exercises: data.exercises?.exercises || data.exercises,
  };
}

// Save generated plan to cache
export async function savePlanToCache(
  userId: string,
  plan: GeneratedWorkout
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  await supabase.from("ai_workout_plans").upsert({
    user_id: userId,
    plan_date: today,
    workout_name: plan.name,
    workout_type: plan.type,
    exercises: plan,
    generated_at: new Date().toISOString(),
  }, { onConflict: "user_id,plan_date" });
}
```

---

## STEP 3: Update the Home Screen — "Generate Workout" Button

On the Today screen, change the workout card:
- Replace "Start Workout" button text with **"Generate Workout"** (green, with a sparkle/AI icon)
- Keep the **"Speed Log"** button below it (secondary style, lightning bolt icon)
- Below the workout type label (e.g., "Push"), show the program name with AI mention: "Push/Pull/Legs · AI Enhanced"
- If a workout has already been generated today (cached), change the button to **"View Workout"** instead and show a small "Generated" badge on the card

When "Generate Workout" is tapped:
1. First check the cache (ai_workout_plans table) for today's plan
2. If cached plan exists, navigate directly to the workout preview screen showing the cached plan
3. If no cached plan, navigate to the Modifications Screen (Step 4)

---

## STEP 4: Build the Modifications Screen

Create a new screen at `app/workout/modifications.tsx`

Layout:
- Header: "Customize Workout" with X close button
- Back link in green: "< Back"
- Card with green-tinted background:
  - Sparkle/AI icon + "Any modifications for today?" title (bold, white)
  - Subtitle: "Describe any adjustments and AI will adapt your workout." (gray)
  - Multi-line text input (3-4 lines tall) with placeholder: "e.g. No exercises that strain my wrist, keep it under 30 minutes, focus on shoulders..."
  - Green send button inside the text input (only visible when text is entered)
- Below the text input, show quick suggestion pills that the user can tap to auto-fill:
  - "Quick workout (30 min)"
  - "No lower back exercises"
  - "Upper body focus"
  - "Light recovery day"
  - "Extra volume today"
  - "No barbell exercises"
  - Tapping a pill appends that text to the input field
- **[Generate Workout]** button — full width, green, with AI sparkle icon
  - This button should be prominently visible when the user has typed modifications
  - When tapped: show loading spinner, call the AI, navigate to preview on success
- **[Generate without modifications]** button — below, secondary style (dark with border)
  - Visible at all times
  - When tapped: same flow but with empty modifications string

### Loading State
When either generate button is tapped:
- Disable both buttons
- Show a loading overlay or replace button text with "Generating your workout..." with a spinner
- The generation takes 3-8 seconds typically
- On success: save the plan to cache, navigate to workout preview
- On error: show an alert "Workout generation failed. Please try again." and re-enable buttons

---

## STEP 5: Update Workout Preview Screen

Update `app/workout/preview.tsx` to display the AI-generated workout:

Layout:
- Header: "Today's Workout" with back button
- Workout name (e.g., "Push Day") — large, bold (24pt)
- Tags row: exercise count pill, duration pill, program type pill (colored by program)
- Estimated duration: "~50 min" 

For each exercise, show an ExerciseCard:
- Left side: number badge (1, 2, 3...) in a green circle
- Exercise name (16pt, bold)
- Stats: "4 sets · 8-10 reps · 135 lbs" 
- Small labels: primary muscle + equipment (gray text)
- Right side: **[Why?]** button (green background pill, small)

When [Why?] is tapped, open a bottom sheet:
- "WHY THIS EXERCISE?" label in green uppercase
- Exercise name (20pt, bold)
- The "why" text from the AI response (15pt, gray, good line height)
- Tags: muscle, equipment, sets x reps
- [Got it] dismiss button

At the bottom of the screen, two buttons:
- **[Log This Workout]** — large, green, full width
  - Navigates to a logging screen where the user can enter actual weights and reps for each exercise
- **[Regenerate]** — small text link below: "Not what you want? Regenerate (uses a credit)"
  - Shows a confirmation alert before regenerating: "This will generate a new workout and use an API credit. Continue?"

---

## STEP 6: Workout Logging Screen (after AI preview)

Create or update a screen for logging the generated workout. This is similar to the Speed Log editor but pre-filled with the AI's exercises.

Layout:
- Header: "Log Workout" with back button
- Workout name as title
- Duration field (editable, pre-filled from AI estimate)
- Exercise cards (pre-filled from the AI plan):
  - Exercise name (bold) with X to remove
  - Set pills in a row showing "135 x 8" format (pre-filled from AI targets)
  - Each pill is tappable — tap to expand inline and edit weight (lbs) and reps, with an [OK] button
  - [+] button to add more sets
  - Swipe left or tap [-] to remove a set
- [+ Add Exercise] button to add exercises not in the AI plan
- Footer: fixed summary "5 exercises · 18 sets · ~12.5k lbs"
- **[Complete Workout]** button — green, full width

When [Complete Workout] is tapped:
1. Save all set_logs to Supabase
2. Create a workout_session record
3. Update muscle_fatigue for all trained muscles
4. Check for PRs (new e1RM records)
5. Update streak
6. Navigate to the "Save This Workout?" modal

### Save Workout Modal
- Bookmark icon in green circle
- "Save This Workout?" title
- "Reuse it next time" subtitle
- List of exercises with set counts
- Name input: "Name this workout (e.g., My Push Day)"
- [Save Workout] green button — saves to saved_workouts table
- [Skip] text button — goes to workout summary

Then navigate to the existing workout summary screen with stats, PR detection, etc.

---

## STEP 7: Update Onboarding Split Options

In the onboarding screen where the user selects their program style, update the 4 options to show these exact labels and descriptions:

1. **Push/Pull/Legs**
   - Description: "Classic 6-day split with AI-generated workouts"
   - Color: purple (#8B5CF6)

2. **Upper/Lower**
   - Description: "4-day split with AI-powered exercise selection"  
   - Color: blue (#3B82F6)

3. **Aesthetic**
   - Description: "Optimized with AI for aesthetics and proportions"
   - Color: pink (#EC4899)

4. **AI Optimal**
   - Description: "Fully balanced and optimized by AI, hitting every muscle group"
   - Color: green (#4ADE80)

Store these as: 'ppl', 'upper_lower', 'aesthetic', 'ai_optimal' in the profile.program_style field.

Note: update the CHECK constraint on the profiles table if needed:
```sql
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_program_style_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_program_style_check 
  CHECK (program_style IN ('ppl', 'upper_lower', 'aesthetic', 'ai_optimal'));
```

---

## STEP 8: Data Flow Summary

Here's how data flows through the AI generation:

1. User taps "Generate Workout" on home screen
2. App checks ai_workout_plans cache for today → if found, show cached plan
3. If not cached, navigate to modifications screen
4. User optionally types modifications, taps generate
5. App gathers: profile data, fatigue map, recent 7-day history, exercise database, modifications text
6. App calls `supabase.functions.invoke("generate-workout", { body: allData })`
7. Edge function constructs Claude prompt with all context
8. Claude returns structured JSON workout plan
9. App saves plan to ai_workout_plans cache
10. App shows workout preview with exercises and "Why?" buttons
11. User taps "Log This Workout" and enters actual weights/reps
12. On completion: save set_logs, update fatigue, check PRs, update streak
13. Optionally save as custom workout template

---

## STEP 9: Error Handling & Edge Cases

Handle these cases:
- **No internet**: Show "You need internet to generate a workout. Use Speed Log for offline logging."
- **API error**: Show "Workout generation failed. Try again or use Speed Log."  
- **Empty exercise database**: This shouldn't happen if migrations ran, but show "Exercise database not loaded" if the exercises query returns empty
- **User has no profile data**: Redirect to onboarding
- **Rest day in rotation**: If today is a rest day in the user's program, the card should say "Rest Day" but still show "Generate Workout" with a note: "Want to train anyway? Generate a light recovery workout."

---

## IMPLEMENTATION ORDER

Build in this exact order, testing after each step:
1. Create the Edge Function file and deploy it to Supabase
2. Set the ANTHROPIC_API_KEY secret in Supabase
3. Create/update the ai.ts service with generate, cache, and retrieve functions
4. Update the home screen button from "Start Workout" to "Generate Workout" with cache check
5. Build the modifications screen
6. Update the workout preview screen to show AI-generated exercises with "Why?" buttons
7. Build the workout logging screen (pre-filled from AI plan)
8. Wire up the save workout flow
9. Update the onboarding split options with new labels
10. Test the full flow end-to-end: generate → preview → log → save

After each step, make sure the app compiles and runs. Do NOT proceed to the next step if there are errors.

---

## INTEGRATION NOTES (March 2026 — Agent Handoff)

- **Program styles**: Only four are supported: `ppl`, `upper_lower`, `aesthetic`, `ai_optimal`. No Bro Split or Full Body. See `docs/pumped-technical-spec-v2.md` and migration `008_program_style_four_only.sql`.
- **Session date when saving**: When the client creates a `workout_session` (after logging a workout), the `date` field must be the user's **local calendar date** (e.g. via `getLocalDateString()` from `utils/date.ts`), not UTC. This avoids workouts appearing on the wrong day in Past Workouts and on the calendar. See technical spec §Implementation Status.
- **Muscle readiness**: The AI uses the same strain-based recovery data as the Muscle Readiness diagram. See `services/fatigue.ts` (`getBodyMapReadiness`, `recordWorkoutStrain`) and `docs/pumped-muscle-readiness-model.md`.
- **Gender**: Profile stores `gender` as `'male' | 'female'` (onboarding; no "Other"). The edge function uses it for suggested weights and exercise selection; the more history the user has, the more the AI should rely on actual logged data.
- **Active Rest day UI**: On rest days the Today tab shows only "Generate with customizations" and "Speed Log". There is no "Log Cardio" or "Log Rest Day" button.
- **Split-specific AI**: PPL and Upper/Lower are day-aware (push/pull/legs or upper/lower only). Aesthetic focuses on hypertrophy and proportions; AI Optimal fully optimizes from data. Rest days get simple cardio (basic gym only). See edge function system prompt for SPLIT-SPECIFIC RULES and CARDIO.
- **Display labels**: `getDisplayWorkoutType(programStyle, scheduledType)` in `utils/schedule.ts` returns "Aesthetic Optimal" for aesthetic + AI Workout, "AI Optimal" for ai_optimal + AI Workout; used on Today tab (future days) and RoutineTimeline and Speed Log.
- **Redeploy edge function** after changing the system prompt: `supabase functions deploy generate-workout --no-verify-jwt`
