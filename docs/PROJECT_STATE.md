## Pumped App – Current Project State

This document describes the **current** Pumped app implementation, based solely on the code in this repository. It is meant as a handoff for another developer/agent.

---

## 1. Navigation Structure

### 1.1 Root navigation

- **Root layout** (`app/_layout.tsx`)
  - Uses Expo Router `Stack` with groups:
    - `"(auth)"`: unauthenticated / onboarding flow
    - `"(tabs)"`: main authenticated tabbed experience
    - `"workout"`: stack for AI/custom workout flows
    - `"speedlog"`: modal stack for quick logging and saving templates
    - `"history"`: stack for viewing/editing completed sessions
  - Uses `useAuth` + `useAuthStore`:
    - If no session and not in `"(auth)"`, redirects to `"/(auth)/welcome"`.
    - If logged in and onboarding incomplete (`profile.onboarding_completed === false`), forces `"/(auth)/onboarding"`.
    - When onboarding complete, redirects to `"/(tabs)"`.

### 1.2 Auth stack

- **Layout** (`app/(auth)/_layout.tsx`)
  - Simple `Stack` with hidden headers and dark background.

- **Screens**
  - `welcome.tsx` – **WelcomeScreen**
    - Brand splash, tagline, and two buttons:
      - "Get Started" → `/(auth)/signup`
      - "I have an account" → `/(auth)/signin`
  - `signin.tsx` – **SignInScreen**
    - Email/password sign-in via `useAuth().signIn`.
    - Apple OAuth sign-in via `supabase.auth.signInWithOAuth('apple')` and Expo WebBrowser.
  - `signup.tsx` – **SignUpScreen**
    - Email/password sign-up via `useAuth().signUp`.
    - Local success message when completed.
    - Apple sign-in button as an alternative path.
  - `onboarding.tsx` – **OnboardingScreen**
    - Three-step wizard for user profile:
      1. **About You**: gender, age, height (ft/in), weight (lbs).
      2. **Training Style**: program style (PPL / Upper Lower / Aesthetic / AI Optimal), days per week, equipment access.
      3. **Quick Strength Check**: optional 1RM for squat/bench/deadlift; uses Epley (`utils/epley`) for e1RM and `strengthScore`.
    - On completion:
      - Updates `profiles` row (gender, age, height_inches, weight_lbs, program_style, training_frequency, equipment_access, squat_e1rm, bench_e1rm, deadlift_e1rm, strength_score, onboarding_completed).
      - Calls `initializeFatigue(userId)` to seed `muscle_fatigue`.
      - Optionally upserts into `strength_history`.
      - Refreshes profile in `authStore` and redirects to `/(tabs)`.

### 1.3 Tabs layout

- **Layout** (`app/(tabs)/_layout.tsx`)
  - `Tabs` with hidden headers, 4 visible tabs:
    - `index` – "Today" (home)
    - `progress` – "Progress"
    - `workouts` – "Workouts"
    - `profile` – "Profile"
  - Hidden/legacy tabs (`href: null`): `history`, `strength`.

### 1.4 Stacks under tabs

- **History stack** (`app/history/_layout.tsx`): simple `Stack`, no header (for `history/[id].tsx`).
- **Workout stack** (`app/workout/_layout.tsx`): `Stack` for `preview`, `log`, `active`, `summary`, `custom`, `modifications`.
- **Speed Log stack** (`app/speedlog/_layout.tsx`): `Stack` presented as modal for Speed Log flow.
- **Cardio stack** (`app/cardio/_layout.tsx`): `Stack` for cardio logging (currently only `cardio/log.tsx`).

---

## 2. Screens (app/)

### 2.1 Today tab (`app/(tabs)/index.tsx` – TodayScreen)

**Purpose**: The main dashboard for the current/past/future days, AI plans, logged sessions, and muscle readiness.

Key behavior:
- Uses `useAuthStore` and `useFatigue`.
- Loads and keeps in sync:
  - Profile (via Supabase `profiles`).
  - Weekly workout days (completed and rest via `workout_sessions`).
  - Cached AI workout plan for today (`getTodaysPlan` from `services/ai`).
  - Historical fatigue via `getHistoricalFatigueMap`.
  - Streak via `updateProfileStreak`.
- Calendar strip for current week:
  - Highlights today, shows activity dots for logged workouts/rest/cardio.
  - Tapping a day changes `selectedDate` and reloads sessions for that day.
- AI workout card for **today**:
  - If non-rest today:
    - If `cachedPlan` exists → "View Workout" opens `workout/preview`.
    - Otherwise → "Generate Workout" navigates to `workout/modifications`.
  - Always shows "Speed Log" button to open the Speed Log flow for the selected date.
