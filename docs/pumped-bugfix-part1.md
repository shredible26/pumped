# PUMPED — Bug Fixes & Features Part 1 of 2
## Paste into Cursor

Reference @docs/pumped-technical-spec-v2.md and @docs/pumped-ai-integration-prompt.md for context. Implement all of the following changes. Test after each numbered section.

---

## 1. FUNCTIONAL CALENDAR BAR

The calendar at the top of the Today screen needs to be fully interactive:

- Tapping any previous day should "select" that day — the pill/highlight moves to that day
- When a past day is selected, the entire home screen should update to show data from that day:
  - If a workout was completed that day, the workout card should change to show the workout name with a "View Workout" button that navigates to the session detail for that day's workout
  - If no workout was logged that day, show "No workout logged" in the card area
  - The muscle readiness map should still show CURRENT recovery (not historical) since that's always relevant
- Tapping today's date should return the screen to the normal "today" view with the AI workout generation card
- The selected day should have the highlighted pill background, and today should always have a small green dot indicator even when not selected
- Add state: `const [selectedDate, setSelectedDate] = useState(new Date())` and pass it down to child components
- Query workout_sessions for the selected date to determine what to show

## 2. SHOW AI WORKOUT NAME ON HOME SCREEN

Currently the home card just says "AI Workout". Fix this:

- When the home screen loads (for today), check the ai_workout_plans cache for today's plan
- If a cached plan exists, show the plan's actual name (e.g., "Recovery - Hamstrings & Shoulders") instead of "AI Workout"
- Below the name, keep showing the program style (e.g., "Push/Pull/Legs" or "AI Optimal")
- If no cached plan exists yet, show "Generate Today's Workout" as the card title with a sparkle icon
- Remove the small green "GENERATED" badge — it adds no value

## 3. RENAME "REGENERATE" TO "CUSTOMIZE"

On the workout preview screen:
- Change the button text from "Regenerate Workout" to "Customize Workout"
- Keep the same behavior: tapping it navigates to the modifications screen where the user can type changes and regenerate
- The credits alert should say "This will customize your workout and use 1 of your X remaining daily credits. Continue?"

## 4. ACCURATE WORKOUT DURATION ESTIMATION

Update the Edge Function system prompt to calculate duration more accurately. Add this to the system prompt:

"DURATION CALCULATION: Estimate workout duration using this formula:
- Each SET takes approximately 30-45 seconds to perform
- Rest between sets: 2 minutes for compound exercises, 90 seconds for isolation exercises
- Add 1 minute transition time between different exercises
- Example: An exercise with 3 sets and 2-minute rest = 3 × 0.5min (lifting) + 2 × 2min (rest) + 1min (transition) = ~6.5 minutes
- If the user requests a time limit (e.g., '30 minutes'), work backwards: 30 min ÷ ~6.5 min per exercise ≈ 4-5 exercises with 3 sets each, or fewer exercises with more sets
- Always respect time constraints from user modifications
- The estimated_minutes field MUST be accurate based on this calculation, not a guess"

Redeploy the edge function after this change: `supabase functions deploy generate-workout --no-verify-jwt`

## 5. IMPROVED SET EDITING IN WORKOUT LOGGING

On the workout logging screen (both AI log and Speed Log):

### Delete Set Button
- When a set pill is tapped/expanded for editing, show a small red "Delete Set" button (trash icon or red X) next to the OK button
- Tapping delete removes that set immediately with a brief animation
- Keep the swipe-to-delete as an alternative method, but the button makes it discoverable

