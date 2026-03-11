# PUMPED — Technical Specification v2.0
## MVP Scope: Focused Core
## March 2026

---

# TABLE OF CONTENTS

1. MVP Scope Definition
2. Architecture Overview
3. Project Structure
4. Tech Stack & Setup
5. Database Schema
6. Design Tokens
7. Screen Specifications
   - 7.1 Welcome
   - 7.2 Sign Up / Sign In
   - 7.3 Onboarding (3 steps)
   - 7.4 Home Screen
   - 7.5 Start Workout (AI Recommended)
   - 7.6 Start Workout (Custom / Quick Log)
   - 7.7 Active Workout Session
   - 7.8 Workout Summary
   - 7.9 History
   - 7.10 Session Detail
   - 7.11 Strength Tracker (Big 3)
   - 7.12 Profile & Settings
8. AI Workout Engine
9. Muscle Fatigue Engine
10. Progressive Overload Engine
11. Strength Score (e1RM) Calculation
12. Streak System
13. Cursor Build Prompts (Copy-Paste)
14. Build Order & Timeline
15. **Implementation Status (Agent Handoff)** — current behavior, key files, date/schedule logic

---

# 1. MVP SCOPE DEFINITION

## What the MVP Does (4 core features)

### Feature 1: Fast Workout Logging
The app must be the fastest way to log a workout. Two taps to log a set.
- Start a workout (AI-recommended or custom)
- Log sets: weight + reps (auto-filled from last session)
- Built-in rest timer (auto-starts between sets)
- Session summary on completion
- Works offline (syncs when connected)

### Feature 2: Muscle Fatigue Map + AI Daily Recommendation
- Interactive body map (front + back) showing recovery status per muscle
- Color-coded: green (ready), yellow (moderate), red (fatigued)
- AI recommends today's workout based on:
  - User's chosen program style (PPL, Upper/Lower, Aesthetic, AI Optimal)
  - Current muscle fatigue state
  - Recent training history
  - Progressive overload targets
- Every exercise has a "Why?" explanation — THE key differentiator
- User can follow the AI recommendation OR log their own custom workout

### Feature 3: Strength Tracker (Big 3)
- Automatically tracks estimated 1RM for Squat, Bench Press, Deadlift
- Calculated from logged working sets (Epley formula) — no maxing out needed
- Combined "Strength Score" (sum of all 3 e1RMs)
- Simple progress chart showing score over time
- PR detection with celebration when a new best is hit

### Feature 4: Streaks + Progress Stats
- Daily streak (did you work out today?)
- Weekly streak (did you hit your target days this week?)
- Stats: total workouts, total volume, PRs this month
- Streak-break warning push notification

## What the MVP Does NOT Do (deferred)
- Celebrity/popular program templates (Phase 2)
- Community, leaderboards, teams, competitions (Phase 3)
- Nutrition tracking (Phase 3)
- Apple Watch integration (Phase 4)
- Social sharing, friends, followers (Phase 4)
- Exercise form videos (Phase 2)
- Custom program builder (Phase 2)

---

# 2. ARCHITECTURE OVERVIEW

```
MOBILE APP (Expo / React Native)
  |
  |-- Screens (Expo Router)
  |-- State Management (Zustand)
  |-- Local Cache (MMKV) -- offline workout logging
  |
  |--- HTTPS --->  SUPABASE
                     |-- Auth (Apple, Google, Email)
                     |-- PostgreSQL Database
                     |-- Edge Functions
                           |-- generate-workout (calls Claude API)
                           |-- update-fatigue
                           |-- detect-prs
```

Key architectural decisions:
- **Offline-first**: Active workouts are stored locally in MMKV. If the user is in a gym with no signal, the workout logs to local storage and syncs to Supabase when connectivity returns. This is non-negotiable for a gym app.
- **AI runs server-side**: Claude API calls happen in Supabase Edge Functions, never on the client. API keys stay secure.
- **Fatigue is calculated client-side**: The recovery math is simple enough to run locally for instant body map rendering. Server recalculates on sync for consistency.

---

# 3. PROJECT STRUCTURE