- For rest (Active Recovery) day:
  - If AI plan exists and not yet logged, shows card to "View Workout".
  - Shows Active Recovery card with recommendations and buttons to Generate Workout or Speed Log.
- Past days:
  - Shows "Workouts Completed" list of sessions from `workout_sessions` for that date; each entry links to `/history/[id]`.
- Muscle Readiness card:
  - Uses `BodyMap` to show fatigue-based recovery for today or a past date.
- Quick Stats (today only):
  - Workouts (from `profile.total_workouts`), Streak, and Week completion vs training frequency using weekly workout days.
- Uses `RoutineTimeline` at the bottom to visualize this week's plan and which days have activity.

### 2.2 Progress tab (`app/(tabs)/progress.tsx` – ProgressScreen)

**Purpose**: Analytics and insights view showing workout streak, volume, strength, and muscle distribution.

Key behavior:
- Inputs:
  - `session` & `profile` from `useAuthStore`.
- Local state:
  - `insights`, `big3`, volume chart (`volumeData`), `muscleDistribution`, `suggestions`, `totalWorkouts`.
- Data loading (`fetchData`):
  - `generateInsights(userId)` – high-level volume and fatigue insights.
  - `getBig3(userId)` – best squat/bench/deadlift from sessions, manual entries, and profile.
  - `calculateMuscleDistribution(userId, distributionPeriod)` – volume per muscle.
  - `getVolumeChartData(userId, volumePeriod)` – daily/weekly/monthly volume plus total.
  - Counts `workout_sessions` where the user is owner, `completed = true`, `is_rest_day = false` for `totalWorkouts` (matches Past Workouts "All").
- Auto-refresh:
  - On mount and whenever screen gains focus (`useFocusEffect`).
- UI:
  - Top stats: **Workouts**, **Streak**, **Lbs total/Kg total** (volume total for current `volumePeriod`, default week).
  - Insights list: gating on at least 5 workouts; otherwise shows unlock card.
  - Suggestions: up to 5 text tips tailored to volume, balance, streak, fatigue.
  - Big 3 card: overall strength score and detailed lifts if data exists, else empty state.
  - Volume:
    - Period toggle: Week / Month / Year.
    - Big total value + bar chart with tap-to-see exact volume.
  - Muscle Distribution:
    - Period toggle: This week / This month / All time.
    - Bar list with bottom 3 highlighted as needing more work.

### 2.3 Workouts tab (`app/(tabs)/workouts.tsx` – WorkoutsScreen)

**Purpose**: History and saved workout templates.

Key behavior:
- Loads **past workouts** for current user from `workout_sessions`:
  - `completed = true`, sorted newest first.
  - Filters out rest days (`!is_rest_day`).
  - `PastFilter` options: Today / This Week / This Month / All; filtered by `date-fns` ranges.
- Shows each past workout with:
  - Name, date, duration (minutes), compact volume, PR badge if any, and arrow.
  - Tapping opens `/history/[id]`.
- **Saved workouts**:
  - Loads `saved_workouts` for the user, displays name, exercise count, and "last used" text with `formatDistanceToNow`.
  - Tapping a saved workout opens `speedlog/editor` with `type` param.
  - Inline trash button deletes saved template row.
- Actions:
  - "Create Custom Workout" card → `/workout/custom`.
  - "Import Workouts" section: placeholder card with COMING SOON.

### 2.4 Profile tab (`app/(tabs)/profile.tsx` – ProfileScreen)

**Purpose**: User profile, program settings, and summary stats.

Key behavior:
- Reads `profile` and `session` from auth stores plus `useAuth` actions.
- Local state:
  - Current editing modal (`editingField`).
  - Draft display name and body stats.
  - Avatar upload state.
  - Computed weekly volume total and precise workout count via Supabase (`volumeTotal`, `workoutCount`).
- Stats at top:
  - **Workouts** – computed count of `workout_sessions` where `completed = true`, `is_rest_day = false` (refreshed on mount + focus).
  - **Streak** – `profile.current_streak_days`.
  - **Lbs total / Kg total** – formatted weekly volume from `getVolumeChartData(userId, 'week')`, using `formatVolumeWithUnit(...).replace(" units")`.
- Settings cards:
  - Program Style – selection of program style from `PROGRAM_STYLES`; update writes to `profiles` and optionally shows confirmation.
  - Days / Week – sets `training_frequency` and triggers program confirmation.
  - Equipment – selects `equipment_access`.
  - Body Stats – height (converted inches ↔ cm based on units), weight, manual 1RMs; updates corresponding profile fields.
  - Units – toggles `units` between `lbs / ft-in` and `kg / cm`.
- Avatar upload:
  - Uses `expo-image-picker`.
  - Uploads to Supabase Storage bucket `avatars`, stores `avatar_url` on profile.
