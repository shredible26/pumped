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
    const allowed = new Set(["barbell", "dumbbell", "bodyweight", "kettlebell"]);
    return exercises.filter((e) => allowed.has(String(e.equipment || "").toLowerCase()));
  }

  const sorted = [...exercises].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
  return sorted.slice(0, 80);
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
    const { profile, fatigueMap, recentHistory, exercises, modifications } = await req.json();

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

    const programRotations: Record<string, string[]> = {
      ppl: ["push", "pull", "legs", "push", "pull", "legs", "rest"],
      upper_lower: ["upper", "lower", "rest", "upper", "lower", "rest", "rest"],
      aesthetic: [],
      ai_optimal: [],
    };

    const dayOfWeek = new Date().getDay();
    const rotation = programRotations[profile?.program_style] || [];
    const todayType = rotation.length > 0 ? rotation[dayOfWeek] : "ai_decides";

    const systemPrompt = `You are the workout AI for Pumped. Before generating ANY exercises, you MUST analyze the user's muscle fatigue data and explicitly reason about which muscles are available.

FATIGUE RULES (recovery % from fatigueMap: null/gray = no data yet — treat as fully available):
1. Recovery below 30% (RED): Do NOT target as PRIMARY muscle. If the user's modifications explicitly demand that muscle, include it with reduced volume (2-3 sets max), lighter weight, higher reps (12-15), and in the exercise "why" add: "Your [muscle] is only [X]% recovered. We've reduced volume and recommend lighter weight. Stop if you feel pain."
2. Recovery 30-60% (YELLOW): Can target but moderate volume only — 3 sets max, moderate weight; prefer accessories over heavy compounds for that muscle.
3. Recovery above 60% (GREEN): Fully available for normal programming.
4. No data (null): Treat as fully available (new user assumption).
5. Adjust sets/reps/weight by fatigue: fatigued muscles → fewer sets (2-3), higher reps (12-15), lighter weight. Recovered muscles → normal programming per user goals.
6. If ALL muscles are fatigued but the user still wants to train, generate a light recovery workout only; in EACH exercise's "why", state that recovery is the priority.

DURATION CALCULATION: Estimate workout duration using this formula:
- Each SET takes approximately 30-45 seconds to perform
- Rest between sets: 2 minutes for compound exercises, 90 seconds for isolation exercises
- Add 1 minute transition time between different exercises
- Example: An exercise with 3 sets and 2-minute rest = 3 × 0.5min (lifting) + 2 × 2min (rest) + 1min (transition) = ~6.5 minutes
- If the user requests a time limit (e.g., '30 minutes'), work backwards: 30 min ÷ ~6.5 min per exercise ≈ 4-5 exercises with 3 sets each, or fewer exercises with more sets
- Always respect time constraints from user modifications
- The estimated_minutes field MUST be accurate based on this calculation, not a guess

ALWAYS include at the top level:
- "description": string, 2-3 sentences explaining WHY this workout was chosen: which muscles are recovered and targeted, which are avoided or given reduced volume, and how this fits the program.
- "primary_targets": array of muscle group name strings (e.g. ["chest","triceps","front_delts"]) being trained today.

STRICT RULES:
1. Select exercises ONLY from the provided list (exact exercise IDs).
2. Default 4-7 exercises; if user requests long session (10+, 2hr), up to 12 exercises — keep "why" concise when many.
3. Return ONLY valid JSON — no markdown, no backticks, no prose outside the JSON.

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
    }
  ]
}`;

    let userPrompt = `Generate today's workout. FIRST: reason about fatigue — which muscles are available (green/yellow/red/null) — then build the plan.

USER PROFILE:
- Program style: ${profile?.program_style}
- Experience: ${profile?.experience_level || "intermediate"}
- Equipment: ${equipmentAccess}
- Frequency: ${profile?.training_frequency || 4} days/week
- Weight: ${profile?.weight_lbs || "unknown"} lbs

TODAY TYPE: ${todayType === "rest" ? "Rest day but user may train — light recovery only." : todayType === "ai_decides" ? "You decide from fatigue." : todayType}

MUSCLE FATIGUE (analyze before choosing exercises — red <30% avoid primary; yellow 30-60 moderate; green >60 full; null = no data = available):
${Object.entries(fatigueMap || {}).map(([muscle, data]: [string, any]) => {
      const pct = data.recovery_pct;
      const band =
        pct == null ? "no data (treat as available)"
        : pct < 30 ? "RED — avoid primary"
        : pct < 60 ? "YELLOW — moderate volume only"
        : "GREEN — full programming";
      return `- ${muscle}: ${pct ?? "null"}% — ${band} (last: ${data.last_trained_at || "never"})`;
    }).join("\n") || "- (no fatigue entries)"}

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

    // Ensure description and primary_targets exist for client
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
