# PUMPED — Major Refactor Prompt for Cursor
## Paste this entire document into Cursor as a single prompt
## It replaces and restructures the existing app built from Prompts 1-5

---

I need a major refactor of the Pumped app. The app currently has screens built from earlier prompts, but the structure, navigation, and UI need to change significantly. Reference @docs/pumped-technical-spec-v2.md for database schemas, theme tokens, and utility functions — those stay the same. But the screens, navigation, and features are changing as described below.

## NAVIGATION CHANGES

Change the bottom tab bar to exactly 4 tabs:
1. **Today** (home icon) — the main home screen
2. **Progress** (chart/trending-up icon) — insights, strength score, volume, muscle distribution
3. **Workouts** (dumbbell icon) — past workouts, saved workouts, custom workout builder
4. **Profile** (person icon) — settings, account

Remove any existing "History" and "Strength" tabs. Those are now sections within Progress and Workouts.

---

## TAB 1: TODAY (Home Screen)

This is the most important screen. Rebuild it completely with this exact layout from top to bottom:

### 1.1 Weekly Calendar Strip (TOP)
- Horizontal row showing the current week (Sun through Sat)
- Each day shows: day abbreviation on top (SUN, MON, etc.), date number below, and a dot indicator if there's a workout logged that day
- Today's date should be highlighted with a filled oval/pill background (use the card background color, slightly lighter than the main bg)
- Today should be visually prominent — bigger or highlighted
- The calendar should show the days around today (a few days before and after)
- Style reference: similar to the Tonal app calendar (clean, minimal, dark background)

### 1.2 Welcome Message
- Below the calendar: "Welcome, {firstName}" in large bold text (28pt)
- Subtitle: "You have X workouts today" or "Rest day — recover and grow" based on the schedule