- Sign out button:
  - Calls `useAuth().signOut()`, which clears auth session and resets workout store.
- Auto-refresh of volume/workout counts:
  - `refreshStats` invoked on mount and on focus via `useFocusEffect`.

### 2.5 History list + details

- **History list tab** (`app/(tabs)/history.tsx`)
  - (Kept but hidden in tab bar). Likely an older history UI (contents not fully used now).

- **Session detail** (`app/history/[id].tsx` – SessionDetailScreen)
  - Fetches `workout_sessions` record and associated `set_logs` via `services/workouts`.
  - Groups sets by `exercise_order` using `groupSetsByExercise`.
  - Shows:
    - Workout name, date, duration, volume, exercise/set counts.
    - PR badges for sets that have `is_pr`.
    - Card for each exercise with per-set details (weight × reps or seconds).
    - Indicators for rest or cardio sessions.
  - Actions:
    - Edit (name/duration) → `updateSession`.
    - Delete:
      - Confirms; then `deleteSession(id)` removes session and cascades set logs.
      - On success, simply returns to previous screen (Today/Workouts refetch on focus).

### 2.6 Workout flows (`app/workout/*.tsx`)

#### 2.6.1 `workout/preview.tsx` – WorkoutPreviewScreen

**Purpose**: Show today's generated AI plan before logging; allow save/regenerate.

Key behavior:
- Loads AI plan via `getTodaysPlan(userId)` when mounted (`plan` state).
- If loading: shows full-screen spinner.
- If no `plan`:
  - Shows empty state with "No workout planned", buttons to go back to Today or log custom workout (`/workout/custom`).
- If `plan` exists:
  - Header:
    - Back arrow.
    - Title: "Today's Workout".
    - Right actions: **Done** (returns to tabs) and **Save** (writes a row to `saved_workouts` with plan name, type, and `{name, sets}` per exercise).
  - Body:
    - Workout name, description, primary target chips, tags: exercise count, estimated time, program style.
    - Exercise cards: numbered, showing sets / reps / optional seconds / weight plus `Why?` button that opens a modal with AI reasoning and tags.
  - Footer:
    - "Log This Workout" → `/workout/log`.
    - "Regenerate" (was "Customize Workout") – prompts about generation credits, then opens `/workout/modifications`.

#### 2.6.2 `workout/log.tsx` – WorkoutLogScreen

**Purpose**: Structured log form for AI-generated workout; creates completed session & set logs.

Key behavior:
- On mount:
  - Fetches `getTodaysPlan(userId)` and full `exercises` list.
  - Transforms plan to `LogExercise[]`:
    - For each exercise, determines whether time-based or weight-based via `utils/exerciseUtils`.
    - Initializes sets with sensible defaults (e.g., target weight, reps, or time).
- Lets user:
  - Edit workout name.
  - Set duration using `DurationInput`.
  - Add/remove sets and exercises.
  - Edit per-set data via modal (weight+reps or seconds).
- On "Complete Workout":
  - Creates `workout_sessions` row via `createSession`.
  - Builds `set_logs`:
    - Derives whether to use weight or seconds using `showWeightInput` and `showSecondsInput`.
  - Calls `insertSetLogs`, `completeSession` with final counts & volume.
  - Calls `applyWorkoutFatigue` and `recordWorkoutStrain` to update fatigue and strain logs.
  - Increments `profiles.total_workouts` and updates streak via `updateProfileStreak`.
  - Marks today’s `ai_workout_plans` as `used = true`.
  - Opens a **Save Workout** modal:
    - Preview of up to 5 exercises, uses `saved_workouts` table to store template.
    - "Save Workout" stores `{ name, workout_type, exercises: [{name, sets}], last_used_at, use_count }`.
    - "Skip" goes straight to `workout/summary` with `sessionId` query param.

#### 2.6.3 `workout/summary.tsx`

**Purpose**: Post-workout summary screen (volume, exercises, streak, etc.).  
Details: It reads `sessionId` and summarizes metrics (volume, duration, contributions) for that workout and shows navigation back to Today / Workouts.

#### 2.6.4 `workout/custom.tsx`

**Purpose**: Create and log a fully custom strength workout (manual exercises/sets) outside of AI workflow.

Key behavior:
- Allows selecting exercises from `exercises` table, editing sets and reps/weight/seconds similarly to AI log.
- On completion:
  - Writes `workout_sessions` and `set_logs`.
  - Applies fatigue and strain same as AI logs.

#### 2.6.5 `workout/modifications.tsx` – ModificationsScreen

**Purpose**: Collect natural-language modifications and regenerate AI workout.

Key behavior:
- Prefetches:
  - Fatigue (`useFatigue.refreshFatigue`).
  - All exercises via `services/exercises`.
  - Last 7 days of completed workout sessions (name, date, volume) from `workout_sessions`.