```
pumped/
├── app/
│   ├── (auth)/
│   │   ├── welcome.tsx
│   │   ├── signup.tsx
│   │   ├── signin.tsx
│   │   └── onboarding.tsx        # Single file, multi-step
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Bottom tab bar: Today, Progress, Workouts, Profile (4 tabs)
│   │   ├── index.tsx             # Today — calendar, workout card, body map, RoutineTimeline
│   │   ├── progress.tsx          # Progress — insights, Big 3, volume, muscle distribution
│   │   ├── workouts.tsx          # Workouts — Past Workouts list, Saved, Create Custom
│   │   ├── profile.tsx           # Profile — settings, program style, equipment, etc.
│   │   ├── history.tsx           # (hidden tab; list may live in workouts)
│   │   └── strength.tsx          # (hidden tab; Big 3 may live in progress)
│   ├── workout/
│   │   ├── preview.tsx           # AI workout preview with "Why?" buttons
│   │   ├── active.tsx            # Active session (set logging)
│   │   ├── custom.tsx            # Custom workout builder (exercise search + add)
│   │   └── summary.tsx           # Post-workout stats
│   ├── history/
│   │   └── [id].tsx              # Past session detail
│   └── _layout.tsx               # Root: auth gate
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Pill.tsx
│   │   ├── BottomSheet.tsx
│   │   ├── DurationInput.tsx     # Hours + Minutes text inputs (replaces wheel picker)
│   │   └── DurationPicker.tsx    # (legacy; prefer DurationInput)
│   ├── home/
│   │   ├── BodyMap.tsx           # SVG front + back body diagram
│   │   ├── MuscleDetailSheet.tsx # Bottom sheet on muscle tap (uses correct map for selected day)
│   │   ├── RoutineTimeline.tsx   # "This Week's Plan" Mon–Sun with schedule + today highlight
│   │   ├── TodayCard.tsx         # (if present)
│   │   ├── StreakBadge.tsx       # Streak counter pill
│   │   └── StrengthScoreCard.tsx # Big 3 summary
│   ├── workout/
│   │   ├── ExerciseCard.tsx      # Exercise in preview list
│   │   ├── WhySheet.tsx          # "Why this exercise?" bottom sheet
│   │   ├── SetRow.tsx            # Single set: weight + reps + complete
│   │   ├── RestTimer.tsx         # Countdown between sets
│   │   └── ExerciseSearch.tsx    # Search/add exercise (for custom workouts)
│   └── strength/
│       ├── LiftCard.tsx          # Single lift e1RM display
│       └── ProgressChart.tsx     # Score over time line chart
├── hooks/
│   ├── useAuth.ts
│   ├── useFatigue.ts
│   ├── useWorkout.ts             # Active workout state
│   ├── useHistory.ts
│   ├── useStrength.ts            # e1RM calculations
│   └── useStreak.ts
├── stores/
│   ├── authStore.ts
│   ├── workoutStore.ts           # Active session state (persisted to MMKV)
│   └── profileStore.ts
├── services/
│   ├── supabase.ts               # Client init
│   ├── exercises.ts              # Exercise DB queries
│   ├── workouts.ts               # Session CRUD
│   ├── fatigue.ts                # Fatigue read/write
│   └── ai.ts                     # Edge function calls
├── utils/
│   ├── theme.ts                  # Colors, spacing, typography
│   ├── epley.ts                  # e1RM formula
│   ├── recoveryModel.ts          # Fatigue calculation
│   ├── progression.ts            # Progressive overload logic
│   ├── constants.ts
│   ├── date.ts                   # parseLocalDate (yyyy-MM-dd → local Date), getLocalDateString (today in local TZ)
│   ├── schedule.ts               # getWorkoutDayIndices, getWorkoutTypeForDate (shared with RoutineTimeline)
│   └── workoutName.ts            # generateWorkoutNameFromExercises (AI name when user doesn't set one)
├── types/
│   ├── exercise.ts
│   ├── workout.ts
│   ├── user.ts
│   └── database.ts               # Supabase generated types
├── supabase/
│   ├── migrations/
│   │   ├── 001_profiles.sql
│   │   ├── 002_exercises.sql
│   │   ├── 003_workouts.sql
│   │   ├── 004_fatigue.sql
│   │   ├── 007_cardio_and_rest.sql   # workout_sessions: is_rest_day, is_cardio; cardio exercises seed
│   │   └── 008_program_style_four_only.sql  # program_style CHECK: ppl, upper_lower, aesthetic, ai_optimal only
│   └── functions/
│       └── generate-workout/
│           └── index.ts
├── app.json
├── tsconfig.json
└── .env
```

Note: compared to v1 spec, this is significantly slimmer. No teams, challenges, leaderboard, or community tables/screens. Those come in Phase 2-3.

---

# 4. TECH STACK & SETUP

```bash
npx create-expo-app@latest pumped --template tabs
cd pumped

npx expo install react-native-svg react-native-reanimated react-native-gesture-handler
npx expo install react-native-mmkv expo-haptics expo-notifications expo-secure-store
npm install @supabase/supabase-js zustand date-fns
npm install @gorhom/bottom-sheet
```

---

# 5. DATABASE SCHEMA

## profiles
```sql
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  age INTEGER,
  height_inches NUMERIC(5,1),
  weight_lbs NUMERIC(5,1),
  program_style TEXT CHECK (program_style IN (
    'ppl', 'upper_lower', 'aesthetic', 'ai_optimal'
  )) DEFAULT 'ppl',
  training_frequency INTEGER DEFAULT 4,
  equipment_access TEXT CHECK (equipment_access IN (
    'full_gym', 'home_gym', 'bodyweight'
  )) DEFAULT 'full_gym',
  experience_level TEXT CHECK (experience_level IN (
    'beginner', 'intermediate', 'advanced'
  )) DEFAULT 'beginner',
  strength_score NUMERIC(8,1) DEFAULT 0,
  squat_e1rm NUMERIC(6,1) DEFAULT 0,
  bench_e1rm NUMERIC(6,1) DEFAULT 0,
  deadlift_e1rm NUMERIC(6,1) DEFAULT 0,
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  total_workouts INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own_profile_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "own_profile_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
```

## exercises
```sql
CREATE TABLE public.exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT[] DEFAULT '{}',
  movement_pattern TEXT NOT NULL,
  -- 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
  -- 'hip_hinge', 'squat', 'lunge', 'isolation_push', 'isolation_pull', 'core'
  equipment TEXT NOT NULL,
  -- 'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell'
  difficulty TEXT DEFAULT 'intermediate',
  -- 'beginner', 'intermediate', 'advanced'
  fatigue_rating INTEGER DEFAULT 3 CHECK (fatigue_rating BETWEEN 1 AND 5),
  is_big_three BOOLEAN DEFAULT FALSE,
  -- TRUE for squat, bench press, deadlift (for strength score tracking)
  big_three_type TEXT CHECK (big_three_type IN ('squat', 'bench', 'deadlift')),
  goal_tags TEXT[] DEFAULT '{}',
  -- e.g. ['strength', 'hypertrophy', 'aesthetic_priority']
  aesthetic_targets TEXT[] DEFAULT '{}',
  -- e.g. ['v_taper', 'side_delts', 'upper_chest']
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercises_read" ON public.exercises FOR SELECT USING (TRUE);

-- Seed the big 3
-- (Full exercise DB seeding is a separate migration with 150+ exercises)
```

