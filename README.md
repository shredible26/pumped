# Pumped

AI-powered fitness app built with Expo, React Native, and TypeScript.

## Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **Expo Go** app on your phone — [iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **Xcode** (optional, for iOS Simulator) — Mac App Store
- **Android Studio** (optional, for Android Emulator)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the placeholder `.env` file or create one in the project root:

```bash
# .env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

The app will scaffold and navigate without real Supabase credentials, but auth and data features require a live Supabase project.

**Auth (optional):** To let users sign in immediately after signup without verifying their email, in the [Supabase Dashboard](https://supabase.com/dashboard) go to **Authentication → Providers → Email** and turn **off** “Confirm email”.

### 3. Start the dev server

```bash
npm start
```

This runs `expo start` and prints a QR code in your terminal.

### 4. Open on a physical device

1. Make sure your phone and computer are on the **same Wi-Fi network**.
2. Open the **Expo Go** app on your phone.
3. Scan the QR code shown in the terminal (iOS Camera app also works).

**If the app never loads or times out** when using `npx expo start` (local network), try:

```bash
npx expo start --tunnel
```

Tunnel uses a public URL so the phone doesn’t need to reach your machine on the local network. It’s useful when Wi‑Fi isolation, firewalls, or VPNs block local access. The first tunnel connection may take a bit longer to establish.

### 5. Open in iOS Simulator (requires Xcode)

Press `i` in the terminal after the dev server starts, or run:

```bash
npm run ios
```

### 6. Open in Android Emulator

Press `a` in the terminal after the dev server starts, or run:

```bash
npm run android
```

> **Note:** Some native modules (`react-native-mmkv`, `expo-haptics`, `expo-secure-store`) require a development build to work fully. Expo Go supports most features but may show warnings for unsupported native modules. To create a dev build: `npx expo run:ios` or `npx expo run:android`.

## Project Structure

```
app/
  (auth)/       welcome, signup, signin, onboarding
  (tabs)/       index (Today), progress, workouts, profile
  workout/      preview, active, custom, summary, modifications
  speedlog/     type selection, editor, save
  cardio/       log
  history/      [id] session detail (with Edit & Delete)
components/     home (BodyMap, RoutineTimeline, etc.), ui (DurationInput, etc.)
hooks/          useAuth, useFatigue, useWorkout, useHistory, useStrength, useStreak
services/       supabase, exercises, workouts, fatigue, ai, streak, insights, strength, volume
stores/         authStore, workoutStore
types/          workout, user, exercise
utils/          theme, date, schedule, workoutName, units, epley, recoveryModel
```

## Features

### Today tab
- Weekly calendar strip (tap any day; green dot for logged activity; no dot on future days)
- Date-only header; scheduled vs completed workout cards
- AI workout generation and Speed Log; rest day card with Customize Cardio, Log Rest Day, Log Cardio, Speed Log
- Muscle Readiness map (current or historical by selected day)
- Quick stats (Workouts, Streak, This Week) only on current day
- This Week's Plan (RoutineTimeline) with schedule from program style and training frequency

### Progress tab
- **Insights** — rule-based cards (most/least trained muscle, push/pull balance, consistency, streak, recovery)
- **Suggestions** — personalized numbered list using your volume, muscle distribution, and recovery (e.g. least-trained muscle + example exercises like lat pulldowns, rows)
- **Big 3** — Strength score and squat/bench/deadlift e1RM from manual entry or logged sets
- **Volume** — Week/Month/Year toggle; bar chart; tap a bar to see exact volume value
- **Muscle Distribution** — This week / This month / All time; ranked list with percentages

### Workouts tab
- **Past Workouts** — filters: Today (default), This Week, This Month, All; volume shown in selected units
- Saved workouts; Create Custom Workout
- Tapping a past workout opens session detail with **Edit** (name, duration) and **Delete** (removes from DB and all screens)

### Profile tab
- Editable display name; profile picture (avatar upload to Supabase Storage)
- Program style, Days/week, Equipment, Body stats (height, weight, manual 1RMs), Units (lbs/kg)
- Sign out; all data is stored per account (Supabase); log out and back in to see the same data

### Units
- Profile → Units: lbs/ft-in or kg/cm. All numeric data (weights, volume, Big 3, body stats) updates across the app.

### Data persistence
- Workouts, sets, profile, fatigue, streaks, and AI plans are stored in Supabase keyed by user. Sign out clears local state; signing back in loads that user’s data. Active workout draft is cleared on sign out.

### TODO
- When a workout is generated, allow the user to save the workout (add to saved workouts) without having to log the workout.
- Fix 'Score' on Profile page
- Make sure the 'Workouts' number in the Progress page is always accurate (accurately represents the number of workouts visible in 'Past workouts' in the Workouts tab under 'All'.) This number should never be inaccurate, especially when workouts are deleted (present day, past day, etc)
- When the current day/today is a non Active Rest day, after a user has generated a workout, it should look like this (show screenshot). Right now this workouts only when the user does not have any workouts logged today. When a user has 1+ workouts logged today (regardless of whether it is the AI generated workout shown in the screenshot or a some other workout the user logs for today using 'Speed Log), those should just appear above the Muscle Readiness section in a 'Past Workouts' section, like how it usually is (for past days when a user has workouts recorded). Even when workouts are recorded on the present day, for non - Active Recovery days, (because you don't need to fix Active Recovery it already works) you should see the section in the screenshot that contain the 'View Workout' and 'Speed Log' buttons (only after the user has generated a workout, otherwise it should continue showing the usual generate workout screen that already exists), this should not dissapear after a user logs the generated workout or another workout. This should only get replaced if the user re-generates the workout (by clicking 'View Workout' -> 'Customize Workout'), at which case the element should be the same, it should just display the newly generated workout if the user clicks 'View Workout' (and the workout name in the element should change to the newly generated workout name).
- Change 'View Workout' -> 'Customize Workout' to View Workout -> Regenerate
- When a user is logging a time-based exercise like running, walking, etc (something that does not include repetions), make sure to only have an optional 'minutes and seconds' log, not sets/reps. You should not be able to add multiple sets as well. 