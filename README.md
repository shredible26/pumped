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

### 3. Start the dev server

```bash
npm start
```

This runs `expo start` and prints a QR code in your terminal.

### 4. Open on a physical device

1. Make sure your phone and computer are on the **same Wi-Fi network**.
2. Open the **Expo Go** app on your phone.
3. Scan the QR code shown in the terminal (iOS Camera app also works).

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
  (tabs)/       home, history, strength, profile (bottom tabs)
  workout/      preview, active, custom, summary
  history/      [id] session detail
components/     (empty — UI components added in later prompts)
hooks/          useAuth, useFatigue, useWorkout, useHistory, useStrength, useStreak
services/       supabase client, exercises, workouts, fatigue, ai
stores/         Zustand stores (auth, workout, profile)
types/          TypeScript types matching database schema
utils/          theme tokens, epley formula, recovery model, progression logic
```

## Current State (Prompt 1 — Scaffold)

### Functional

- Expo Router file-based navigation with auth gate
- Dark theme applied globally (`#0A0A0F` background, `#4ADE80` green accent)
- Bottom tab bar (Home, History, Strength, Profile) with icons
- Stack navigation for auth flow and workout flow
- All route transitions wired up (welcome → signup/signin, home → workout preview/custom, etc.)

### Placeholder (built out in later prompts)

- **Welcome** — logo, tagline, Get Started / Sign In buttons (styled, navigation works)
- **Signup / Signin** — form fields and social buttons (UI only, no auth logic yet)
- **Onboarding** — step indicator and title (multi-step form built in Prompt 3)
- **Home** — today's workout card, strength score card, body map placeholder, quick stats
- **Workout Preview** — empty state, Start Workout button
- **Active Workout** — set row UI skeleton, Complete Set button
- **Custom Workout** — name input, Add Exercise button
- **Workout Summary** — celebration layout, stats grid
- **History** — stats row, empty state
- **Session Detail** — header, empty state
- **Strength** — score card, lift cards, chart placeholder
- **Profile** — avatar, stats, settings list, sign out button

### Not yet connected

- Supabase auth (Prompt 2)
- Database reads/writes (Prompt 2)
- Onboarding flow (Prompt 3)
- Body map SVG (Prompt 4)
- Active workout logging with MMKV persistence (Prompt 5)
- AI workout generation edge function (Prompt 7)