- Shows:
  - Text area for modifications (e.g., "light recovery day, no barbell").
  - Suggestion pills for common tweaks (quick workout, no lower back, etc.).
  - Generation credits remaining (via `getGenerationCreditsRemaining(profile)` plus `DAILY_LIMIT`).
- When user taps "Generate Workout" (with or without modifications):
  - Validates:
    - Profile present, exercises loaded, credits remaining > 0.
  - Requests latest readiness (`getBodyMapReadiness` from fatigue service).
  - Builds `generateWorkout` payload:
    - Profile subset, fatigue map, recentHistory, trimmed exercise list, modifications, and `planDayOfWeek`.
  - Calls Edge Function `generate-workout` (via `services/ai.generateWorkout`).
  - On success:
    - Saves plan to `ai_workout_plans` via `savePlanToCache`.
    - Consumes generation credit.
    - Refreshes profile.
    - Redirects to `/workout/preview`.

#### 2.6.6 `workout/active.tsx`

**Purpose**: Active tracking UI for in-progress workouts based on `useWorkoutStore`.

Key behavior:
- Uses `useWorkoutStore` session data:
  - Exercises, current exercise and set indexes, rest countdown, completion checks.
- Provides:
  - Set-by-set logging flow: mark sets as complete, handle rest timers, move through exercises and sets.
  - UI for each exercise and its sets, including completed state.

### 2.7 Speed Log flow (`app/speedlog/*.tsx`)

#### 2.7.1 `speedlog/index.tsx`

**Purpose**: Starting screen for Speed Log quick logging.

Key behavior:
- Lets user pick a Speed Log template:
  - Types like push/pull/legs/upper/lower/cardio.
  - Navigates to `speedlog/editor` with query params for chosen type and date (optionally passed from Today).

#### 2.7.2 `speedlog/editor.tsx` – SpeedLogEditorScreen

**Purpose**: Very fast workout logging by type and approximate set counts.

Key behavior:
- Accepts params: `type` (e.g., Push, Pull, etc.) and optional `logForDate`.
- Pre-builds an exercise list for that type (using `exercises` table or saved presets) and set counts; user can adjust counts.
- On save:
  - Writes a `workout_sessions` row with simple metadata + aggregated volume.
  - Sets `is_rest_day` or `is_cardio` appropriately for cardio-type logs.
  - Navigates to a separate **Save template** step (`speedlog/save`).

#### 2.7.3 `speedlog/save.tsx` – SpeedLogSaveScreen

**Purpose**: Optional step to save a Speed Log-created workout as a reusable template.

Key behavior:
- Accepts query params: `type`, `workoutName`, `exerciseNames`, `exerciseSets`.
- Renders summary list of exercise names and set counts.
- On "Save Workout":
  - Inserts row into `saved_workouts` with `workout_type`, `exercises` JSON, `last_used_at`, and `use_count`.
  - Dismisses the modal stack 3 times to return to Today.
- On "Skip": simply dismisses back to Today.

### 2.8 Cardio flow (`app/cardio/log.tsx`)

**Purpose**: Log cardio-only sessions (time-based distance/duration) using `workout_sessions` and either `set_logs` or a cardio-specific schema.

Key behavior (high level):
- Allows selection of cardio exercise, setting duration/distance, and logs the session as cardio (`is_cardio = true`).

---

## 3. Components

### 3.1 `components/home/BodyMap.tsx`

**Purpose**: Visual front/back body diagram for Muscle Readiness.

- Takes `fatigueMap` entries and `onSelectMuscle` callback.
- Renders an SVG human outline with elliptical regions per muscle group.
- Color-coded using `getReadinessColor` and overlays interactive hotspots.
- Taps call `onSelectMuscle(muscle)` for use by `MuscleDetailSheet`.

### 3.2 `components/home/MuscleDetailSheet.tsx`

**Purpose**: Bottom sheet with details for a single muscle’s readiness.

- Props: `visible`, `muscle`, `fatigueMap`, `onClose`.
- Shows:
  - Muscle name, current recovery_pct with color-coded status.
  - Last trained date/time and time-since.
  - Volume last session and last strain score.
- Draggable to dismiss and uses `PanResponder` with animations.

### 3.3 `components/home/RoutineTimeline.tsx`

**Purpose**: Week timeline card summarizing scheduled workouts vs activity.

- Uses `getWorkoutTypeForDate` + `getDisplayWorkoutType` to compute labels for Mon–Sun.
- Marks:
  - Today (green filled node).
  - Days with logged activity (checkmark).
  - Rest days (dashed outline).

### 3.4 `components/ui/DurationInput.tsx`

