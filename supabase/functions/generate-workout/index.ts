import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Keep prompt small: only send exercises the user can actually do. */
function filterExercisesByEquipment(
  exercises: any[],
  equipmentAccess: string
): any[] {
  if (!Array.isArray(exercises) || exercises.length === 0) return [];

  const access = (equipmentAccess || "full_gym").toLowerCase();

  if (access === "bodyweight") {
    return exercises.filter((e) => String(e.equipment || "").toLowerCase() === "bodyweight");
  }

  if (access === "home_gym") {
    const allowed = new Set(["barbell", "dumbbell", "bodyweight", "kettlebell", "band"]);
    return exercises.filter((e) => allowed.has(String(e.equipment || "").toLowerCase()));
  }

  const sorted = [...exercises].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
  return sorted.slice(0, 350);
}

function parseWorkoutJson(aiText: string): any {
  let cleaned = aiText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  cleaned = cleaned.replace(/^`+|`+$/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last > first) {
      return JSON.parse(cleaned.slice(first, last + 1));
    }
    throw new Error("Could not parse JSON from AI response");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { profile, fatigueMap, recentHistory, exercises, modifications, planDayOfWeek } = await req.json();

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const equipmentAccess = profile?.equipment_access || "full_gym";
    const filteredExercises = filterExercisesByEquipment(exercises || [], equipmentAccess);

    if (filteredExercises.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No exercises available",
          details: `No exercises match equipment_access="${equipmentAccess}".`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use client's local day of week so rest/lift day matches the app (avoids timezone bugs)
    const dayOfWeek =
      typeof planDayOfWeek === "number" && planDayOfWeek >= 0 && planDayOfWeek <= 6
        ? planDayOfWeek
        : new Date().getDay();

    const trainingFreq = Math.min(6, Math.max(0, Math.floor(profile?.training_frequency || 4)) || 4);
    const workoutDayIndices: number[] =
      trainingFreq === 3 ? [1, 3, 5]
      : trainingFreq === 4 ? [1, 2, 4, 5]
      : trainingFreq === 5 ? [1, 2, 3, 4, 5]
      : trainingFreq === 6 ? [1, 2, 3, 4, 5, 6]
      : [1, 2, 4, 5];
    const workoutIndex = workoutDayIndices.indexOf(dayOfWeek);
    const programStyle = profile?.program_style || "";

    let todayType: string;
    if (workoutIndex === -1) {
      todayType = "rest";
    } else {
      if (programStyle === "ppl") {
        todayType = ["push", "pull", "legs"][workoutIndex % 3] ?? "push";
      } else if (programStyle === "upper_lower") {
        todayType = workoutIndex % 2 === 0 ? "upper" : "lower";
      } else {
        todayType = "ai_decides";
      }
    }

    const modificationsStr = modifications && String(modifications).trim();
    const userAskedForCardio =
      modificationsStr &&
      /\bcardio\b|active recovery|recovery workout|cardio only|just cardio|i want cardio/i.test(modificationsStr);
    const generateCardioOnly = todayType === "rest" || !!userAskedForCardio;

    const systemPrompt = `You are the workout AI for Pumped. Before generating ANY exercises, you MUST check: Is this an ACTIVE RECOVERY day (rest) or did the user explicitly ask for cardio? If YES, you MUST generate ONLY a cardio/active recovery workout — no lifting (no Push, Pull, Legs, Upper, Lower, or Aesthetic strength training). Otherwise, analyze the user's muscle fatigue data and build a lifting plan for the scheduled day type.

CRITICAL: Cardio workouts may ONLY be generated when (1) today is an Active Recovery/rest day in the user's schedule, OR (2) the user explicitly requested cardio in their modifications. In those cases, output ONLY a simple cardio workout (basic gym: treadmill, bike, rower, elliptical). Do NOT generate any strength/lifting workout on rest days.

When generating a LIFTING workout (push, pull, legs, upper, lower, aesthetic, ai_decides), you MUST analyze the user's muscle fatigue data and explicitly reason about which muscles are available.

The fatigueMap is the same data shown on the user's Muscle Readiness diagram (strain-based recovery model). Use it as the single source of truth for recovery.

FATIGUE RULES (recovery_pct from fatigueMap: null/gray = no data yet — treat as fully available):
1. Recovery below 30% (RED): Do NOT target as PRIMARY muscle. If the user's modifications explicitly demand that muscle, include it with reduced volume (2-3 sets max), lighter weight, higher reps (12-15), and in the exercise "why" add: "Your [muscle] is only [X]% recovered. We've reduced volume and recommend lighter weight. Stop if you feel pain."
2. Recovery 30-60% (YELLOW): Can target but moderate volume only — 3 sets max, moderate weight; prefer accessories over heavy compounds for that muscle.
3. Recovery above 60% (GREEN): Fully available for normal programming.
4. No data (null): Treat as fully available (new user assumption).
5. Adjust sets/reps/weight by fatigue: fatigued muscles → fewer sets (2-3), higher reps (12-15), lighter weight. Recovered muscles → normal programming per user goals.
6. If ALL muscles are fatigued but the user still wants to train, generate a light recovery workout only; in EACH exercise's "why", state that recovery is the priority.

GENDER: Use the user's gender (male/female) when suggesting weights and exercises: males typically get slightly higher suggested loads for the same movement; females get appropriate loads and exercise selection (e.g. progressions, alternatives) without reducing volume. The more workout history the user has, the more you can rely on their actual numbers; for new users, use gender and experience level as a guide.

DURATION CALCULATION: Estimate workout duration using this formula:
- Each SET takes approximately 30-45 seconds to perform
- Rest between sets: 2 minutes for compound exercises, 90 seconds for isolation exercises
- Add 1 minute transition time between different exercises
- Example: An exercise with 3 sets and 2-minute rest = 3 × 0.5min (lifting) + 2 × 2min (rest) + 1min (transition) = ~6.5 minutes
- If the user requests a time limit (e.g., '30 minutes'), work backwards: 30 min ÷ ~6.5 min per exercise ≈ 4-5 exercises with 3 sets each, or fewer exercises with more sets
- Always respect time constraints from user modifications
- The estimated_minutes field MUST be accurate based on this calculation, not a guess

ALWAYS include at the top level:
- "name": string, a SHORT descriptive workout title (e.g. "Push Day - Chest & Triceps", "Upper Body", "Aesthetic Lower"). Always set this; the app uses it when the user does not edit.
- "description": string, 2-3 SHORT sentences (must fit on one screen; avoid long paragraphs). Explain WHY this workout was chosen given today's type, recovery, and user goals.
- "primary_targets": array of muscle group name strings (e.g. ["chest","triceps","front_delts"]) being trained today.

SPLIT-SPECIFIC RULES (follow the scheduled day type exactly):
- PPL: When today is "push", select ONLY push exercises (chest, front_delts, side_delts, triceps). When "pull", ONLY pull (lats, traps, rear_delts, biceps, forearms). When "legs", ONLY lower body (quads, hamstrings, glutes, calves, abs if relevant). Use user stats (gender, weight), equipment, fatigue, and recent history to choose sets/reps/weights and progressions. When "rest", generate a simple CARDIO workout: 1-3 activities available at a basic gym (treadmill, bike, rower, elliptical); duration-based; respect user modifications. No heavy lifting on rest.
- Upper/Lower: When "upper", only upper-body exercises (chest, back, shoulders, arms). When "lower", only lower-body (quads, hamstrings, glutes, calves, abs). Same use of stats, equipment, fatigue, history. When "rest", same cardio rule as PPL — basic gym only.
- Aesthetic: Tailor every workout for aesthetics — hypertrophy, proportions, symmetry, staying lean. Prefer higher volume (e.g. 3-4 sets, 8-12 reps), moderate weights; include isolation for shape. Use all user data. When "rest", same cardio rule.
- AI Optimal: Fully optimize using all user data (gender, weight, equipment, fatigue, history, preferences). Choose the best workout type from fatigue and balance. When "rest", same cardio rule.

CARDIO (rest days): Only suggest activities available at a basic gym: treadmill, stationary bike, rower, elliptical, jump rope. No specialty equipment. Keep it simple (e.g. "30 min treadmill", "20 min row + 10 min bike"). Respect user modifications (duration, limitations).

STRICT RULES:
1. Select exercises ONLY from the provided list (exact exercise IDs).
2. Default 4-7 exercises; if user requests long session (10+, 2hr), up to 12 exercises — keep "why" concise when many.
3. Return ONLY valid JSON — no markdown, no backticks, no prose outside the JSON.
4. BODYWEIGHT: For any exercise with equipment "bodyweight", set target_weight_lbs to 0. Only rep count (and optionally seconds for time-based) apply.
5. TIME-BASED (planks, dead hangs, L-sit, hollow hold, wall sit, etc.): Set target_weight_lbs to 0, target_reps to "0", and include "target_seconds": 60 (or appropriate duration). The app shows a seconds input for these.

JSON FORMAT (required keys including description and primary_targets):
{
  "name": "Upper Body - Push",
  "type": "push",
  "estimated_minutes": 50,
  "description": "2-3 sentences referencing fatigue and program.",
  "primary_targets": ["chest", "front_delts", "side_delts", "triceps"],
  "exercises": [
    {
      "exercise_id": "uuid",
      "name": "Exercise Name",
      "sets": 4,
      "target_reps": "8-10",
      "target_weight_lbs": 135,
      "rest_seconds": 120,
      "order": 1,
      "primary_muscle": "chest",
      "why": "Reason including fatigue context if relevant."
    },
    {
      "exercise_id": "uuid",
      "name": "Plank",
      "sets": 3,
      "target_reps": "0",
      "target_weight_lbs": 0,
      "target_seconds": 60,
      "rest_seconds": 60,
      "order": 2,
      "primary_muscle": "abs",
      "why": "Core stability."
    }
  ]
}`;

    const todayTypeLabel =
      todayType === "rest" ? "Active Recovery / Cardio (user chose to train)"
      : todayType === "push" ? "Push (chest, front/side delts, triceps)"
      : todayType === "pull" ? "Pull (back, rear delts, biceps)"
      : todayType === "legs" ? "Legs (quads, hamstrings, glutes, calves)"
      : todayType === "upper" ? "Upper body (chest, back, shoulders, arms)"
      : todayType === "lower" ? "Lower body (quads, hamstrings, glutes, calves)"
      : "AI decides (optimize from fatigue and balance)";

    let userPrompt = "";
    if (generateCardioOnly) {
      userPrompt = `TODAY IS AN ACTIVE RECOVERY DAY (or the user explicitly requested cardio). You MUST generate ONLY a simple CARDIO / active recovery workout. Do NOT generate any strength or lifting workout — no Push, Pull, Legs, Upper, Lower, or Aesthetic lifting. Only cardio activities available at a basic gym: treadmill, stationary bike, rower, elliptical, jump rope. Keep it simple (e.g. 1-3 activities, duration-based). Respect any user modifications (duration, etc.). Use the exercise list if it contains cardio options; otherwise describe a minimal cardio plan in the workout name and description. Return valid JSON with "name" (e.g. "Active Recovery - Cardio"), "description", "primary_targets" (e.g. [] or ["cardio"]), "type": "cardio", and "exercises" (only cardio exercises from the list, or minimal placeholder if none).\n\n`;
    }

    userPrompt += `Generate today's workout. You MUST use: (1) user profile and stats below, (2) muscle fatigue/readiness, (3) recent workout history, (4) any user modifications. FIRST reason about fatigue — then build the plan for TODAY'S SCHEDULED TYPE.

USER PROFILE (use for exercise choice, sets, reps, and weights):
- Program style: ${profile?.program_style}
- Experience: ${profile?.experience_level || "intermediate"}
- Equipment: ${equipmentAccess}
- Frequency: ${profile?.training_frequency || 4} days/week
- Weight: ${profile?.weight_lbs || "unknown"} lbs
- Gender: ${profile?.gender === "male" ? "male" : profile?.gender === "female" ? "female" : "not specified"}

GENDER & LOAD: Male — typically higher suggested weights; female — appropriate loads and progressions. Use recent history when available to suggest progressions.

TODAY'S SCHEDULED TYPE (generate for this day only): ${todayTypeLabel}
${generateCardioOnly ? ">>> YOU MUST GENERATE ONLY A CARDIO/ACTIVE RECOVERY WORKOUT. NO LIFTING (no Push, Pull, Legs, Upper, Lower, Aesthetic strength). <<<" : todayType === "rest" ? "Generate a SIMPLE CARDIO workout. Only activities available at a basic gym: treadmill, bike, rower, elliptical. Duration-based. Respect modifications." : ""}

${programStyle === "aesthetic" ? `AESTHETIC PROGRAM: Prioritize muscle growth and hypertrophy while staying lean. Prefer higher volume (e.g. 3-4 sets, 8-12 reps), moderate weights; proportions and symmetry. Description must briefly explain why these exercises support the user's aesthetic goals (2-3 short sentences, fit on one screen).` : ""}
${programStyle === "ai_optimal" ? `AI OPTIMAL: Fully optimize this workout using all data above; choose focus from fatigue and overall balance.` : ""}

MUSCLE READINESS (same as Muscle Readiness diagram — analyze before choosing exercises; red <30% avoid primary; yellow 30-60 moderate; green >60 full; null = no data = available):
${Object.entries(fatigueMap || {}).map(([muscle, data]: [string, any]) => {
      const pct = data.recovery_pct;
      const band =
        pct == null ? "no data (treat as available)"
        : pct < 30 ? "RED — avoid primary"
        : pct < 60 ? "YELLOW — moderate volume only"
        : "GREEN — full programming";
      const strainNote = data.last_strain_score != null ? ` [last strain: ${data.last_strain_score}%]` : "";
      return `- ${muscle}: ${pct ?? "null"}% — ${band} (last: ${data.last_trained_at || "never"}${strainNote})`;
    }).join("\n") || "- (no readiness data)"}

RECENT HISTORY:
${(recentHistory || []).map((w: any) => `- ${w.date}: ${w.name} (${w.total_volume} vol)`).join("\n") || "None"}

AVAILABLE EXERCISES (${filteredExercises.length}, use exact IDs):
${filteredExercises.map((e: any) => `- ID: ${e.id} | ${e.name} | Primary: ${e.primary_muscle} | Equipment: ${e.equipment}`).join("\n")}`;

    if (modifications && String(modifications).trim()) {
      userPrompt += `\n\nUSER MODIFICATIONS:\n${modifications}\nRespect these; if they conflict with red muscles, include warning in why and reduce volume.`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2800,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: "AI generation failed",
          details: errorText,
          claudeStatus: response.status,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const aiText = data.content?.[0]?.text;
    if (!aiText || typeof aiText !== "string") {
      return new Response(
        JSON.stringify({ error: "Empty AI response", raw: data }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let workoutPlan: any;
    try {
      workoutPlan = parseWorkoutJson(aiText);
    } catch (parseError) {
      console.error("Parse error:", parseError, aiText?.slice(0, 2000));
      return new Response(
        JSON.stringify({
          error: "Failed to parse AI response",
          raw: aiText.length > 3000 ? aiText.slice(0, 3000) + "…" : aiText,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!workoutPlan?.exercises || !Array.isArray(workoutPlan.exercises)) {
      return new Response(
        JSON.stringify({ error: "Missing exercises array", parsed: workoutPlan }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof workoutPlan.name !== "string" || !workoutPlan.name.trim()) {
      const fallback =
        todayType === "push" ? "Push Day"
        : todayType === "pull" ? "Pull Day"
        : todayType === "legs" ? "Legs Day"
        : todayType === "upper" ? "Upper Body"
        : todayType === "lower" ? "Lower Body"
        : todayType === "rest" ? "Cardio"
        : "Today's Workout";
      workoutPlan.name = fallback;
    }
    if (typeof workoutPlan.description !== "string" || !workoutPlan.description.trim()) {
      workoutPlan.description =
        "Workout tailored to your program and available recovery. Check each exercise's Why? for specifics.";
    }
    if (!Array.isArray(workoutPlan.primary_targets)) {
      const targets = new Set<string>();
      for (const ex of workoutPlan.exercises) {
        if (ex?.primary_muscle) targets.add(String(ex.primary_muscle));
      }
      workoutPlan.primary_targets = [...targets];
    }

    return new Response(JSON.stringify(workoutPlan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