## workout_sessions
```sql
CREATE TABLE public.workout_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  name TEXT NOT NULL,                    -- "Upper Body - Push" or AI-generated name from utils/workoutName
  workout_type TEXT,                      -- "push", "pull", "legs", "upper", "lower", "full"
  source TEXT DEFAULT 'ai_generated',    -- "ai_generated", "custom"
  duration_seconds INTEGER,
  total_volume NUMERIC(10,1) DEFAULT 0,
  exercise_count INTEGER DEFAULT 0,
  set_count INTEGER DEFAULT 0,
  pr_count INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  is_rest_day BOOLEAN DEFAULT FALSE,      -- true for logged rest day (007)
  is_cardio BOOLEAN DEFAULT FALSE,        -- true for cardio sessions (007)
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON public.workout_sessions(user_id, date DESC);

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sessions" ON public.workout_sessions FOR ALL USING (auth.uid() = user_id);
```

## set_logs
```sql
CREATE TABLE public.set_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES public.exercises(id),
  exercise_name TEXT NOT NULL,           -- denormalized for fast reads
  exercise_order INTEGER NOT NULL,       -- position in workout (1, 2, 3...)
  set_number INTEGER NOT NULL,           -- set within exercise (1, 2, 3, 4)
  target_weight NUMERIC(6,1),
  target_reps INTEGER,
  actual_weight NUMERIC(6,1),
  actual_reps INTEGER,
  is_warmup BOOLEAN DEFAULT FALSE,
  is_pr BOOLEAN DEFAULT FALSE,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sets_session ON public.set_logs(session_id, exercise_order, set_number);
CREATE INDEX idx_sets_exercise ON public.set_logs(exercise_id);

ALTER TABLE public.set_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sets" ON public.set_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = set_logs.session_id AND ws.user_id = auth.uid())
);
```

## muscle_fatigue
```sql
CREATE TABLE public.muscle_fatigue (
  user_id UUID REFERENCES public.profiles(id),
  muscle_group TEXT NOT NULL,
  -- 14 groups: chest, front_delts, side_delts, rear_delts, lats, traps,
  -- biceps, triceps, forearms, abs, quads, hamstrings, glutes, calves
  last_trained_at TIMESTAMPTZ,
  volume_load NUMERIC(10,1) DEFAULT 0,
  recovery_pct NUMERIC(5,1) DEFAULT 100,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, muscle_group)
);

ALTER TABLE public.muscle_fatigue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_fatigue" ON public.muscle_fatigue FOR ALL USING (auth.uid() = user_id);
```

## strength_history (for the progress chart)
```sql
CREATE TABLE public.strength_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  squat_e1rm NUMERIC(6,1),
  bench_e1rm NUMERIC(6,1),
  deadlift_e1rm NUMERIC(6,1),
  total_score NUMERIC(8,1),
  recorded_at DATE DEFAULT CURRENT_DATE,
  UNIQUE(user_id, recorded_at)
);

ALTER TABLE public.strength_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_strength" ON public.strength_history FOR ALL USING (auth.uid() = user_id);
```

## ai_workout_plans (cached AI recommendations)
```sql
CREATE TABLE public.ai_workout_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  plan_date DATE DEFAULT CURRENT_DATE,
  workout_name TEXT NOT NULL,
  workout_type TEXT,
  exercises JSONB NOT NULL,
  -- Array of: { exercise_id, name, sets, target_reps, target_weight, rest_seconds, why, order }
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  used BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, plan_date)
);

ALTER TABLE public.ai_workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_plans" ON public.ai_workout_plans FOR ALL USING (auth.uid() = user_id);
```

---

# 6. DESIGN TOKENS

```typescript
// utils/theme.ts
export const colors = {
  bg: { primary: '#0A0A0F', card: '#151520', input: 'rgba(255,255,255,0.06)' },
  accent: { primary: '#4ADE80', dim: '#22C55E', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.20)' },
  recovery: { ready: '#4ADE80', moderate: '#FACC15', fatigued: '#EF4444' },
  text: { primary: '#F5F5F5', secondary: '#9CA3AF', tertiary: '#6B7280', inverse: '#0A0A0F' },
  border: { default: 'rgba(255,255,255,0.06)', light: 'rgba(255,255,255,0.10)' },
  error: '#EF4444',
  program: {
    ppl: '#8B5CF6',
    upper_lower: '#3B82F6',
    aesthetic: '#EC4899',
    ai_optimal: '#4ADE80',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20 };
export const font = {
  xs: 10, sm: 12, md: 14, lg: 16, xl: 18, xxl: 22, xxxl: 28, display: 42,
};

export function recoveryColor(pct: number) {
  if (pct >= 80) return colors.recovery.ready;
  if (pct >= 50) return colors.recovery.moderate;
  return colors.recovery.fatigued;
}
```

---

# 7. SCREEN SPECIFICATIONS

## 7.1 Welcome Screen
**File**: `app/(auth)/welcome.tsx`

Layout (centered, full screen):
- "PUMPED" logo (56pt, extrabold, "P" in green)
- "AI-powered workouts. Track. Recover. Grow." (16pt, secondary)
- Green divider line (60px)
- [Get Started] button (green, full width)
- [I have an account] button (outline green)

Navigation:
- Get Started -> signup
- Have account -> signin

---

## 7.2 Sign Up / Sign In
**File**: `app/(auth)/signup.tsx`, `app/(auth)/signin.tsx`

Signup layout:
- Back arrow
- "Create Account" (28pt)
- Email input
- Password input
- [Continue] button -> creates account, navigates to onboarding
- Divider "or"
- [Continue with Apple] button
- [Continue with Google] button

State: email, password, loading, error

Signin: same layout but "Welcome Back" title and navigates to (tabs) on success.

---

## 7.3 Onboarding (Single Screen, Multi-Step)
**File**: `app/(auth)/onboarding.tsx`

**3 steps only** (fast onboarding, under 60 seconds):

### Step 1: About You
- Gender selector (3 buttons in a row: Male / Female / Other)
- Age input (number)
- Height input (ft/in or cm toggle)
- Weight input (lbs or kg toggle)

### Step 2: Training Style
- "How do you like to train?" title
- 4 tappable cards (single select):
  - **Push/Pull/Legs** — "The classic 6-day split. Each day targets push, pull, or leg muscles." Color: purple
  - **Upper/Lower** — "4-day split alternating upper and lower body." Color: blue
  - **Aesthetic** — "Optimized by AI for aesthetics and proportions." Color: pink
  - **AI Optimal** — "Let the AI build your ideal program." Color: green