**Purpose**: Inline 2-field duration input (hours/minutes).

- Converts `totalMinutes` to hours & minutes and vice versa.
- Clamps values to safe ranges and calls `onMinutesChange`.

### 3.5 `components/ui/DurationPicker.tsx`

**Purpose**: Scroll wheel-style duration picker.

- Two `ScrollView` columns for hours and minutes, snapping to discrete values.
- Shows combined label like `"1h 30m"` or `"30 min"`.
- Used in contexts where a more tactile duration control is needed.

---

## 4. Hooks

### 4.1 `hooks/useAuth.ts`

- Central auth + profile management:
  - Initializes session and profile from Supabase auth and `profiles`.
  - Subscribes to auth state changes.
  - Provides `signUp`, `signIn`, `signInWithApple`, `signOut`.
  - Integrates with `useAuthStore` and clears `useWorkoutStore` on sign-out.

### 4.2 `hooks/useWorkout.ts`

- Thin wrapper over `useWorkoutStore` to expose workout session state and actions.

### 4.3 `hooks/useFatigue.ts`

- Fetches fatigue map via `fetchFatigueMap`.
- Returns `fatigueMap`, `loading`, and `refreshFatigue`.

### 4.4 `hooks/useStreak.ts`

- Reads `profile` from `useProfileStore` and returns `streak` + `longestStreak`.

### 4.5 `hooks/useStrength.ts`

- Reads Big 3 fields (`squat_e1rm`, `bench_e1rm`, `deadlift_e1rm`, `strength_score`) from `useProfileStore`.

### 4.6 `hooks/useHistory.ts`

- Provides convenience utilities for working with workout history (e.g., caching, formatting).  
  (Implementation summarizes underlying operations on `services/workouts` and `supabase`.)

---

## 5. Stores (Zustand)

### 5.1 `stores/authStore.ts`

- State:
  - `session`: Supabase `Session` or null.
  - `profile`: `Profile` or null.
  - `initialized`: whether auth bootstrap finished.
  - `loading`: auth action loading state.
- Actions: `setSession`, `setProfile`, `setInitialized`, `setLoading`, `reset`.

### 5.2 `stores/workoutStore.ts`

- Holds an in-progress workout:
  - `sessionId`, `workoutName`, `source` (`ai_generated` or `custom`).
  - `exercises: ActiveExercise[]` including sets, rep targets, rest seconds, etc.
  - `currentExIndex`, `currentSetIndex`.
  - `completedSets: CompletedSet[]`.
  - `restSeconds`, `isResting`, `startedAt`.
- Persists to `utils/storage.saveActiveWorkout`.
- Methods:
  - `startSession(sessionId, name, source, exercises)`.
  - `logSet(weight, reps, seconds?)`: marks set complete, handles rest and exercise progression.
  - `advanceAfterRest`, `skipRest`, `setResting`.
  - `isSetCompleted`, `getCompletedSet`, `getAllExerciseComplete`.
  - `reset`: clears active workout and storage.

### 5.3 `stores/profileStore.ts`

- Lightweight store:
  - `profile: Profile | null`.
  - `setProfile(profile)`.
- Used by streak/strength hooks; separate from `useAuthStore` so that profile-enhanced views can be decoupled from auth initialization.

---

## 6. Services

### 6.1 `services/supabase.ts`

- Supabase client setup:
  - Uses `createClient` with Expo/React Native.
  - Custom `fetchWithTimeout` (15s).
  - Stores auth session in AsyncStorage.

### 6.2 `services/ai.ts`

- `generateWorkout(params)`:
  - Invokes Supabase Edge Function `generate-workout` using `fetch` rather than `supabase.functions.invoke` to capture full error bodies.
  - Auth:
    - Uses current Supabase access token when logged in, otherwise anon key.
  - Validates and returns `GeneratedWorkout` (plan-level plus `GeneratedExercise[]`).
- `getTodaysPlan(userId)`:
  - Fetches `ai_workout_plans` for the user/date.
  - Normalizes stored `exercises` JSON into `GeneratedWorkout`.
- `savePlanToCache(userId, plan)`:
  - Upserts `ai_workout_plans` row for today with full plan JSON and marks `used=false`.

### 6.3 `services/credits.ts`

- Manages daily AI generation credits on `profiles`:
  - `getGenerationCreditsRemaining(profile)`:
    - Ensures `generation_credits_remaining` is reset when `credits_reset_date < today`.
    - Returns remaining credits (default 3).
  - `consumeGenerationCredit(userId, currentRemaining)`:
    - Decrements and persists new remaining count.
  - `DAILY_LIMIT` = 3.

### 6.4 `services/workouts.ts`

