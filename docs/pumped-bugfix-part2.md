# PUMPED — Bug Fixes & Features Part 2 of 2
## Paste into Cursor AFTER Part 1 is complete and tested

Reference @docs/pumped-technical-spec-v2.md for context. Implement all of the following changes. Test after each numbered section.

**Program styles**: The app supports only **four** program styles: PPL, Upper/Lower, Aesthetic, AI Optimal (see migration `008_program_style_four_only.sql` and technical spec). All UI and backend should use these four only.

---

## 8. PROGRESS TAB — INSIGHTS (FUNCTIONAL)

The Insights section should provide real, data-driven analysis after the user has logged 5+ workouts:

### Rule-Based Insights Engine
Create a utility function that analyzes the user's workout history and generates insights:

```typescript
interface Insight {
  icon: string;        // emoji
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'suggestion';
}

async function generateInsights(userId: string): Promise<Insight[]> {
  // Fetch last 30 days of workout data
  // Analyze and return 3-5 insights
}
```

Insights to generate (check each condition and include if applicable):

1. **Most trained muscle group**: "Chest is your most trained muscle group this month (28% of total volume). You clearly love bench day."
2. **Least trained muscle group**: "Your rear delts have only received 3% of your volume. Consider adding face pulls or reverse flyes."
3. **Imbalance detection**: Compare push vs pull volume. If push > pull by 40%+: "Push/Pull imbalance detected: you're doing 60% more push than pull volume. This can lead to rounded shoulders. Add more rows and pull-ups."
4. **Consistency insight**: "You've averaged X workouts per week this month — [above/below/matching] your target of Y."
5. **Strength progress**: If any Big 3 lift e1RM has increased: "Your bench press estimated 1RM increased by 15 lbs this month. That's solid progress."
6. **Streak callout**: If streak > 7: "You're on a X day streak — that's dedication. Keep it going."
7. **Recovery insight**: If any muscle is below 20% recovery: "Your quads are only 15% recovered. Consider a rest day or upper body focus tomorrow."
8. **Volume trend**: Compare this week's volume to last week: "Your total volume is up 12% from last week — you're progressively overloading well." or "Volume is down 25% this week. Life happens — consistency over perfection."

Display each insight as a card with:
- Left side: colored icon (green for positive, orange for warning, blue for suggestion)
- Title (bold, 15pt)
- Description (14pt, gray)
- Cards should be in a vertical list, not horizontally scrollable

## 9. BIG 3 LIFTS — FUNCTIONAL

The Big 3 section (Squat, Bench, Deadlift) should display the user's estimated 1RM from THREE possible sources, using the highest value:

### Data Sources (priority order — use the HIGHEST value from any source):
1. **Manual entry from onboarding**: If the user entered weights during account creation (stored in the initial set_logs or profile)
2. **Logged workout data**: Calculate e1RM from any logged set of squat, bench, or deadlift using the Epley formula: e1RM = weight × (1 + reps / 30)
3. **Manual entry from Profile tab**: User can manually enter their 1RM at any time (stored in manual_squat_1rm, manual_bench_1rm, manual_deadlift_1rm on the profile)

### Implementation:
```typescript
async function getBig3(userId: string): Promise<{
  squat: { value: number; source: string; date: string } | null;
  bench: { value: number; source: string; date: string } | null;
  deadlift: { value: number; source: string; date: string } | null;
  total: number;
}> {
  // 1. Check manual profile values
  // 2. Query set_logs for squat/bench/deadlift exercises, calculate max e1RM
  // 3. For each lift, return the highest value with its source
  // Total = sum of all three (or sum of available ones)
}
```

### UI:
- If no data for a lift: show "—" with "Log a [squat/bench/deadlift] to track" in gray
- If data exists: show the e1RM value (large, bold), source text below ("Based on 275 × 6 on Mar 7" or "Manually entered"), and change indicator if applicable
- Total Strength Score = sum of all three e1RMs
- Show total prominently at the top of the section

## 10. PROFILE TAB — FULLY FUNCTIONAL

Every setting in the Profile tab must work. Implement each one:

### Display Name
- Tapping the name at the top opens an inline text editor or modal
- Save to profiles.display_name on Supabase

### Profile Picture
- Tapping the avatar circle opens the device image picker (use expo-image-picker)
- Selected image is uploaded to Supabase Storage (create a bucket called 'avatars')
- Store the public URL in profiles.avatar_url
- Display the image in the avatar circle (fall back to initials if no image)
- Install if needed: `npx expo install expo-image-picker`

### Program Style
- Tapping opens a bottom sheet or modal showing the 4 options:
  - Push/Pull/Legs — "AI-generated workouts · Cardio on rest days"
  - Upper/Lower — "AI-powered · Cardio on rest days"
  - Aesthetic — "Optimized by AI for aesthetics · Cardio on rest days"
  - AI Optimal — "Fully AI-optimized · Smart cardio scheduling"