- Days per week selector (2-6, pill buttons)
- Equipment: Full Gym / Home Gym / Bodyweight

### Step 3: Quick Strength Check (optional)
- "Log any recent lifts to calibrate your plan"
- 3 exercise rows (Squat, Bench Press, Deadlift)
- Each: weight input + reps input
- [Skip] button (small, secondary)
- [Start Training] button (primary)

On completion:
1. Save profile to Supabase
2. Initialize all 14 muscle groups at 100% recovery
3. If lifts were entered, calculate initial e1RMs and strength score
4. Trigger first AI workout generation
5. Navigate to (tabs)/home

State:
```typescript
const [step, setStep] = useState(0);  // 0, 1, 2
const [gender, setGender] = useState<string | null>(null);
const [age, setAge] = useState('');
const [height, setHeight] = useState('');
const [weight, setWeight] = useState('');
const [program, setProgram] = useState<string | null>(null);
const [frequency, setFrequency] = useState(4);
const [equipment, setEquipment] = useState('full_gym');
const [lifts, setLifts] = useState({ squat: { weight: '', reps: '' }, bench: { weight: '', reps: '' }, deadlift: { weight: '', reps: '' } });
```

---

## 7.4 Home Screen
**File**: `app/(tabs)/index.tsx`

This is the most important screen. Layout and behavior depend on **selected date** (today, past, or future).

### Layout (ScrollView)

**Weekly Calendar Strip** (top):
- Horizontal row: current week (Sun–Sat). Each day shows day abbreviation, date number.
- Tappable: any day (today, past, future) updates `selectedDate`.
- Selected day: pill/highlight background. Today: border highlight.
- **Green dot** under date **only** when that day has logged activity (workout, rest, or cardio) **and** the day is not in the future. No dot on future dates.
- State: `selectedDate`, `activityDaysThisWeek` (dates with any completed session).

**Welcome / Date Line**:
- Single line for all days: **`format(selectedDate, 'EEEE, MMM d')`** (e.g. "Tuesday, Mar 10"). No "Welcome, username" — date only.
- Subtext below: "Scheduled" (future), "Rest day — recover and grow" (today rest), "X day scheduled" (today lift), "Workout completed" / "X workouts completed" (past with sessions), "No workout logged" (past without), or "Rest day" (past rest).

**Content by selected date**:

- **Future day**: One card only — "SCHEDULED" badge, workout type from `getWorkoutTypeForDate` (e.g. Push, Pull, Rest → "Active Recovery Day"). No actions. Body map empty. No quick stats.
- **Today, no workouts logged yet**: AI workout card (SCHEDULED badge, plan name or "Generate Today's Workout", View/Generate button, Speed Log button). Rest day variant: Active Recovery card with Customize Cardio, Log Rest Day, Log Cardio, Speed Log (all same button style).
- **Today, at least one workout logged**: AI card hidden. Speed Log button at top, then list of today's sessions (each with View Workout → history/[id]).
- **Past day, with sessions**: Speed Log button at top, then one card per session (name, date + time, View Workout). Sessions exclude rest-day entries when there is any workout/cardio that day (rest overridden by workout).
- **Past day, no sessions**: Speed Log button at top, then "No workout logged" card.

**Muscle Readiness**:
- Label: "MUSCLE READINESS" + optional " · MMM d" (or " · Future" for future).
- **Today**: `fatigueMap` from `useFatigue()` (refreshed on focus via `refreshFatigue()`).
- **Past**: `historicalFatigueMap` from `getHistoricalFatigueMap(userId, selectedDate)` (recomputed from all sessions up to that date).
- **Future**: empty array (no data).
- MuscleDetailSheet receives the **same** map (today / historical / empty) so percentages and "Last trained" match the selected day.

**Quick Stats** (Workouts, Streak, This Week):
- Shown **only when selected date is today**. Hidden for past and future.

**This Week's Plan (RoutineTimeline)**:
- **File**: `components/home/RoutineTimeline.tsx`.
- Horizontal timeline: 7 nodes Mon–Sun (`weekStartsOn: 1`). Each node: day letter (M,T,W…), circle, type label from `getWorkoutTypeForDate(programStyle, date, trainingFrequency)` — **same logic as future-day card** so labels stay in sync.
- **Only today's node** is filled green (accent). Other days: outline circle; **checkmark inside only for past days that were logged** (no check on future).
- Uses `utils/schedule.ts`: `getWorkoutTypeForDate`, `getWorkoutDayIndices`. Schedule driven by `profile.program_style` and `profile.training_frequency`.
- Card has `marginTop: spacing.xxl` so it sits below the stats row without collision.

**Speed Log and date**:
- Every Speed Log entry point from this screen passes **selected date**: `router.push({ pathname: '/speedlog', params: { logForDate: format(selectedDate, 'yyyy-MM-dd') } })`.
- Speed Log editor uses that date when creating the session so logging on a past day saves to that day. When no param, uses **local today** via `getLocalDateString()` (see Date handling below).

### State (key)
```typescript
const [selectedDate, setSelectedDate] = useState(new Date());
const [sessionsForSelectedDate, setSessionsForSelectedDate] = useState<SessionForDate[]>([]);
const [activityDaysThisWeek, setActivityDaysThisWeek] = useState<string[]>([]);
const { fatigueMap, refreshFatigue } = useFatigue();
const [historicalFatigueMap, setHistoricalFatigueMap] = useState(...);
// profile, cachedPlan, workoutDaysThisWeek, restDaysThisWeek, etc.
```

### Data loading
- On focus (`useFocusEffect`): `fetchSessionsForDate(selectedDate)`, `fetchWeekWorkouts()`, `refreshFatigue()`.
- When `selectedDate` changes: fetch sessions for that date; if past (not today, not future), fetch `getHistoricalFatigueMap` for that date.

---