- CRUD operations for logs:
  - `createSession(session: Partial<WorkoutSession>)` → inserts into `workout_sessions`, returns full row.
  - `completeSession(sessionId, updates)` → updates `completed=true`, `completed_at`, plus given fields.
  - `fetchSessions(userId, limit, offset)` → list recent completed sessions.
  - `fetchSessionById(sessionId)` → single session.
  - `fetchSessionSets(sessionId)` → `set_logs` for a session, ordered by `exercise_order` and `set_number`.
  - `insertSetLogs(sets)` → bulk insert `set_logs`.
  - `deleteSession(sessionId)` → deletes `workout_sessions` row (and cascades `set_logs`).
  - `updateSession(sessionId, updates)` → modify `name` and/or `duration_seconds`.

### 6.5 `services/fatigue.ts`

- Implements fatigue and readiness model on top of:
  - `muscle_fatigue` (legacy).
  - `muscle_strain_log` (current).
- Functions:
  - `fetchFatigueMap(userId)` – wrapper around `getBodyMapReadiness` for today.
  - `backfillMuscleStrainLog(userId)` – fills strain logs from past completed workouts.
  - `getBodyMapReadiness(userId, asOfDate)` – core readiness function used by BodyMap and AI:
    - Reads `muscle_strain_log` window for last 7 days.
    - If no logs yet, backfills from `workout_sessions` and `set_logs`.
    - Returns an array of per-muscle entries with `recovery_pct`, `last_trained_at`, `volume_load`, `last_strain_score`.
  - `initializeFatigue(userId)` – seeds `muscle_fatigue` rows for each defined `MUSCLE_GROUPS`.
  - `applyWorkoutFatigue(userId, contributions)` – legacy update for `muscle_fatigue` based on volume contributions.
  - `updateMuscleFatigue(userId, muscle, volumeLoad)` – one-off helper using `applyWorkoutFatigue`.
  - `getHistoricalFatigueMap(userId, asOfDate)` – readiness at end-of-day for a past date.
  - `recordWorkoutStrain(userId, sessionId, completedAt)` – computes strain per muscle from `set_logs` and writes to `muscle_strain_log`, including support for time-based (`actual_seconds`) and bodyweight exercises.

### 6.6 `services/exercises.ts`

- `fetchExercises()` – returns full `exercises` table sorted by name.
- `searchExercises(query)` – ILIKE search on exercise name.
- `fetchCardioExercises()` – filter by `movement_pattern = 'cardio'`.

### 6.7 `services/insights.ts`

- High-level progress analysis and suggestions:
  - `generateInsights(userId)`:
    - Uses last 30 days of completed, non-rest workouts and `set_logs` + `exercises` to:
      - Compute total and per-muscle volume; picks most/least trained muscle.
      - Detect push/pull imbalance.
      - Evaluate average workouts per week vs `profile.training_frequency`.
      - Incorporate `current_streak_days` and low-recovery muscles (via `fetchFatigueMap`).
  - `generateSuggestions(userId)`:
    - Builds 3–5 textual, actionable suggestions using:
      - Workout count, target days, streak, muscle imbalances, and fatigue.
    - Uses `EXERCISE_SUGGESTIONS_BY_MUSCLE` to recommend specific exercises.

### 6.8 `services/streak.ts`

- `calculateStreak(userId)`:
  - Computes current streak as consecutive days from today or yesterday backward where user has at least one completed, non-rest workout.
- `updateProfileStreak(userId)`:
  - Calls `calculateStreak`, updates `profiles.current_streak_days` and `longest_streak_days`.
  - Returns new streak/longest.

### 6.9 `services/strength.ts`

- `getBig3(userId)`:
  - Reads manual and profile 1RM values for squat/bench/deadlift.
  - Joins `exercises` flagged as big-three and `set_logs` to compute best estimated 1RMs via Epley.
  - Combines these to pick best sources for each lift and formats them for display (including "Based on X×Y" strings and dates).

### 6.10 `services/volume.ts`

- `calculateMuscleDistribution(userId, period)`:
  - Summarizes volume per muscle from `set_logs`, considering secondary muscles at 50% weight.
  - Period: current week, last 30 days, or all time.
- `getVolumeChartData(userId, period)`:
  - Aggregates `workout_sessions.total_volume` (non-rest) into:
    - Week: per-day bars; total is sum of week bars.
    - Month: 4 weekly buckets and total for days in current month.
    - Year: per-month bars for the current year and total.

---

## 7. Edge Functions

### 7.1 `supabase/functions/generate-workout/index.ts`

**Purpose**: AI workout generator using Anthropic Claude Sonnet.

Inputs (JSON from client):
- `profile`: sanitized subset of user `profiles`.
- `fatigueMap`: readiness entries from strain model.
- `recentHistory`: recent completed workouts (name, date, volume).
- `exercises`: subset of exercises the user can access.
- `modifications`: free-form notes.
- `planDayOfWeek`: client-side day-of-week (0–6) so server respects local rest/workout days.

