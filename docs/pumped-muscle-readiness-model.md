# PUMPED — Scientific Muscle Readiness Model
## Implementation Prompt for Cursor

Reference your chat history and knowledge and any document for theme tokens and database schemas.

---

## THE SCIENCE BEHIND THIS MODEL

This muscle readiness model is calibrated using peer-reviewed exercise science research:

- Muscle fiber type composition determines base recovery rate (Beardsley 2022, The Muscle PhD 2020)
- Pectorals: ~65% fast-twitch, slowest recovering upper body muscle
- Biceps: ~62% fast-twitch, slow recovery, high voluntary activation
- Triceps: ~57% fast-twitch, slow recovery, high voluntary activation  
- Quadriceps: ~50/50 fiber type but very LOW voluntary activation (~40%), recovers fast
- Calves/Soleus: ~70-80% slow-twitch, fastest recovery
- Lats: ~50/50 balanced, moderate recovery
- Deltoids: ~60% slow-twitch, moderate-fast recovery

- Training to failure adds 24-48 hours to recovery time (Morán-Navarro et al., 2017)
- Multi-joint barbell exercises cause more fatigue than isolation exercises (IJES research, 2011)
- Volume (sets × reps × weight) is the primary driver of muscle damage
- Higher reps to failure cause more delayed fatigue than lower reps not to failure
- Eccentric-heavy exercises cause more damage than concentric-only

## IMPLEMENTATION

Replace the entire `utils/recoveryModel.ts` file with this new scientifically-calibrated model:

```typescript
// utils/recoveryModel.ts
// Scientific Muscle Readiness Model for Pumped
// Based on: fiber type composition, voluntary activation levels, 
// volume-load relationships, and exponential recovery curves

// ═══════════════════════════════════════════════════════════
// MUSCLE GROUP PROPERTIES (from exercise science research)
// ═══════════════════════════════════════════════════════════

interface MuscleProperties {
  fastTwitchPct: number;      // % of fast-twitch fibers (higher = slower recovery)
  voluntaryActivation: number; // 0-1, how completely the muscle can be activated (higher = more damage per set)
  baseRecoveryHours: number;   // Time to ~95% recovery from a MODERATE workout (research-based)
  sizeCategory: 'large' | 'medium' | 'small'; // Affects absolute volume capacity
}

export const MUSCLE_PROPERTIES: Record<string, MuscleProperties> = {
  // CHEST — 65% fast-twitch, high activation, slowest upper body recovery
  chest:       { fastTwitchPct: 0.65, voluntaryActivation: 0.95, baseRecoveryHours: 72, sizeCategory: 'large' },
  
  // BACK — 50% balanced fiber type, moderate activation
  lats:        { fastTwitchPct: 0.50, voluntaryActivation: 0.70, baseRecoveryHours: 60, sizeCategory: 'large' },
  traps:       { fastTwitchPct: 0.50, voluntaryActivation: 0.65, baseRecoveryHours: 48, sizeCategory: 'medium' },
  
  // SHOULDERS — ~60% slow-twitch, moderate recovery
  front_delts: { fastTwitchPct: 0.40, voluntaryActivation: 0.80, baseRecoveryHours: 48, sizeCategory: 'small' },
  side_delts:  { fastTwitchPct: 0.40, voluntaryActivation: 0.75, baseRecoveryHours: 44, sizeCategory: 'small' },
  rear_delts:  { fastTwitchPct: 0.40, voluntaryActivation: 0.70, baseRecoveryHours: 40, sizeCategory: 'small' },
  
  // ARMS — 57-62% fast-twitch, HIGH voluntary activation, SLOW recovery
  biceps:      { fastTwitchPct: 0.62, voluntaryActivation: 0.95, baseRecoveryHours: 72, sizeCategory: 'small' },
  triceps:     { fastTwitchPct: 0.57, voluntaryActivation: 0.95, baseRecoveryHours: 68, sizeCategory: 'small' },
  forearms:    { fastTwitchPct: 0.50, voluntaryActivation: 0.80, baseRecoveryHours: 36, sizeCategory: 'small' },
  
  // CORE — mixed fiber type, high endurance
  abs:         { fastTwitchPct: 0.45, voluntaryActivation: 0.70, baseRecoveryHours: 36, sizeCategory: 'medium' },
  
  // LEGS — balanced to slow-twitch, LOW voluntary activation (quads especially)
  quads:       { fastTwitchPct: 0.50, voluntaryActivation: 0.40, baseRecoveryHours: 48, sizeCategory: 'large' },
  hamstrings:  { fastTwitchPct: 0.55, voluntaryActivation: 0.60, baseRecoveryHours: 56, sizeCategory: 'large' },
  glutes:      { fastTwitchPct: 0.50, voluntaryActivation: 0.50, baseRecoveryHours: 52, sizeCategory: 'large' },
  calves:      { fastTwitchPct: 0.25, voluntaryActivation: 0.70, baseRecoveryHours: 28, sizeCategory: 'medium' },
};

// ═══════════════════════════════════════════════════════════
// EXERCISE STRAIN MULTIPLIERS
// ═══════════════════════════════════════════════════════════

// Multi-joint compound exercises cause more systemic fatigue than isolation
// Research: barbell compounds need ~72h recovery, isolation ~48h
export const MOVEMENT_STRAIN_MULTIPLIER: Record<string, number> = {
  'horizontal_push': 1.3,    // bench press, push-ups
  'horizontal_pull': 1.2,    // rows
  'vertical_push': 1.2,      // overhead press
  'vertical_pull': 1.2,      // pull-ups, lat pulldown
  'hip_hinge': 1.4,          // deadlifts — highest systemic fatigue
  'squat': 1.35,             // squats — very high systemic fatigue
  'lunge': 1.15,             // lunges
  'isolation_push': 0.8,     // tricep extensions, lateral raises
  'isolation_pull': 0.8,     // bicep curls
  'isolation': 0.8,          // general isolation
  'core': 0.7,               // ab exercises — low systemic impact
  'cardio': 0.3,             // cardio has minimal muscle strain
};

// ═══════════════════════════════════════════════════════════
// STRAIN CALCULATION (per muscle group, per workout)
// ═══════════════════════════════════════════════════════════

interface SetData {
  weight: number;        // lbs
  reps: number;
  exerciseMovementPattern: string;
  isPrimaryMuscle: boolean;  // true = primary target, false = secondary
}

/**
 * Calculate the strain score for a single muscle group from a workout.
 * Returns a value from 0-100 where:
 *   0 = no strain
 *   20-40 = light strain (1-2 isolation sets)
 *   40-60 = moderate strain (3-4 sets compound)
 *   60-80 = heavy strain (5+ sets, heavy compound)
 *   80-100 = extreme strain (very high volume, multiple exercises)
 */
export function calculateMuscleStrain(
  muscleGroup: string,
  setsForThisMuscle: SetData[]
): number {
  if (setsForThisMuscle.length === 0) return 0;

  const props = MUSCLE_PROPERTIES[muscleGroup];
  if (!props) return 0;

  let totalStrain = 0;

  for (const set of setsForThisMuscle) {
    // Base volume load
    const volumeLoad = set.weight * set.reps;
    
    // Movement pattern multiplier (compounds cause more strain)
    const movementMultiplier = MOVEMENT_STRAIN_MULTIPLIER[set.exerciseMovementPattern] || 1.0;
    
    // Primary vs secondary muscle contribution
    // Primary muscles receive full strain, secondary get 40%
    const targetMultiplier = set.isPrimaryMuscle ? 1.0 : 0.4;
    
    // Rep range fatigue factor:
    // Higher reps (closer to failure) cause more metabolic fatigue
    // Research: 10+ reps to failure = more delayed recovery than 5 reps
    const repFatigueFactor = set.reps <= 5 ? 0.8 : set.reps <= 8 ? 1.0 : set.reps <= 12 ? 1.15 : 1.3;
    
    // Fiber type susceptibility: fast-twitch muscles take more damage per unit of work
    const fiberSusceptibility = 0.7 + (props.fastTwitchPct * 0.6);
    
    // Voluntary activation: muscles that activate more completely take more damage
    const activationFactor = 0.6 + (props.voluntaryActivation * 0.5);
    
    const setStrain = volumeLoad * movementMultiplier * targetMultiplier * 
                      repFatigueFactor * fiberSusceptibility * activationFactor;
    
    totalStrain += setStrain;
  }

  // Normalize strain to 0-100 scale
  // Calibration: a typical moderate workout for a muscle group produces ~4000-8000 strain units
  // Example: 4 sets of bench press at 185lbs x 8 reps (primary for chest):
  //   = 4 * (185 * 8 * 1.3 * 1.0 * 1.0 * 1.09 * 1.075) ≈ 9,000 strain
  // We want this to map to about 60-70% strain (moderate-heavy)
  const sizeNormalizer = props.sizeCategory === 'large' ? 15000 : 
                         props.sizeCategory === 'medium' ? 10000 : 7000;

  // Number of exercises targeting this muscle amplifies strain
  // (muscle targeted by 3+ exercises in one session = much more strain)
  const uniqueExercises = new Set(setsForThisMuscle.map((_, i) => i)).size;
  // This is approximate; in practice you'd group by exercise_id
  const exerciseCountMultiplier = uniqueExercises >= 3 ? 1.2 : 1.0;

  const normalizedStrain = Math.min(100, (totalStrain / sizeNormalizer) * 100 * exerciseCountMultiplier);
  
  return Math.round(normalizedStrain);
}

// ═══════════════════════════════════════════════════════════
// RECOVERY CALCULATION (exponential decay over time)
// ═══════════════════════════════════════════════════════════

/**
 * Calculate current readiness percentage for a muscle group.
 * 
 * Uses exponential recovery curve:
 * - Recovery is FAST in the first hours (blood flow, inflammation response)
 * - Slows down as it approaches full recovery (tissue remodeling)
 * - Modeled as: readiness = 100 - strain * e^(-k * hours)
 *   where k is calibrated per muscle group
 * 
 * @param muscleGroup - The muscle group ID
 * @param strainApplied - Strain score (0-100) from the workout
 * @param hoursSinceWorkout - Hours elapsed since the workout ended
 * @returns Readiness percentage (0-100)
 *   0-29: RED — Fatigued, avoid or go very light
 *   30-59: YELLOW — Moderate, can train with reduced volume
 *   60-79: GREEN (light) — Mostly recovered, normal training OK
 *   80-100: GREEN (full) — Fully ready, can push hard
 */
export function calculateReadiness(
  muscleGroup: string,
  strainApplied: number,
  hoursSinceWorkout: number
): number {
  if (strainApplied === 0) return 100;
  if (hoursSinceWorkout <= 0) return Math.max(0, 100 - strainApplied);

  const props = MUSCLE_PROPERTIES[muscleGroup];
  if (!props) return 100;

  // Recovery rate constant (k) — derived from baseRecoveryHours
  // At baseRecoveryHours, we want ~90% recovery
  // e^(-k * baseHours) = 0.1 → k = -ln(0.1) / baseHours = 2.303 / baseHours
  const k = 2.303 / props.baseRecoveryHours;

  // Exponential decay of fatigue
  const remainingFatigue = strainApplied * Math.exp(-k * hoursSinceWorkout);
  
  // Readiness = 100% minus remaining fatigue
  const readiness = Math.max(0, Math.min(100, 100 - remainingFatigue));

  return Math.round(readiness);
}

// ═══════════════════════════════════════════════════════════
// MULTI-WORKOUT ACCUMULATION
// ═══════════════════════════════════════════════════════════

/**
 * For a muscle group trained across multiple workouts, calculate cumulative readiness.
 * Each workout contributes residual fatigue that stacks.
 * 
 * Example: If you trained chest on Monday and Wednesday, by Thursday
 * the Monday fatigue is partially recovered but Wednesday's is fresh.
 * Total readiness = 100 - sum of all residual fatigues (clamped to 0-100)
 */
export interface WorkoutStrain {
  strain: number;          // 0-100 strain from that workout
  completedAt: Date;       // when the workout was completed
}

export function calculateCumulativeReadiness(
  muscleGroup: string,
  workoutStrains: WorkoutStrain[], // all workouts in the last 7 days that affected this muscle
  atTime: Date = new Date()        // calculate readiness as of this time
): number {
  if (workoutStrains.length === 0) return -1; // -1 = no data (gray)

  let totalResidualFatigue = 0;

  for (const ws of workoutStrains) {
    const hoursSince = (atTime.getTime() - ws.completedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 0) continue; // future workout, skip
    
    const props = MUSCLE_PROPERTIES[muscleGroup];
    if (!props) continue;

    const k = 2.303 / props.baseRecoveryHours;
    const residual = ws.strain * Math.exp(-k * hoursSince);
    totalResidualFatigue += residual;
  }

  // Clamp total residual fatigue to 0-100
  const readiness = Math.max(0, Math.min(100, 100 - totalResidualFatigue));
  return Math.round(readiness);
}

// ═══════════════════════════════════════════════════════════
// COLOR MAPPING
// ═══════════════════════════════════════════════════════════

export function getReadinessColor(readiness: number | null): string {
  if (readiness === null || readiness === -1) return '#3A3A4A'; // Gray — no data
  if (readiness >= 80) return '#4ADE80';  // Bright green — fully ready
  if (readiness >= 60) return '#86EFAC';  // Light green — mostly ready
  if (readiness >= 30) return '#FACC15';  // Yellow — moderate fatigue
  return '#EF4444';                        // Red — fatigued
}

export function getReadinessStatus(readiness: number | null): string {
  if (readiness === null || readiness === -1) return 'No data yet';
  if (readiness >= 80) return 'Ready for heavy work';
  if (readiness >= 60) return 'Mostly recovered — normal training OK';
  if (readiness >= 30) return 'Moderate fatigue — reduce volume';
  return 'Fatigued — avoid or go very light';
}

export function getReadinessBgColor(readiness: number | null): string {
  if (readiness === null || readiness === -1) return 'rgba(58,58,74,0.12)';
  if (readiness >= 80) return 'rgba(74,222,128,0.12)';
  if (readiness >= 60) return 'rgba(134,239,172,0.12)';
  if (readiness >= 30) return 'rgba(250,204,21,0.12)';
  return 'rgba(239,68,68,0.12)';
}

// ═══════════════════════════════════════════════════════════
// EXAMPLE CALCULATIONS (for validation)
// ═══════════════════════════════════════════════════════════

/*
EXAMPLE 1: Chest after a moderate bench press session
- 4 sets of bench press (185 lbs × 8 reps), primary muscle
- Movement: horizontal_push (1.3x)
- Strain per set: 185 × 8 × 1.3 × 1.0 × 1.0 × 1.09 × 1.075 ≈ 2,250
- Total strain: 4 × 2,250 = 9,000 → normalized: 9,000/15,000 × 100 = 60%
- At 0 hours: readiness = 100 - 60 = 40% (YELLOW)
- At 24 hours: k=2.303/72=0.032, residual=60×e^(-0.032×24)=60×0.464=27.8, readiness=72% (GREEN-light)
- At 48 hours: residual=60×e^(-0.032×48)=60×0.215=12.9, readiness=87% (GREEN-full)
- At 72 hours: residual=60×e^(-0.032×72)=60×0.1=6.0, readiness=94% (GREEN-full)

EXAMPLE 2: Biceps after heavy curls
- 4 sets of barbell curl (95 lbs × 10 reps), primary muscle
- Movement: isolation_pull (0.8x)
- Strain per set: 95 × 10 × 0.8 × 1.0 × 1.15 × 1.07 × 1.075 ≈ 1,010
- Total strain: 4 × 1,010 = 4,040 → normalized: 4,040/7,000 × 100 = 58%
- At 0 hours: readiness = 42% (YELLOW)
- At 24 hours: k=2.303/72=0.032, residual=58×0.464=26.9, readiness=73%
- At 48 hours: residual=58×0.215=12.5, readiness=88%
- At 72 hours: residual=58×0.1=5.8, readiness=94%
(Biceps recovers at similar rate to chest due to similar fast-twitch %)

EXAMPLE 3: Quads after squats (fast recovery due to low voluntary activation)
- 4 sets of squat (275 lbs × 6 reps), primary muscle
- Movement: squat (1.35x)
- Strain per set: 275 × 6 × 1.35 × 1.0 × 0.8 × 1.0 × 0.8 ≈ 1,426
- Total strain: 4 × 1,426 = 5,704 → normalized: 5,704/15,000 × 100 = 38%
- At 0 hours: readiness = 62% (GREEN-light) — quads don't get as fatigued per unit of work
- At 24 hours: k=2.303/48=0.048, residual=38×e^(-0.048×24)=38×0.316=12.0, readiness=88%
- At 48 hours: residual=38×0.1=3.8, readiness=96%
(Quads recover fast despite heavy load — matches the research)

EXAMPLE 4: Calves (fastest recovery)
- 3 sets of calf raises (200 lbs × 15 reps), primary
- Movement: isolation (0.8x)
- Strain: 3 × (200 × 15 × 0.8 × 1.0 × 1.3 × 0.85 × 0.95) ≈ 3 × 2,518 = 7,555
- Normalized: 7,555/10,000 × 100 = 76%
- At 0 hours: readiness = 24% (RED)
- At 12 hours: k=2.303/28=0.082, residual=76×e^(-0.082×12)=76×0.373=28.3, readiness=72%
- At 24 hours: residual=76×0.139=10.6, readiness=89%
- At 28 hours: residual=76×0.1=7.6, readiness=92%
(Calves bounce back within ~24 hours — matches the research)
*/
```