## 7.5 Workout Preview (AI Recommended)
**File**: `app/workout/preview.tsx`

### Layout:
- Header: "Today's Workout" + back button
- Workout name (24pt, bold)
- Tags: exercise count, duration, program style (colored by program)
- List of ExerciseCards:
  - Number badge (1, 2, 3...)
  - Exercise name (16pt, bold)
  - Stats: 4 sets | 6-8 reps | 185 lbs
  - [Why?] button (green, small) -> opens WhySheet
  - Muscle label + Equipment label (small, gray)
- [Start Workout] button (full width, green, large)

### WhySheet (bottom sheet):
- "WHY THIS EXERCISE?" label (green, uppercase)
- Exercise name (20pt, bold)
- Explanation paragraph (15pt, light gray, line-height 1.6)
  - Generated by AI, stored in the plan JSONB
  - Example: "Incline dumbbell press targets your upper chest, which is a priority for the V-taper aesthetic. Your chest is 85% recovered and ready for moderate volume. 3 sets of 8-10 at 65 lbs continues your progressive overload from last week's 60 lbs."
- Tags: muscle, equipment, rep scheme
- [Got it] button

### State
```typescript
const { plan } = useTodayPlan();
const [whyExercise, setWhyExercise] = useState(null);
```

### Interactions
- Why? -> opens bottom sheet for that exercise
- Start Workout -> creates workout_session in DB, navigates to workout/active
- Back -> home

---

## 7.6 Custom Workout (Quick Log)
**File**: `app/workout/custom.tsx`

For users who want to log their own workout instead of following AI.

### Layout:
- Header: "Custom Workout" + back
- Workout name input (editable, default: "Custom Workout")
- Exercise list (starts empty)
- [+ Add Exercise] button -> opens ExerciseSearch
  - Search bar (text input, filters exercise DB)
  - Categorized results (by muscle group)
  - Tap exercise -> adds to workout with default sets/reps
- Each added exercise shows:
  - Name + muscle label
  - Editable sets count (stepper: -, 3, +)
  - Target reps (editable)
- [Start Workout] button (once at least 1 exercise added)

### State
```typescript
const [name, setName] = useState('Custom Workout');
const [exercises, setExercises] = useState<CustomExercise[]>([]);
const [searchOpen, setSearchOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
```

---

## 7.7 Active Workout Session
**File**: `app/workout/active.tsx`

**THE most critical screen for UX. Must be buttery smooth.**

### Layout:
- Header: Exercise counter "3/6" + [End] button (red text)
- Progress bar (dots for each exercise, filled = complete)
- Current exercise name (26pt, bold, centered)
- Muscle + Equipment label (14pt, gray)
- Previous performance text: "Last time: 185 x 8, 8, 7" (small, dim)

**Rest Timer** (conditional, shown between sets):
- Large countdown: "1:30" (44pt, green, bold)
- Circular progress ring (optional, nice-to-have)
- [Skip Rest] button

**Set Rows** (for current exercise):
Each set row contains:
```
[ Set 1 ]  [ 185 lbs ]  [ 8 reps ]  [ Complete ]
```
- Set number (with status: pending gray circle, completed green check)
- Weight field: pre-filled from AI target or last session, tappable to edit
- Reps field: pre-filled, tappable to edit
- Complete button: checkmark, turns green on tap

**Bottom button**: [Complete Set] (primary)
- On tap: marks current set done, starts rest timer, advances to next set
- If last set of last exercise: [Finish Workout] -> summary

### State (Zustand + MMKV persistence)
```typescript
interface WorkoutStore {
  sessionId: string | null;
  exercises: ActiveExercise[];
  currentExIndex: number;
  currentSetIndex: number;
  completedSets: Record<string, { weight: number; reps: number }>;
  restSeconds: number;
  isResting: boolean;
  startedAt: Date | null;

  startSession: (plan: WorkoutPlan) => void;
  logSet: (weight: number, reps: number) => void;
  skipRest: () => void;
  finishWorkout: () => Promise<WorkoutSummary>;
}
```

### Set Logging Flow (2 taps)
1. Weight + reps are pre-filled. User can adjust if needed.
2. User taps [Complete Set].
3. Set is marked done with haptic feedback (expo-haptics medium impact).
4. Rest timer auto-starts (duration based on exercise type).
5. When rest ends (or user skips), next set is highlighted.
6. When all sets for an exercise are done, auto-advance to next exercise.
7. When all exercises done, navigate to summary.

### Offline Resilience
After EVERY set completion, persist the full workout state to MMKV:
```typescript
import { MMKV } from 'react-native-mmkv';
const storage = new MMKV();

// After each set
storage.set('active_workout', JSON.stringify(workoutStore.getState()));

// On app launch, check for unfinished workout
const saved = storage.getString('active_workout');
if (saved) {
  // Prompt: "You have an unfinished workout. Resume?"
}
```

### Rest Timer Durations
| Exercise Type | Rest (seconds) |
|--------------|----------------|
| Main compound (squat, bench, deadlift, OHP) | 180 |
| Secondary compound (rows, lunges, dips) | 120 |
| Isolation (curls, lateral raises, extensions) | 75 |

---

## 7.8 Workout Summary
**File**: `app/workout/summary.tsx`

### Layout:
- Celebration emoji (large, centered)
- "Workout Complete!" (26pt, bold)
- Workout name (15pt, secondary)
- Stats grid (2x2):
  - Duration (e.g., "54 min")
  - Total Volume (e.g., "21,450 lbs")
  - Exercises completed
  - Sets completed
- PR Alert card (conditional, only if PRs detected):
  - Trophy emoji + "New Personal Record!"
  - Exercise name + new e1RM
  - Haptic celebration + confetti animation
- Strength Score Update card (if any Big 3 were performed):
  - Previous score -> New score (animated counter)
- Streak Update: "5 Day Streak!" or "Streak started!"
- [Back to Home] button