Key logic:
- Validates presence of `ANTHROPIC_API_KEY`.
- Filters exercises by equipment access (full gym / home gym / bodyweight).
- Derives:
  - `dayOfWeek`, `trainingFreq`, scheduled type (`todayType`: push, pull, legs, upper, lower, ai_decides, or rest), plus `generateCardioOnly` flag when active recovery or user explicitly requests cardio.
- Constructs a large **system prompt** and **user prompt**:
  - Enforces fatigue rules and cardio-only days.
  - Enforces JSON output with `name`, `description`, `primary_targets`, `type`, and `exercises` array with `target_seconds` for time-based exercises.
- Sends request to Anthropic API:
  - Model: `claude-sonnet-4-20250514`.
- Response handling:
  - Strips Markdown fences and attempts to parse JSON (`parseWorkoutJson`).
  - Fills missing `name`, `description`, and `primary_targets` from exercises if needed.
  - Returns cleaned `workoutPlan` as JSON to client.

---

## 8. Database Schema (from migrations/)

### 8.1 `profiles` (001_profiles.sql + 006/008/009/012)

Columns (key fields):
- `id` (UUID, PK, FK auth.users)
- `display_name` (TEXT)
- `gender` (TEXT, 'male' | 'female' | 'other')
- `age` (INT)
- `height_inches` (NUMERIC)
- `weight_lbs` (NUMERIC)
- `program_style` (TEXT, 'ppl' | 'upper_lower' | 'aesthetic' | 'ai_optimal')
- `training_frequency` (INT)
- `equipment_access` (TEXT, 'full_gym' | 'home_gym' | 'bodyweight')
- `experience_level` (TEXT)
- `strength_score` (NUMERIC)
- `squat_e1rm`, `bench_e1rm`, `deadlift_e1rm` (NUMERIC)
- `current_streak_days`, `longest_streak_days`, `total_workouts` (INT)
- `generation_credits_remaining` (INT, default 3)
- `credits_reset_date` (DATE)
- `avatar_url` (TEXT)
- `manual_squat_1rm`, `manual_bench_1rm`, `manual_deadlift_1rm` (NUMERIC)
- `units` ('lbs' | 'kg')
- `onboarding_completed` (BOOL)
- `created_at`, `updated_at` (TIMESTAMPTZ)

Policies:
- RLS with per-user select/insert/update based on `auth.uid() = id`.
- Trigger `handle_new_user` to create profile on signup.

### 8.2 `exercises` (002_exercises.sql + exercise-database-expansion.sql)

Columns:
- `id` (UUID, PK)
- `name` (TEXT, unique)
- `primary_muscle` (TEXT)
- `secondary_muscles` (TEXT[])
- `movement_pattern` (TEXT: push/pull/squat/hip_hinge/core/cardio/etc.)
- `equipment` (TEXT: barbell, dumbbell, cable, machine, bodyweight, kettlebell, cardio_machine)
- `difficulty` (TEXT: beginner / intermediate / advanced)
- `fatigue_rating` (INT, 0–5)
- `is_big_three` (BOOLEAN)
- `big_three_type` ('squat' | 'bench' | 'deadlift')
- `goal_tags`, `aesthetic_targets` (TEXT[])
- `created_at` (TIMESTAMPTZ)

Policies:
- RLS read-only, all users can select.

### 8.3 `workout_sessions` and `set_logs` (003_workouts.sql + 007_cardio_and_rest.sql + 011_set_logs_actual_seconds.sql)

**workout_sessions**:
- `id` (UUID, PK)
- `user_id` (UUID FK → profiles)
- `date` (DATE)
- `name` (TEXT)
- `workout_type` (TEXT; strongly-typed in `types/workout.ts`)
- `source` (TEXT, 'ai_generated' or 'custom')
- `duration_seconds` (INT)
- `total_volume` (NUMERIC)
- `exercise_count`, `set_count`, `pr_count` (INT)
- `completed` (BOOLEAN)
- `started_at`, `completed_at` (TIMESTAMPTZ)
- `is_rest_day` (BOOLEAN)
- `is_cardio` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)

**set_logs**:
- `id` (UUID, PK)
- `session_id` (UUID FK → workout_sessions, CASCADE delete)
- `exercise_id` (UUID FK → exercises)
- `exercise_name` (TEXT)
- `exercise_order` (INT)
- `set_number` (INT)
- `target_weight`, `target_reps` (NUMERIC/INT)
- `actual_weight`, `actual_reps` (NUMERIC/INT)
- `actual_seconds` (INT; for time-based sets)
- `is_warmup`, `is_pr`, `completed` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)