- Selected option is highlighted (green border)
- Saving updates profiles.program_style
- Show confirmation: "Program updated. Your next AI workout will follow the new program."

### Days/Week
- Tapping opens a selector (pill buttons 2-6)
- Updates profiles.training_frequency
- This affects which days the AI recommends lifting vs cardio

### Equipment
- Tapping opens a bottom sheet with 3 options: Full Gym, Home Gym, Bodyweight Only
- Updates profiles.equipment_access
- This affects which exercises the AI can recommend

### Body Stats
- Tapping opens a modal/bottom sheet with:
  - Height input (feet and inches or cm based on units setting)
  - Weight input (lbs or kg based on units setting)
  - Optional: manual 1RM inputs for Squat, Bench, Deadlift
- Save all to the profiles table

### Units Toggle
- Toggle between lbs/kg and feet-inches/cm
- Store preference in profile or local storage
- All displays throughout the app should respect this setting (weights in workout logging, 1RM display, volume stats, etc.)

### Log Out
- Tapping shows confirmation: "Are you sure you want to log out?"
- On confirm: call supabase.auth.signOut(), clear local storage/MMKV, navigate to welcome screen

### Remove Notifications (for now)
- Remove the Notifications row from the settings list entirely

## 11. PROGRESS TAB — MUSCLE DISTRIBUTION (ACCURATE)

The Muscle Distribution body map must use real data:

### Calculation
```typescript
function calculateMuscleDistribution(
  setLogs: SetLog[],
  exerciseDb: Exercise[]
): { muscle: string; volume: number; percentage: number }[] {
  // For each completed set, attribute volume to primary muscle (100%) and secondary muscles (50%)
  // Sum all volume per muscle group
  // Calculate percentage of total volume for each muscle
  // Sort by percentage descending
  // Return all 14 muscle groups with their volume and percentage
}
```

### UI
- Body map colored by volume distribution (brighter = more trained, dimmer = less trained)
- Use a gradient: dark/dim for low volume muscles, bright green for high volume muscles
- Below the body map, show a ranked list:
  - Each row: muscle name, percentage bar (filled proportionally), percentage number
  - Top 3 muscles get a subtle highlight
  - Bottom 3 muscles get a warning indicator: "Consider adding more [muscle] work"
- Time period filter: This Month (default) / All Time
- Make sure the data comes from actual set_logs joined with exercises to get muscle targeting info

## 12. VOLUME CHART (FUNCTIONAL)

The Volume section in the Progress tab needs a working chart:

### Data
- Week view: daily volume bars (Mon-Sun), each bar = sum of (weight × reps) for all sets that day
- Month view: weekly volume bars (Week 1, 2, 3, 4), each bar = sum of that week's daily volumes
- Year view: monthly volume bars (Jan-Dec), each bar = sum of that month's total volume

### Chart
- Use a simple bar chart (you can use react-native-svg to draw rectangles, or a charting library if already installed)
- Bars colored in accent green (#4ADE80)
- Y-axis: volume in lbs (use compact format: "5.2k", "12.4k")
- X-axis: day names (M T W T F S S) for week, or "W1 W2 W3 W4" for month, or month abbreviations for year
- Show the total volume for the selected period prominently above the chart
- Format large numbers cleanly: under 1000 show exact, 1k-999k show "X.Xk", 1M+ show "X.Xm"
- Tapping a bar could show a tooltip with the exact value (nice to have, not required)

## 13. WORKOUTS TAB — SCORE DISPLAY

In the Workouts tab, for each past workout card, show the volume as a "score":
- Calculate total volume for that session: sum of (weight × reps) for all completed sets
- Display in compact format: "3.2k lbs" or "12.5k lbs"
- Show this alongside the duration on the workout card
- Format: "[date] · [duration] · [volume score]"

---

## IMPLEMENTATION ORDER
1. Insights engine (rule-based analysis from workout data)
2. Big 3 lifts (three data sources, accurate calculation)
3. Profile tab (all settings functional: name, picture, program, days, equipment, stats, units, logout)
4. Muscle distribution (accurate data, ranked list)
5. Volume chart (bar chart with Week/Month/Year filters)
6. Workouts tab score display
7. Full end-to-end test of Progress and Profile tabs

Test after each step. Do not skip ahead if there are errors.

---

## IMPLEMENTATION STATUS (March 2026)

For current app behavior and file locations, see **docs/pumped-technical-spec-v2.md** §Implementation Status. Program style options everywhere are exactly four: PPL, Upper/Lower, Aesthetic, AI Optimal.
