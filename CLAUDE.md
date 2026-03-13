# Pumped

A React Native Expo fitness app with AI-powered workout generation.

**Stack:** React Native + Expo Router · Supabase (auth, database, storage, edge functions) · Anthropic Claude API · Zustand · TypeScript

For full architecture details, see [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md).

---

## Running the App

```bash
npm install
npx expo start        # starts dev server (scan QR with Expo Go)
npx expo start --ios  # open in iOS simulator
```

---

## Key Folders

| Folder | What's in it |
|--------|-------------|
| `app/` | All screens (Expo Router file-based routing) |
| `app/(auth)/` | Welcome, sign in, sign up, onboarding |
| `app/(tabs)/` | Main tabs: Today, Progress, Workouts, Profile |
| `app/workout/` | AI workout preview, logging, custom builder |
| `app/speedlog/` | Quick-log flow for fast workout entry |
| `components/` | Reusable UI components (BodyMap, charts, etc.) |
| `services/` | Data layer: Supabase queries, AI calls, fatigue logic |
| `stores/` | Zustand stores for auth, active workout, profile |
| `hooks/` | React hooks wrapping stores and services |
| `utils/` | Shared helpers: theme, units, schedule, epley formula |
| `types/` | TypeScript types for users, workouts, exercises |
| `supabase/functions/` | Edge function: `generate-workout` (calls Claude API) |
| `supabase/migrations/` | Database schema migrations |
| `docs/` | Architecture docs |

---

## How AI Workout Generation Works

1. User taps "Generate Workout" on the Today tab
2. App collects profile, fatigue map, recent history, and optional modifications
3. Calls the `generate-workout` Supabase Edge Function
4. Edge function builds a prompt and calls `claude-sonnet-4-20250514`
5. Response is parsed and cached in `ai_workout_plans` table
6. User reviews in preview screen, then logs the workout

Users get **3 AI generations per day** (tracked in `profiles.generation_credits_remaining`).