Policies:
- `own_sessions`: `auth.uid() = user_id` for all operations.
- `own_sets`: checks that owning session’s `user_id = auth.uid()`.

### 8.4 `muscle_fatigue` and `strength_history` and `ai_workout_plans` (004_fatigue.sql)

- **muscle_fatigue**:
  - Per-muscle tracking for earlier fatigue model; still updated by `applyWorkoutFatigue`.
- **strength_history**:
  - Historical Big 3 snapshots by `recorded_at`.
- **ai_workout_plans**:
  - AI-generated plans keyed by `(user_id, plan_date)`; caches JSON plan for `getTodaysPlan`.

### 8.5 `saved_workouts` (005_saved_workouts.sql)

Columns:
- `id` (UUID, PK)
- `user_id` (UUID FK → profiles)
- `name` (TEXT)
- `workout_type` (TEXT)
- `exercises` (JSONB – array of `{ name, sets }`)
- `last_used_at` (TIMESTAMPTZ)
- `use_count` (INT)
- `created_at` (TIMESTAMPTZ)

Policies:
- `own_saved`: per-user RLS on `user_id`.

### 8.6 `muscle_strain_log` (010_muscle_strain_log.sql)

Columns:
- `id` (UUID, PK)
- `user_id` (UUID FK → profiles)
- `session_id` (UUID FK → workout_sessions)
- `muscle_group` (TEXT)
- `strain_score` (NUMERIC)
- `total_volume` (NUMERIC)
- `set_count` (INT)
- `exercise_count` (INT)
- `completed_at`, `created_at` (TIMESTAMPTZ)

Policies:
- `own_strain`: `auth.uid() = user_id` for all operations.

---

## 9. Utility Modules

- **`utils/theme.ts`** – central design tokens: colors, spacing, radii, typography, plus `recoveryColor`.
- **`utils/constants.ts`** – canonical muscle groups, program styles, equipment options, and nominal rest durations.
- **`utils/units.ts`** – conversions and formatting between stored lbs/inches and display lbs/kg & cm.
- **`utils/date.ts`** – `parseLocalDate` and `getLocalDateString` to avoid timezone pitfalls.
- **`utils/schedule.ts`** – mapping from program style and training frequency to scheduled workout type (used in Today + RoutineTimeline + Speed Log).
- **`utils/workoutName.ts`** – generator for human-friendly workout names from primary muscles or exercise sets.
- **`utils/exerciseUtils.ts`** – classification helpers: bodyweight vs weighted, time-based vs reps.
- **`utils/storage.ts`** – simple in-memory "AsyncStorage-like" for active workout state (single key).
- **`utils/epley.ts`, `utils/progression.ts`, `utils/recoveryModel.ts`** – strength estimates, progression rules, and strain-to-readiness logic (used by strength, fatigue, and BodyMap).

---

## 10. Types

- **`types/user.ts`** – strongly-typed `Profile` interface aligned with `profiles` table plus optional newer columns.
- **`types/workout.ts`** – typed `WorkoutSession`, `SetLog`, `MuscleFatigue`, `StrengthHistory`, and AI plan structures.
- **`types/exercise.ts`** – typed `Exercise` referencing movement patterns, equipment, difficulty, and aesthetic metadata.
- **`types/database.ts`** – stub for generated Supabase types; `Json` helper type.

---

## 11. Overall Data Flow Summary

- Authentication and profile:
  - Managed via Supabase auth + `profiles` table, surfaced through `useAuth` + `useAuthStore`.
  - Tabs vs auth routing controlled in `app/_layout.tsx`, based on session and `profile.onboarding_completed`.
- Workout logging:
  - AI path:
    - Onboarding → Today (AI card) → Modifications → Edge Function → Preview → Log → Summary & Save template.
  - Custom path:
    - Today → Workouts tab → "Create Custom Workout" → Custom workout builder → Log/complete.
  - Speed Log path:
    - Today or Workouts → Speed Log (index/editor) → logs minimal information → optional Save template.
- Fatigue and readiness:
  - `recordWorkoutStrain` writes into `muscle_strain_log` whenever a workout completes, based on `set_logs`.
  - `getBodyMapReadiness` and `getHistoricalFatigueMap` derive per-muscle recovery on demand.
  - Today tab + BodyMap + MuscleDetailSheet visualize this data; AI function also consumes it to pick exercises.
- Progress, streak, and analytics:
  - Progress screen aggregates volume, distribution, Big 3, insights, and suggestions.
  - Streak is continuously updated via `updateProfileStreak` after workouts and when Today loads.
  - Profile and Progress share stat ordering and metrics (Workouts, Streak, Lbs/Kg total) but compute them independently from raw tables to stay accurate after adds/deletes.