### On Completion (background calculations):
1. Calculate total volume, duration, set/exercise counts
2. For each exercise: check if any set is a new e1RM PR
3. Update muscle_fatigue table (set recovery to 0% for trained muscles, with volume data)
4. Update strength_history if Big 3 were performed
5. Update profile: total_workouts++, streak logic
6. Sync all set_logs to Supabase
7. Clear MMKV active workout cache

---

## 7.9 Training History
**File**: `app/(tabs)/history.tsx`

### Layout:
- Header: "History"
- Stats row (3 cards): Total Workouts | Week Streak | PRs This Month
- FlatList of past sessions:
  - Green checkmark icon
  - Session name (bold)
  - Date + Duration + Volume (secondary)
  - PR badge (if any PRs in that session)
- Tap -> history/[id]
- Infinite scroll (load 20 at a time)
- Pull to refresh

---

## 7.10 Session Detail
**File**: `app/history/[id].tsx`

### Layout:
- Header: "Session Detail" + back
- Session name (22pt, bold)
- Date + Duration + Volume (secondary)
- For each exercise in the session:
  - Exercise name (16pt, bold) + PR badge
  - Set rows: "Set 1: 185 lbs x 8" for each set

---

## 7.11 Strength Tracker
**File**: `app/(tabs)/strength.tsx`

### Layout:
- Header: "Strength"
- Total Score card:
  - Large number (42pt)
  - Change indicator (green pill)
- 3 LiftCards (Squat, Bench, Deadlift):
  - Lift name
  - Current e1RM (large, bold)
  - "Based on 275 x 6 on Mar 7" (how it was calculated)
  - Change from last month
- Progress Chart:
  - Line chart showing strength score over time (last 30/60/90 days)
  - Toggleable between total score, individual lifts
  - Use a simple line chart (recharts via react-native-svg, or Victory Native)
- If no data: "Log a squat, bench press, or deadlift to start tracking your strength."

### State
```typescript
const { score, squat, bench, deadlift, history } = useStrength();
const [chartPeriod, setChartPeriod] = useState<'30d' | '60d' | '90d'>('30d');
```

---

## 7.12 Profile & Settings
**File**: `app/(tabs)/profile.tsx`

### Layout:
- Avatar (initials in green gradient circle) + Name + "Since Mar 2026"
- Stats row: Score | Workouts | Streak
- Settings list (tappable rows):
  - Program Style (current value shown) -> modal to change
  - Days/Week -> modal
  - Equipment -> modal
  - Body Stats (height/weight) -> modal
  - Notifications (toggle)
  - Units (lbs/kg toggle)
- [Sign Out] button (red text)

---

# 8. AI WORKOUT ENGINE

## Edge Function: generate-workout

```typescript
// supabase/functions/generate-workout/index.ts

const PROGRAM_TEMPLATES = {
  ppl: {
    rotation: ['push', 'pull', 'legs', 'push', 'pull', 'legs', 'rest'],
    description: 'Push/Pull/Legs split',
  },
  upper_lower: {
    rotation: ['upper', 'lower', 'rest', 'upper', 'lower', 'rest', 'rest'],
    description: 'Upper/Lower split',
  },
  aesthetic: {
    rotation: null,
    description: 'AI-optimized for aesthetics',
  },
  ai_optimal: {
    rotation: null,  // AI decides based on fatigue
    description: 'AI determines optimal split',
  },
};

// System prompt for Claude
const SYSTEM = `You are Pumped's workout AI. Generate a single workout session.

RULES:
1. Select exercises ONLY from the provided database (by ID).
2. Respect the program template and today's target muscle groups.
3. Never heavily target a muscle below 40% recovery.
4. Apply progressive overload: if the user hit all target reps last session, suggest +5lbs (upper) or +10lbs (lower).
5. For EVERY exercise, write a "why" explanation (2-3 sentences) connecting it to the user's program, recovery state, and progression.
6. Return ONLY valid JSON. No markdown, no commentary.

JSON format:
{
  "name": "Upper Body - Push",
  "type": "push",
  "estimated_minutes": 55,
  "exercises": [
    {
      "exercise_id": "uuid",
      "name": "Barbell Bench Press",
      "sets": 4,
      "target_reps": "6-8",
      "target_weight": 185,
      "rest_seconds": 180,
      "order": 1,
      "why": "Your chest is 85% recovered and bench press is your primary horizontal push. Last session you hit 180x8 for all sets, so we're progressing to 185. This compounds with the incline work coming next."
    }
  ]
}`;
```

The user prompt includes: profile data, fatigue map, last 7 days of training history, exercise database (filtered by available equipment), and program template.

---

# 9. MUSCLE FATIGUE ENGINE

```typescript
// utils/recoveryModel.ts

const RECOVERY_HOURS: Record<string, number> = {
  quads: 84, glutes: 84, lats: 84,           // ~3.5 days
  hamstrings: 60, chest: 60, traps: 60,       // ~2.5 days
  front_delts: 48, side_delts: 48, rear_delts: 48,
  triceps: 48, biceps: 48,                    // ~2 days
  forearms: 36, abs: 36, calves: 36,          // ~1.5 days
};

export function calculateRecovery(muscle: string, lastTrainedAt: Date, volumeLoad: number): number {
  const hoursElapsed = (Date.now() - lastTrainedAt.getTime()) / 3600000;
  const baseHours = RECOVERY_HOURS[muscle] || 60;
  const adjusted = baseHours * (1 + volumeLoad * 0.00005);
  const pct = Math.min(100, (1 - Math.exp(-3 * hoursElapsed / adjusted)) * 100);
  return Math.round(pct);
}
```

After each workout completes, for every muscle trained:
1. Set `last_trained_at` to now
2. Calculate volume load (sum of weight * reps for all sets targeting that muscle, secondaries at 50%)
3. Set `recovery_pct` to 0 (just trained)
4. Store volume_load for the recovery curve calculation

The body map re-renders by calling `calculateRecovery()` for each muscle on every home screen visit.

---

# 10. PROGRESSIVE OVERLOAD ENGINE