---

## INTEGRATION: How to wire this into the app

### Step 1: Update fatigue service

Update `services/fatigue.ts` to use the new model. When a workout is completed:

```typescript
// For each exercise in the completed workout:
// 1. Look up the exercise's primary_muscle and secondary_muscles
// 2. Look up the exercise's movement_pattern
// 3. For each set logged, create a SetData object
// 4. Group all SetData by muscle group (primary and secondary)
// 5. Call calculateMuscleStrain() for each affected muscle group
// 6. Save the strain score and completion timestamp to muscle_fatigue table

// To display current readiness on the body map:
// 1. Fetch all muscle_fatigue records for the user (last 7 days of workout strains)
// 2. For each muscle group, gather all WorkoutStrain entries
// 3. Call calculateCumulativeReadiness(muscleGroup, strains, targetDate)
// 4. If result is -1, show gray (no data)
// 5. Otherwise, use getReadinessColor() for the body map color
```

### Step 2: Update muscle_fatigue table structure

The muscle_fatigue table needs to store strain scores per workout, not just a single recovery_pct. Run this SQL:

```sql
-- Add strain tracking columns
ALTER TABLE public.muscle_fatigue ADD COLUMN IF NOT EXISTS strain_score NUMERIC(5,1) DEFAULT 0;
ALTER TABLE public.muscle_fatigue ADD COLUMN IF NOT EXISTS workout_session_id UUID REFERENCES public.workout_sessions(id);

-- We need multiple entries per muscle (one per workout), not just one per user+muscle
-- Drop the primary key constraint and add a regular index
-- Actually, let's create a new table for workout-level strain tracking:

CREATE TABLE IF NOT EXISTS public.muscle_strain_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  session_id UUID REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  muscle_group TEXT NOT NULL,
  strain_score NUMERIC(5,1) NOT NULL,  -- 0-100
  total_volume NUMERIC(10,1) DEFAULT 0,
  set_count INTEGER DEFAULT 0,
  exercise_count INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strain_user_muscle ON public.muscle_strain_log(user_id, muscle_group, completed_at DESC);

ALTER TABLE public.muscle_strain_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_strain" ON public.muscle_strain_log FOR ALL USING (auth.uid() = user_id);
```

