import { create } from 'zustand';
import { saveActiveWorkout, clearActiveWorkout } from '@/utils/storage';

export interface ActiveExercise {
  exercise_id: string;
  name: string;
  primary_muscle: string;
  equipment: string;
  is_compound: boolean;
  sets: number;
  target_reps: string;
  target_weight: number;
  rest_seconds: number;
  why?: string;
}

export interface CompletedSet {
  exerciseIndex: number;
  setIndex: number;
  weight: number;
  reps: number;
  timestamp: number;
}

export interface WorkoutState {
  sessionId: string | null;
  workoutName: string;
  source: 'ai_generated' | 'custom';
  exercises: ActiveExercise[];
  currentExIndex: number;
  currentSetIndex: number;
  completedSets: CompletedSet[];
  restSeconds: number;
  isResting: boolean;
  startedAt: string | null;

  startSession: (
    sessionId: string,
    name: string,
    source: 'ai_generated' | 'custom',
    exercises: ActiveExercise[],
  ) => void;
  logSet: (weight: number, reps: number) => void;
  advanceAfterRest: () => void;
  skipRest: () => void;
  setResting: (resting: boolean, seconds: number) => void;
  isSetCompleted: (exIndex: number, setIndex: number) => boolean;
  getCompletedSet: (exIndex: number, setIndex: number) => CompletedSet | undefined;
  getAllExerciseComplete: () => boolean;
  reset: () => void;
}

const initialState = {
  sessionId: null as string | null,
  workoutName: '',
  source: 'custom' as 'ai_generated' | 'custom',
  exercises: [] as ActiveExercise[],
  currentExIndex: 0,
  currentSetIndex: 0,
  completedSets: [] as CompletedSet[],
  restSeconds: 0,
  isResting: false,
  startedAt: null as string | null,
};

function persist(state: any) {
  const { sessionId, workoutName, source, exercises, currentExIndex, currentSetIndex, completedSets, startedAt } = state;
  saveActiveWorkout({ sessionId, workoutName, source, exercises, currentExIndex, currentSetIndex, completedSets, startedAt });
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  ...initialState,

  startSession: (sessionId, name, source, exercises) => {
    const newState = {
      sessionId,
      workoutName: name,
      source,
      exercises,
      currentExIndex: 0,
      currentSetIndex: 0,
      completedSets: [] as CompletedSet[],
      isResting: false,
      restSeconds: 0,
      startedAt: new Date().toISOString(),
    };
    set(newState);
    persist(newState);
  },

  logSet: (weight, reps) => {
    const state = get();
    const completed: CompletedSet = {
      exerciseIndex: state.currentExIndex,
      setIndex: state.currentSetIndex,
      weight,
      reps,
      timestamp: Date.now(),
    };
    const newCompleted = [...state.completedSets, completed];
    const exercise = state.exercises[state.currentExIndex];
    const totalSets = exercise?.sets ?? 0;
    const nextSetIndex = state.currentSetIndex + 1;
    const isLastSetOfExercise = nextSetIndex >= totalSets;
    const isLastExercise = state.currentExIndex >= state.exercises.length - 1;

    if (isLastSetOfExercise && isLastExercise) {
      const newState = { completedSets: newCompleted, currentSetIndex: nextSetIndex, isResting: false, restSeconds: 0 };
      set(newState);
      persist({ ...state, ...newState });
      return;
    }

    const restSec = exercise?.rest_seconds ?? 90;
    set({
      completedSets: newCompleted,
      isResting: true,
      restSeconds: restSec,
    });
    persist({ ...state, completedSets: newCompleted });
  },

  advanceAfterRest: () => {
    const state = get();
    const exercise = state.exercises[state.currentExIndex];
    const totalSets = exercise?.sets ?? 0;
    const nextSetIndex = state.currentSetIndex + 1;
    const isLastSetOfExercise = nextSetIndex >= totalSets;

    if (isLastSetOfExercise) {
      const nextEx = state.currentExIndex + 1;
      set({ currentExIndex: nextEx, currentSetIndex: 0, isResting: false, restSeconds: 0 });
      persist({ ...state, currentExIndex: nextEx, currentSetIndex: 0 });
    } else {
      set({ currentSetIndex: nextSetIndex, isResting: false, restSeconds: 0 });
      persist({ ...state, currentSetIndex: nextSetIndex });
    }
  },

  skipRest: () => {
    get().advanceAfterRest();
  },

  setResting: (resting, seconds) => set({ isResting: resting, restSeconds: seconds }),

  isSetCompleted: (exIndex, setIndex) => {
    return get().completedSets.some(
      (s) => s.exerciseIndex === exIndex && s.setIndex === setIndex,
    );
  },

  getCompletedSet: (exIndex, setIndex) => {
    return get().completedSets.find(
      (s) => s.exerciseIndex === exIndex && s.setIndex === setIndex,
    );
  },

  getAllExerciseComplete: () => {
    const state = get();
    if (state.exercises.length === 0) return false;
    for (let i = 0; i < state.exercises.length; i++) {
      const ex = state.exercises[i];
      for (let s = 0; s < ex.sets; s++) {
        if (!state.completedSets.some((c) => c.exerciseIndex === i && c.setIndex === s)) {
          return false;
        }
      }
    }
    return true;
  },

  reset: () => {
    clearActiveWorkout();
    set(initialState);
  },
}));