```typescript
// utils/progression.ts

export function getProgression(exerciseId: string, recentSets: SetLog[]): {
  weight: number; reps: string; reason: string;
} {
  if (recentSets.length === 0) return { weight: 0, reps: '8-10', reason: 'No history. Start light.' };

  const lastSession = recentSets.filter(s => s.completed && !s.is_warmup);
  const allRepsHit = lastSession.every(s => s.actual_reps! >= s.target_reps!);
  const lastWeight = lastSession[0]?.actual_weight || 0;

  if (allRepsHit) {
    const bump = lastWeight >= 100 ? 5 : 2.5;  // Smaller bumps for lighter exercises
    return {
      weight: lastWeight + bump,
      reps: `${lastSession[0].target_reps}`,
      reason: `You hit all target reps last time. Adding ${bump} lbs.`,
    };
  }

  return {
    weight: lastWeight,
    reps: `${lastSession[0].target_reps}`,
    reason: 'Working to hit all target reps before increasing weight.',
  };
}
```

---

# 11. STRENGTH SCORE

```typescript
// utils/epley.ts
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

// Strength Score = best e1RM(squat) + best e1RM(bench) + best e1RM(deadlift)
// "Best" = highest e1RM from any logged set in the last 90 days
```

---

# 12. STREAK SYSTEM

```typescript
// Logic runs on workout completion:

function updateStreak(profile: Profile, workoutDate: Date): {
  newStreak: number;
  isNewRecord: boolean;
} {
  const today = startOfDay(workoutDate);
  const yesterday = subDays(today, 1);
  const lastWorkoutDate = profile.last_workout_date ? startOfDay(profile.last_workout_date) : null;

  if (!lastWorkoutDate) {
    // First ever workout
    return { newStreak: 1, isNewRecord: true };
  }

  if (isSameDay(lastWorkoutDate, today)) {
    // Already worked out today, streak unchanged
    return { newStreak: profile.current_streak_days, isNewRecord: false };
  }

  if (isSameDay(lastWorkoutDate, yesterday)) {
    // Consecutive day - extend streak
    const newStreak = profile.current_streak_days + 1;
    return { newStreak, isNewRecord: newStreak > profile.longest_streak_days };
  }

  // Streak broken - reset to 1
  return { newStreak: 1, isNewRecord: false };
}
```

Push notification: If it's 7pm and the user hasn't logged a workout today but has an active streak, send: "Don't break your [X] day streak! You've got this."

---

# 13. CURSOR BUILD PROMPTS

## Prompt 1: Scaffold
```
Create an Expo project with expo-router and TypeScript. Set up (auth) and (tabs) route groups.
Install: react-native-svg, react-native-reanimated, @supabase/supabase-js, zustand, react-native-mmkv, expo-haptics, @gorhom/bottom-sheet, date-fns.
Create utils/theme.ts with these exact colors: bg.primary=#0A0A0F, bg.card=#151520, accent.primary=#4ADE80, text.primary=#F5F5F5, text.secondary=#9CA3AF, recovery.ready=#4ADE80, recovery.moderate=#FACC15, recovery.fatigued=#EF4444.
Create placeholder screens for all routes. Root layout should check auth state and redirect accordingly.
Dark theme only. No light mode.
```

## Prompt 2: Auth + Database
```
Set up Supabase client using expo-secure-store for token persistence.
Create useAuth hook with email signup, email signin, Apple signin, and signout.
Create Zustand auth store.
Write SQL migrations for: profiles, exercises, workout_sessions, set_logs, muscle_fatigue, strength_history, ai_workout_plans.
Use the exact schemas from the spec (I'll paste them).
All tables have Row Level Security so users can only access their own data.
```

## Prompt 3: Onboarding
```
Build the 3-step onboarding screen at app/(auth)/onboarding.tsx.
Step 1: gender (3 buttons), age, height, weight inputs.
Step 2: program style (4 cards: PPL purple, Upper/Lower blue, Aesthetic pink, AI Optimal green), days/week selector (pill buttons), equipment selector.
Step 3: optional quick strength log (squat/bench/deadlift weight+reps).
Progress bar shows 3 steps. On completion, save to Supabase profiles table, initialize fatigue at 100% for all 14 muscles, calculate e1RMs if entered, navigate to home.
Dark theme, cards with 1px border, green accent on selections.
```

## Prompt 4: Home Screen + Body Map
```
Build the home screen at app/(tabs)/index.tsx with:
1. Top bar: "PUMPED" logo (P in green) + streak badge
2. TodayCard: shows AI workout name, exercise count, duration, program tag. Tappable -> workout/preview. Below: "or log a custom workout" link.
3. StrengthScoreCard: large score number, squat/bench/deadlift breakdown, weekly change pill.
4. BodyMap: SVG component with front+back body views. 14 muscle regions color-coded by recovery %. Tap muscle -> @gorhom/bottom-sheet showing name, recovery %, last trained, status.
5. QuickStats: 3 small cards (total workouts, this week progress, PRs this month).
Fetch data from Supabase on focus. Calculate recovery using exponential decay model.
```

## Prompt 5: Workout Flow
```
Build 4 screens: workout/preview.tsx, workout/custom.tsx, workout/active.tsx, workout/summary.tsx.

Preview: shows AI plan exercises with number badges, sets/reps/weight, "Why?" button opening bottom sheet with AI explanation.

Custom: empty workout builder, [+Add Exercise] opens search over exercise DB, add exercises with configurable sets.

Active: THE critical screen. Current exercise name, set rows (weight+reps pre-filled, tappable to edit), [Complete Set] button with haptic. Rest timer auto-starts between sets (180s compounds, 75s isolation). Previous performance shown ("Last: 185x8,8,7"). Progress dots for exercises. Persist state to MMKV on every set completion for crash recovery.

Summary: celebration screen, stats grid (duration/volume/exercises/sets), PR detection with trophy card, strength score animation, streak update, [Back to Home].

On completion: update muscle_fatigue, calculate PRs, update strength_history, increment total_workouts, update streak.
```