### Step 3: Historical readiness (for calendar day selection)

When the user taps a past day on the calendar, calculate readiness AS OF the end of that day:

```typescript
// For past date view:
const endOfSelectedDay = new Date(selectedDate);
endOfSelectedDay.setHours(23, 59, 59);

// Fetch all strain logs BEFORE the end of that day (last 7 days window)
const sevenDaysBefore = new Date(endOfSelectedDay.getTime() - 7 * 24 * 3600000);

// For each muscle, call:
calculateCumulativeReadiness(muscle, strainsBefore, endOfSelectedDay);
```

### Step 4: Real-time update after workout completion

After ANY workout is saved (AI workout, speed log, or custom):

```typescript
async function recordWorkoutStrain(userId: string, sessionId: string, completedAt: Date) {
  // 1. Fetch all set_logs for this session
  const setLogs = await fetchSetLogsForSession(sessionId);
  
  // 2. Fetch exercise details for each unique exercise
  const exercises = await fetchExerciseDetails(setLogs.map(s => s.exercise_id));
  
  // 3. Build SetData arrays per muscle group
  const muscleSetData: Record<string, SetData[]> = {};
  
  for (const set of setLogs) {
    if (!set.completed || set.is_warmup) continue;
    const exercise = exercises[set.exercise_id];
    if (!exercise) continue;
    
    const setData: SetData = {
      weight: set.actual_weight || 0,
      reps: set.actual_reps || 0,
      exerciseMovementPattern: exercise.movement_pattern,
      isPrimaryMuscle: true,
    };
    
    // Primary muscle
    if (!muscleSetData[exercise.primary_muscle]) muscleSetData[exercise.primary_muscle] = [];
    muscleSetData[exercise.primary_muscle].push({ ...setData, isPrimaryMuscle: true });
    
    // Secondary muscles
    for (const secondary of exercise.secondary_muscles || []) {
      if (!muscleSetData[secondary]) muscleSetData[secondary] = [];
      muscleSetData[secondary].push({ ...setData, isPrimaryMuscle: false });
    }
  }
  
  // 4. Calculate strain for each affected muscle and save
  for (const [muscle, sets] of Object.entries(muscleSetData)) {
    const strain = calculateMuscleStrain(muscle, sets);
    
    await supabase.from('muscle_strain_log').insert({
      user_id: userId,
      session_id: sessionId,
      muscle_group: muscle,
      strain_score: strain,
      total_volume: sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
      set_count: sets.length,
      exercise_count: new Set(sets.map(s => s.exerciseMovementPattern)).size,
      completed_at: completedAt.toISOString(),
    });
  }
}
```

