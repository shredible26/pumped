# PUMPED

## AI-powered Adaptive Fitness Companion 
Built with Expo, React Native, and TypeScript.

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

### 2. Start the dev server

```bash
npm start
```

This runs `expo start` and prints a QR code in your terminal.

### 3. Open on a physical device

1. Make sure your phone and computer are on the **same Wi-Fi network**.
2. Open the **Expo Go** app on your phone.
3. Scan the QR code shown in the terminal (iOS Camera app also works).

**If the app never loads or times out** when using `npx expo start` (local network), try:

```bash
npx expo start --tunnel
```

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
- for Speed Log, move everything down to the center of the screen without changing any of the UI (size, etc).  
- Add image + video + explanation for each exercise
- Add a 'Primary fitness goal' section to the signup screen right before the user chooses what split they want and the number of days per week. Update the AI workout generation and everything else that is AI generated (Insights, etc) to include the users specific chosen primary goal in the AI logic/output. For the workouts, all generated workouts (unless specified) should incorporate the goal or work towards the goal in some way. This should be included in the description / in the 'Why' section (when a user clicks on 'why' for a specific exercise) whenever applicable. Design this properly and make sure that all AI calls are always inclusive of all available user data. Design this strategically as well, however you think best. I want this app (pumped) to stand out from others, almost like the weight-lifting/fitness equivalent of Strava, and I want all of the AI components to be extremely professional and well thought out; using all of the best tecniques and capabilities. Lastly, make this selection optional and if the user does not have a primary goal chosen, then all insights/AI-generation should be done without this. 