## Prompt 6: History + Strength
```
Build history screen: stats row (workouts/streak/PRs), FlatList of past sessions (name, date, duration, volume, PR badge), infinite scroll, tap -> detail screen showing per-exercise per-set data.

Build strength screen: total score card (large number + change), 3 LiftCards (squat/bench/deadlift e1RM with "based on" text), line chart showing score over 30/60/90 days. Use react-native-svg or Victory Native for the chart.
```

## Prompt 7: AI Edge Function
```
Create Supabase Edge Function at supabase/functions/generate-workout/index.ts.
It receives: user profile, fatigue map, recent 7-day history, exercise database, program template.
Constructs a Claude API prompt that:
- Follows the user's program rotation (PPL, upper/lower, etc)
- Respects muscle recovery (no heavy work on <40% muscles)
- Applies progressive overload from history
- Generates "why" explanations for each exercise
Returns structured JSON workout plan.
Store the plan in ai_workout_plans table.
Client calls this via supabase.functions.invoke('generate-workout').
```

---

# 14. BUILD ORDER

| Phase | What | Days |
|-------|------|------|
| 1 | Project scaffold, theme, navigation, placeholders | 1 |
| 2 | Supabase setup, auth, profile storage | 1 |
| 3 | Onboarding (3-step) | 1-2 |
| 4 | Home screen with body map (mock data first) | 2 |
| 5 | Workout flow: preview, active session, summary | 3 |
| 6 | Custom workout builder + exercise search | 1 |
| 7 | Connect real data: fatigue calc, progression, e1RM | 2 |
| 8 | AI Edge Function + workout generation | 1-2 |
| 9 | History + session detail | 1 |
| 10 | Strength tracker + chart | 1 |
| 11 | Profile + settings | 0.5 |
| 12 | Streaks + push notifications | 0.5 |
| 13 | Polish: animations, haptics, offline sync, error states | 2 |
| 14 | Testing + bug fixes | 2 |
| **Total** | | **~3 weeks** |

---

# IMPLEMENTATION STATUS (Agent Handoff — March 2026)

Use this section so an agentic IDE can pick up exactly where development left off.

## Program styles (only 4)
- **Valid values**: `ppl`, `upper_lower`, `aesthetic`, `ai_optimal`. No `bro_split` or `full_body`.
- Migration `008_program_style_four_only.sql` migrates existing profiles and enforces the CHECK.

## Date handling (timezone-safe)
- **Session date when logging**: Use `getLocalDateString()` from `utils/date.ts` so the stored date is the user's **local calendar day**, not UTC. Used in: `app/workout/log.tsx`, `app/workout/custom.tsx`, `app/speedlog/editor.tsx`, `app/cardio/log.tsx`.
- **Displaying dates**: Use `parseLocalDate(dateStr)` from `utils/date.ts` when formatting `workout_sessions.date` (e.g. in Past Workouts, history detail). Avoid `new Date(dateStr)` for `yyyy-MM-dd` — it parses as UTC midnight and shifts in some timezones.
- **Speed Log for a specific day**: Home screen passes `logForDate: format(selectedDate, 'yyyy-MM-dd')`; editor reads it and uses that date for the created session.

## Schedule and RoutineTimeline
- **Shared logic**: `utils/schedule.ts` — `getWorkoutDayIndices(trainingFrequency)`, `getWorkoutTypeForDate(programStyle, date, trainingFrequency)`.
- **RoutineTimeline**: `components/home/RoutineTimeline.tsx`. Week starts Monday (`startOfWeek(..., { weekStartsOn: 1 })`). Today's node only is filled green; checkmarks only on **past** logged days (`isPast && wasLogged`).

## Past Workouts (Workouts tab)
- **File**: `app/(tabs)/workouts.tsx`. Fetches completed sessions (e.g. limit 500), **excludes** rows where `is_rest_day === true` so only real workouts/cardio appear. Rendered with `.map()` inside ScrollView (no nested VirtualizedList).
- **Date display**: `format(parseLocalDate(w.date), 'MMM d')`.

## Workout names
- **AI-generated name**: When the user does not set a name (or uses a generic placeholder), use `generateWorkoutNameFromExercises(exercises)` from `utils/workoutName.ts` and save that as `session.name`. Used in `app/workout/log.tsx` and `app/speedlog/editor.tsx`.

## Multiple sessions per day
- Home screen and history support **multiple** completed sessions per calendar day. `sessionsForSelectedDate` is an array; each gets a card with "View Workout". If user logged rest day then a workout on the same day, only the workout appears in Past Workouts (rest overridden).

## Duration input
- **Component**: `components/ui/DurationInput.tsx` — two text fields (Hours, Minutes). Replaces the wheel-based DurationPicker in workout log and Speed Log editor.

## Muscle fatigue and historical view
- **Today**: `fatigueMap` from `useFatigue()`; `refreshFatigue()` on screen focus.
- **Past day**: `getHistoricalFatigueMap(userId, selectedDate)` in `services/fatigue.ts` recomputes recovery from all sessions/set_logs up to that date. BodyMap and MuscleDetailSheet use this map when a past day is selected.
- **Future day**: Body map and detail sheet receive empty map.

## Key file reference
| Purpose | Path |
|--------|------|
| Home / Today | `app/(tabs)/index.tsx` |
| Workouts tab (Past Workouts) | `app/(tabs)/workouts.tsx` |
| Session detail | `app/history/[id].tsx` |
| Speed Log entry, editor | `app/speedlog/index.tsx`, `app/speedlog/editor.tsx` |
| Schedule logic | `utils/schedule.ts` |
| Date parsing/formatting | `utils/date.ts` |
| Workout name from exercises | `utils/workoutName.ts` |
| Historical fatigue | `services/fatigue.ts` → `getHistoricalFatigueMap` |
| Streak | `services/streak.ts` → `calculateStreak`, `updateProfileStreak` |

---

*End of Technical Specification v2.0*
*Pumped MVP - Focused Core*