### 1.3 Today's Workout Card
- A prominent card with:
  - A "SCHEDULED" badge/pill in green at the top-left
  - Workout type in large bold text: "Push" (or "Pull", "Legs", "Upper", etc.)
  - Below that in smaller gray text: "Push/Pull/Legs" (showing the program name) with a small dropdown chevron
  - A small dumbbell icon in a dark green square at the top-right
  - **[Start Workout]** button — large, full-width, green (#4ADE80), with a play icon. Tapping this goes to the AI-generated workout preview with all exercises, sets, reps, weights, and "Why?" buttons for each exercise.
  - **[Speed Log]** button — below Start Workout, secondary style (dark card with border), with a lightning bolt icon. Tapping this opens the Speed Log flow.

### 1.4 Muscle Readiness Body Map
- Directly below the workout card
- Title: "Muscle Readiness" with a legend showing the 4 states:
  - Green = Recovered (ready to train)
  - Yellow = Moderate fatigue (okay for light work)
  - Red = Fatigued (avoid in today's workout)
  - Gray = No data yet (default state for new accounts)
- Front and back body SVG diagrams side by side
- Each muscle group is color-coded based on recovery percentage
- Tapping a muscle group opens a bottom sheet with:
  - Muscle name
  - Recovery percentage (large, colored)
  - Last trained date
  - Recommendation text ("Ready for heavy work" / "Light isolation only" / "Rest this muscle")
- NEW: When a user first creates an account, ALL muscles should be GRAY (no data) until they log their first workout. After a workout, only the trained muscles change color. This is more honest than showing everything as "recovered."

### 1.5 Quick Stats Row (bottom of scroll)
- 3 small horizontal cards:
  - Total Workouts (number)
  - Current Streak (X days, with fire emoji)
  - This Week (X/Y workouts completed vs target)

---

## SPEED LOG FLOW

When the user taps "Speed Log" on the home screen, open a full-screen modal with this flow:

### Screen 1: "Speed Log — What did you work on?"
- Header: "Speed Log" centered, X close button top-left
- Subtitle: "What did you work on?"
- Section "SCHEDULED" — shows the recommended workout type based on the user's program rotation, with a "BEST MATCH" badge in green. E.g., "Push" with a calendar icon. Tapping this pre-fills the workout with exercises for that type.
- Section "YOUR SPLIT" — shows the other days in the user's split that aren't the recommended one. E.g., if it's a PPL user and Push is recommended, show "Pull" and "Legs" as tappable options.
- Section "OR PICK A MUSCLE GROUP" — grid of tappable pills: Chest, Back, Shoulders, Arms, Core, Full Body
- Section "OR START FROM SCRATCH" — a "Build Your Own" card with a + icon and description "Pick exercises, sets & reps from scratch"

### Screen 2: Speed Log Editor
When the user selects a workout type (or starts from scratch), show:
- Header: lightning bolt + "Speed Log" centered, X close button
- Subtitle: "New [Type] workout" with a "NEW" badge
- If first time logging this type, show a yellow info banner: "Predictions may be off — No history for [type] yet. These are default suggestions. The more you log, the smarter Speed Log gets."
- **Duration** row: clock icon + "Duration" label + editable time value (default 45 min), tappable to change
- **Exercise cards** — for each exercise:
  - Exercise name (bold, e.g., "Overhead Press") with an X button to remove
  - Set pills in a horizontal row: each pill shows "115 x 8" format
  - A [+] button at the end to add another set
  - Tapping a set pill expands it inline to show editable weight and rep fields, with an "OK" button to confirm
  - A [-] option to remove a set (swipe left or long press)
- **[+ Add Exercise]** button at the bottom of the exercise list — opens exercise search
- **Footer**: fixed at bottom showing summary "5 exercises · 18 sets · ~10.6k lbs"
- **[Log It]** button — large, green, full width, with lightning bolt icon

### Screen 3: Save This Workout
After tapping "Log It", show a modal/card:
- Bookmark icon at top (green circle)
- "Save This Workout?" title
- "Reuse it next time you train [type]" subtitle
- List of exercises with set counts (e.g., "Overhead Press — 4 sets")
- Text input: "Name this workout (e.g., My Push Day)"
- **[Save Workout]** green button
- **[Skip]** text button below

After saving (or skipping), navigate back to the Today screen. The workout should now appear in the calendar as a dot for today, the fatigue map should update, and the streak should increment.

---

## AI WORKOUT PREVIEW (Start Workout flow)

When the user taps "Start Workout" from the Today card:

### Preview Screen
- Header: "Today's Workout" with back button
- Workout name (e.g., "Push Day") — large, bold
- Tags: exercise count, estimated duration, program type (colored pill)
- List of ExerciseCards, each showing:
  - Number badge (1, 2, 3...)
  - Exercise name (bold)
  - Sets x Reps x Weight (e.g., "4 sets · 6-8 reps · 185 lbs")
  - Muscle group + equipment labels (small, gray)
  - **[Why?]** button (green, small) — this is CRITICAL. Tapping opens a bottom sheet explaining exactly why this exercise was recommended:
    - "WHY THIS EXERCISE?" header in green
    - Exercise name
    - 2-3 sentence explanation connecting it to the user's program, recovery state, and progression
    - Tags showing muscle, equipment, rep scheme
    - "Got it" dismiss button
- **[Start Workout]** button at the bottom — begins the active session

### Active Workout Session
Keep the existing active workout screen but ensure:
- Set logging is 2-tap: sets are pre-filled with target weight/reps, tap "Complete Set" to log
- Rest timer auto-starts between sets
- Previous performance shown ("Last: 185 x 8, 8, 7")
- Haptic feedback on set completion
- Progress indicator showing current exercise / total exercises

### Workout Summary
Keep the existing summary screen with:
- Celebration animation
- Stats grid (duration, volume, exercises, sets)
- PR detection with trophy card
- Strength score update (if Big 3 were performed)
- Streak update
- "Back to Home" button

---

## TAB 2: PROGRESS

Rebuild this screen completely. It should be a ScrollView with these sections:

### 2.1 Header
- "Progress" title (large, bold)
- Stats pills row (horizontally scrollable): X workouts, X day streak, Xk volume (total)

### 2.2 Insights Section
- "Insights" section header in accent color (green or purple)
- If the user has fewer than 5 workouts logged:
  - Show a card with sparkle icon: "Log X more workouts to unlock insights"
  - Progress bar showing workouts logged / 5
- If the user has 5+ workouts:
  - Show 2-3 insight cards with rule-based insights like:
    - "You haven't trained legs in X days"
    - "Your bench press e1RM increased X lbs this month"
    - "You're averaging X workouts/week — above your target"
    - "Your push:pull volume ratio is X:1 — consider more pulling work"
  - Later these will be replaced with AI-generated insights from the edge function

### 2.3 Strength Score (Big 3 Lifts)
- "Big 3 Lifts" section header with trophy icon
- If no Big 3 data: "Log bench, squat, or deadlift to see your Big 3." with trophy icon
- If data exists:
  - Strength Score (large number) = sum of e1RMs
  - 3 individual cards showing: Squat e1RM, Bench e1RM, Deadlift e1RM
  - Each card shows: lift name, e1RM value, "Based on [weight] x [reps] on [date]"
  - Weekly/monthly change indicator

### 2.4 Volume Section
- "Volume" section header
- Toggle pills: Week | Month | Year
- Large volume number with "lbs" label (e.g., "11K lbs")
- Bar chart showing volume per day (for week view) or per week (for month/year view)
- Bars colored in accent blue

### 2.5 Muscle Distribution (NEW — IMPORTANT)
- "Muscle Distribution" section header
- This is a body map similar to the fatigue map on the home screen, BUT it shows CUMULATIVE training volume distribution, not recovery
- Color intensity represents how much volume each muscle group has received relative to others:
  - Brightest/most saturated = most trained muscle group
  - Dimmest = least trained
  - Use a gradient from dark blue (low volume) through bright green (high volume)
- Below the body map, show a ranked list of muscle groups with percentages:
  - "Chest — 22%"
  - "Shoulders — 18%"
  - "Triceps — 15%"
  - etc.
- Add an "Imbalance Alert" card if any opposing muscle group pair has more than 2:1 volume ratio:
  - E.g., "Push vs Pull imbalance detected. You've done 60% more push volume than pull volume this month. Consider adding more rows and pulldowns."
  - Orange/yellow warning card style

### 2.6 Exercise Progress
- "Exercise Progress" section header
- Horizontal scrollable cards showing muscle groups trained (e.g., "Shoulders — 3 exercises", "Arms — 2 exercises")
- Tapping a muscle group could expand to show per-exercise progress (post-MVP)

---

## TAB 3: WORKOUTS

This is a new screen. Build it as a ScrollView with these sections:

### 3.1 Past Workouts
- "Past Workouts" section header with a "See All" link
- Show the last 5 workouts as cards:
  - Workout name (e.g., "Push Day")
  - Date + Duration + Volume
  - Number of exercises
  - PR badge if applicable
- Tapping a workout opens the session detail screen (keep existing)
- "See All" opens a full list view grouped by week with weekly volume summaries:
  - "This Week — 3 workouts — 42,350 lbs"
    - Workout cards underneath
  - "Last Week — 4 workouts — 51,200 lbs"
    - Workout cards underneath
  - Infinite scroll

### 3.2 Saved Workouts
- "Saved Workouts" section header
- Grid or list of saved workout templates (from the Speed Log "Save Workout" flow)
- Each shows: workout name, exercise count, last used date
- Tapping a saved workout opens it in Speed Log with all exercises pre-filled
- Swipe left to delete a saved workout
- If no saved workouts: "Save a workout from Speed Log to reuse it here"

### 3.3 Add Custom Workout
- A prominent card/button: "+ Create Custom Workout"
- "Build a workout from scratch with any exercises"
- Tapping opens the custom workout builder (exercise search, add exercises, configure sets)

### 3.4 Celebrity Workouts (Placeholder)
- "Celebrity Workouts" section header with a "COMING SOON" badge
- A teaser card: "Popular routines from athletes and influencers. Coming soon."
- Grayed out / locked appearance
- This section will be built in Phase 2

---

## TAB 4: PROFILE

Keep the existing profile screen mostly as-is but ensure it has:
- Avatar (initials in green gradient circle)
- User name + "Since [month] [year]" + program style label
- Stats row: Strength Score | Total Workouts | Streak
- Settings list:
  - Program Style (PPL, Upper/Lower, Bro Split, Full Body, AI Optimal)
  - Training Days/Week
  - Equipment Access
  - Body Stats (height, weight)
  - Units (lbs/kg toggle)
  - Notifications (toggle)
- Sign Out button

---

## DATABASE / STATE CHANGES NEEDED

### New table: saved_workouts
```sql
CREATE TABLE public.saved_workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  name TEXT NOT NULL,
  workout_type TEXT,
  exercises JSONB NOT NULL,
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.saved_workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_saved" ON public.saved_workouts FOR ALL USING (auth.uid() = user_id);
```

### Muscle distribution calculation
Create a utility function that calculates volume distribution across muscle groups from all logged set_logs for a given time period:
```typescript
function calculateMuscleDistribution(
  setLogs: SetLog[],
  exerciseDb: Exercise[],
  period: '7d' | '30d' | '90d' | 'all'
): { muscle: string; volume: number; percentage: number }[]
```

### Default fatigue state for new users
When initializing fatigue for a new user, set all 14 muscle groups to `recovery_pct: null` (not 100). The body map should render `null` as gray (no data), distinct from 100% green (recovered). Only after a muscle is trained does it get actual recovery data.

---

## STYLING GUIDELINES

- Dark theme throughout (#0A0A0F background, #151520 cards)
- Green accent (#4ADE80) for primary actions, active states, positive indicators
- Keep the UI clean and minimal — no unnecessary decoration
- Cards should have subtle 1px borders (rgba(255,255,255,0.06))
- Text hierarchy: titles in white (#F5F5F5), secondary in gray (#9CA3AF), tertiary in dim gray (#6B7280)
- The Speed Log flow should feel FAST — minimal taps, everything pre-filled where possible
- Animations should be subtle — no flashy transitions, just smooth navigation
- Bottom sheet modals (for "Why?" and muscle detail) should use @gorhom/bottom-sheet

---

## IMPLEMENTATION ORDER

Build these changes in this order:
1. Change the tab navigation to 4 tabs (Today, Progress, Workouts, Profile)
2. Rebuild the Today screen (calendar, welcome, workout card, body map, quick stats)
3. Build the Speed Log flow (3 screens: type selection, editor, save)
4. Ensure the AI workout preview and active session still work correctly
5. Build the Progress screen (insights, Big 3, volume chart, muscle distribution)
6. Build the Workouts screen (past workouts, saved workouts, custom builder, celebrity placeholder)
7. Update Profile screen
8. Handle the new gray state for muscle fatigue (no data vs recovered)
9. Create the saved_workouts table and wire up save/load

After each step, verify the app compiles and runs without errors before moving to the next step.