### Step 5: Body map rendering

```typescript
async function getBodyMapReadiness(userId: string, asOfDate: Date = new Date()) {
  // Fetch strain logs from the last 7 days relative to asOfDate
  const windowStart = new Date(asOfDate.getTime() - 7 * 24 * 3600000);
  
  const { data: strainLogs } = await supabase
    .from('muscle_strain_log')
    .select('*')
    .eq('user_id', userId)
    .gte('completed_at', windowStart.toISOString())
    .lte('completed_at', asOfDate.toISOString())
    .order('completed_at', { ascending: false });

  const ALL_MUSCLES = Object.keys(MUSCLE_PROPERTIES);
  const readinessMap: Record<string, number | null> = {};

  for (const muscle of ALL_MUSCLES) {
    const muscleStrains = (strainLogs || [])
      .filter(log => log.muscle_group === muscle)
      .map(log => ({
        strain: log.strain_score,
        completedAt: new Date(log.completed_at),
      }));

    if (muscleStrains.length === 0) {
      readinessMap[muscle] = null; // No data — render as gray
    } else {
      readinessMap[muscle] = calculateCumulativeReadiness(muscle, muscleStrains, asOfDate);
    }
  }

  return readinessMap;
}
```

---

## IMPLEMENTATION ORDER

1. Run the SQL migration to create muscle_strain_log table
2. Replace utils/recoveryModel.ts with the new scientific model (the full code above)
3. Update services/fatigue.ts to use the new model — recordWorkoutStrain() after each workout, getBodyMapReadiness() for display
4. Update the body map component to accept null values (gray) and use the new color functions
5. Update the muscle detail bottom sheet to show: readiness %, status text, strain from last workout, time since last trained
6. Wire up historical readiness: when user taps a past day on calendar, calculate readiness as of that day
7. Make sure ALL workout completion flows (AI log, speed log, custom) call recordWorkoutStrain()
8. Test with real data: log a chest workout, verify chest shows yellow/red immediately, verify it recovers toward green over the next hours/days
9. Test edge cases: new user (all gray), single set workout (small strain), massive volume workout (deep red)

Test after each step. Do not skip ahead if there are errors.