### Duration Picker
- Replace the typed duration input with a scroll wheel picker:
  - Two columns: Hours (0-3) and Minutes (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
  - Use a native-feeling scroll picker component (React Native's built-in Picker or a wheel picker library)
  - Default to 0 hours, 45 minutes
  - Show the selected duration as "1h 15m" or "45 min" format above the picker

### Editable Workout Name
- At the top of the logging screen, the workout name should be an editable text field
- Show the AI-generated name (or "Custom Workout") as the default
- Tapping the name should make it editable inline with a text cursor
- Remove the name input from the "Save Workout" screen since it's now handled here
- The save screen should just show a confirmation with the name already set

## 6. DAY STREAK — MAKE IT ACTUALLY WORK

The streak counter must be calculated from real data:

- Query workout_sessions table for the current user, ordered by date DESC
- Starting from yesterday, count consecutive days that have at least one completed workout (is_rest_day counts too — rest days don't break streaks)
- If today has a workout logged, include today in the count
- Update the streak count on the profile after every workout completion
- The streak badge on the home screen should show the actual calculated streak
- If the user has no workouts, show "0 day streak" or hide the badge
- Streak resets to 0 if there's a gap day with no workout and no rest day logged

Implementation:
```typescript
async function calculateStreak(userId: string): Promise<number> {
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('date')
    .eq('user_id', userId)
    .eq('completed', true)
    .order('date', { ascending: false });

  if (!sessions || sessions.length === 0) return 0;

  // Get unique dates
  const uniqueDates = [...new Set(sessions.map(s => s.date))].sort().reverse();

  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Check if the most recent workout is today or yesterday
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

  // Count consecutive days
  let checkDate = new Date(uniqueDates[0]);
  for (const dateStr of uniqueDates) {
    const expectedDate = checkDate.toISOString().split('T')[0];
    if (dateStr === expectedDate) {
      streak++;
      checkDate = new Date(checkDate.getTime() - 86400000); // go back 1 day
    } else {
      break;
    }
  }

  return streak;
}
```

## 7. CARDIO SUPPORT

### Exercise Database
Add cardio exercises to the exercises table. Run this in the Edge Function or add a migration:
- Add these cardio exercises to the database (or seed them): Walking, Running, Treadmill (Incline Walk), Stairmaster, Stationary Bike, Elliptical, Jump Rope, Rowing Machine, Swimming
- These should have: movement_pattern = 'cardio', equipment = 'cardio_machine' or 'bodyweight', primary_muscle = 'cardio', difficulty = 'beginner'

### AI Cardio Recommendations
Update the Edge Function to handle cardio days:
- Based on the user's training_frequency (e.g., 5 lift days), the AI should determine which days are rest/cardio days
- On a rest/cardio day, the home screen should show a cardio recommendation card instead of a lift workout card:
  - Card title: "Active Recovery" or "Cardio Day"
  - Recommended activity: e.g., "30 Minute Incline Treadmill Walk" or "20 Minutes Stairmaster"
  - The recommendation should be based on muscle fatigue (e.g., if legs are very fatigued, recommend upper body cardio like rowing; if everything is fatigued, recommend walking)
  - Brief description: "Your legs are recovering from yesterday's session. A light walk keeps blood flowing without adding fatigue."
- The user can "Customize Cardio" (uses a credit) to get a different recommendation
- Add a "Log Rest Day" button (secondary style) — logging a rest day:
  - Creates a workout_session with is_rest_day = true
  - Does NOT break the streak
  - Shows on the calendar as a gray dot (different from green workout dot)

### Cardio Logging
When logging a cardio workout:
- Only ask for: cardio type (dropdown or search from cardio exercises) and duration (same wheel picker from section 5)
- No sets/reps/weight needed
- Save as a workout_session with is_cardio = true and the duration

### Home Screen Split Descriptions
Under each program style option (in onboarding and profile settings), add subtitle text:
- PPL: "Push/Pull/Legs · AI-generated workouts · Cardio on rest days"
- Upper/Lower: "Upper/Lower split · AI-powered · Cardio on rest days"
- Aesthetic: "Optimized by AI for aesthetics · Cardio on rest days"
- AI Optimal: "Fully AI-optimized · Smart cardio scheduling"

## IMPLEMENTATION ORDER
1. Functional calendar (tappable, shows past workout data)
2. AI workout name on home screen + remove GENERATED badge
3. Rename Regenerate to Customize
4. Duration estimation fix (update edge function + redeploy)
5. Set editing improvements (delete button, duration picker, editable name)
6. Streak calculation from real data
7. Cardio support (exercises, AI recommendations, logging, rest days)

Test after each step. Do not skip ahead if there are errors.

---

## IMPLEMENTATION STATUS: COMPLETE (March 2026)

All items above have been implemented. For current behavior and file locations, see **docs/pumped-technical-spec-v2.md** §7.4 (Home Screen) and §Implementation Status.

**Notable current behavior:**
- **Calendar**: All days (past, today, future) are tappable. Green dot under a date appears only when that day has logged activity (workout, rest, or cardio) and the day is **not** in the future.
- **Welcome line**: Shows only the date for all days (e.g. "Tuesday, Mar 10") — no "Welcome, username".
- **Muscle Readiness**: For past days, the map uses **historical** fatigue from `getHistoricalFatigueMap(userId, selectedDate)`. For future days the map is empty. Refreshes on screen focus for today.
- **Duration**: Replaced wheel picker with **two text inputs** (Hours, Minutes) via `components/ui/DurationInput.tsx`.
- **RoutineTimeline**: "This Week's Plan" at bottom of Today screen; schedule from `utils/schedule.ts` (`getWorkoutTypeForDate`). Only **today's** node is filled green; checkmarks only on **past** logged days.
- **Program styles**: Only four — PPL, Upper/Lower, Aesthetic, AI Optimal (Bro Split and Full Body removed; migration `008_program_style_four_only.sql`).
- **Workout names**: When user doesn't set a name, `utils/workoutName.ts` → `generateWorkoutNameFromExercises` is used for session name.
