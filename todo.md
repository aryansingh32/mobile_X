# ReelFlow — Complete System Transformation Specification
> Written for AI implementation. This document covers every screen, every backend service, and every admin panel page. Read it entirely before making changes. Implement in priority order.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Connectivity Audit — What Is Broken Right Now](#2-connectivity-audit)
3. [Critical Business Logic Errors](#3-critical-business-logic-errors)
4. [Design System & Tokens](#4-design-system--tokens)
5. [Motion System Specification](#5-motion-system-specification)
6. [Screen-by-Screen UI Transformation](#6-screen-by-screen-ui-transformation)
7. [Frontend Code Changes](#7-frontend-code-changes)
8. [Backend Code Changes](#8-backend-code-changes)
9. [Admin Panel Changes](#9-admin-panel-changes)
10. [Psychology & Retention Loops](#10-psychology--retention-loops)
11. [AdMob Safety Architecture](#11-admob-safety-architecture)
12. [Implementation Priority Order](#12-implementation-priority-order)

---

## 1. System Architecture Overview

### Stack (Confirmed from Source Code)
- **Backend:** Node.js + TypeScript + Express + Prisma ORM + PostgreSQL + BullMQ (Redis queue) + Firebase Admin SDK
- **Frontend:** React Native (Expo ~54) + TypeScript + Zustand + Axios + react-native-google-mobile-ads
- **Admin Panel:** React + Vite + Tailwind CSS + React Router + Axios
- **Auth:** Google Sign-In → Firebase ID Token → Backend JWT
- **Ads:** AdMob (Rewarded, Rewarded Interstitial, Banner) via `react-native-google-mobile-ads`
- **Deployment:** Railway (backend), EAS (frontend), Vite build (admin)

### Reward Sources (from `rewardsController.ts` + `CoinLedger.source` values)
```
AD_REWARDED            → 100 coins  (opt-in full rewarded ad)
AD_REWARDED_INTERSTITIAL → 50 coins  (interstitial between shorts)
AD_REWARDED_DISCOVER   → 50 coins   (rewarded ad in discover feed)
SHORT_WATCH            → 10 coins   ← WRONG — see Section 3
ADMIN_ADJUSTMENT       → variable   (admin override)
OFFERWALL              → variable   (third-party tasks)
```

---

## 2. Connectivity Audit

### 2.1 Frontend ↔ Backend Connection

**API Base URL:** `process.env.EXPO_PUBLIC_API_URL` (frontend) → backend `/api/*`

| Frontend API file | Backend Route | Status |
|---|---|---|
| `src/api/auth.ts` | `POST /api/auth/google` | ✅ Connected |
| `src/api/user.ts` → `getProfile()` | `GET /api/users/profile` | ✅ Connected |
| `src/api/user.ts` → `getDailyMissions()` | `GET /api/users/missions/daily` | ✅ Connected |
| `src/api/user.ts` → `trackActivity()` | `POST /api/users/activity` | ✅ Connected |
| `src/api/rewards.ts` → `claimShortReward()` | `POST /api/rewards/shorts` | ⚠️ Connected but WRONG BUSINESS LOGIC |
| `src/api/rewards.ts` → `claimAdReward()` | `POST /api/rewards/ad` | ✅ Connected |
| `src/api/news.ts` → `fetchNews()` | `GET /api/news` | ✅ Connected |
| `src/api/news.ts` → `claimNewsReadReward()` | `POST /api/news/read-reward` | ⚠️ Needs verification |
| `src/api/offerwall.ts` → `getOfferwallTasks()` | `GET /api/webhooks/offerwall/tasks` | ❌ Route likely missing |
| `src/api/offerwall.ts` → `completeTask()` | `POST /api/webhooks/offerwall/complete` | ❌ Route likely missing |
| `src/api/referral.ts` | `GET/POST /api/referral/*` | ✅ Connected |
| `src/api/wallet.ts` → `getCatalog()` | `GET /api/wallet/catalog` | ❌ Route missing |
| `src/api/wallet.ts` → `getHistory()` | `GET /api/wallet/history` | ❌ Route missing |
| `src/api/wallet.ts` → `requestWithdrawal()` | `POST /api/wallet/withdrawal` | ❌ Route missing |
| `src/api/wallet.ts` → `getSuggestions()` | `GET /api/wallet/suggestions` | ❌ Route missing |
| `src/api/notifications.ts` | `GET /api/users/notifications` | ✅ Connected |

### 2.2 Admin Panel ↔ Backend Connection

**API Base URL:** `import.meta.env.VITE_API_URL` → backend `/api/admin/*`

| Admin page | Backend endpoint | Status |
|---|---|---|
| Dashboard analytics | `GET /api/admin/analytics/dashboard` | ✅ Connected |
| Users list | `GET /api/admin/users` | ✅ Connected |
| User intelligence | `GET /api/admin/user-intelligence/:id` | ✅ Connected |
| Live tracking | `GET /api/admin/live-users` | ✅ Connected |
| Withdrawals | `GET /api/admin/withdrawals` | ✅ Connected |
| Fraud logs | `GET /api/admin/fraud` | ✅ Connected |
| Config (economy control) | `GET/PUT /api/admin/config` | ✅ Connected |
| RSS sources | `GET/POST /api/admin/rss-sources` | ✅ Connected |
| Catalog | `GET/POST/PUT/DELETE /api/admin/catalog` | ✅ Connected |
| Missions | `GET/POST/PUT/DELETE /api/admin/missions` | ✅ Connected |
| A/B Testing | `GET/POST/PUT /api/admin/ab-tests` | ✅ Connected |
| Notifications | `POST /api/admin/notifications/send` | ✅ Connected |
| Referrals | `GET /api/admin/referrals` | ✅ Connected |
| **Wallet routes** | `/api/wallet/*` | ❌ ENTIRE ROUTE FILE MISSING from backend `index.ts` registration |

### 2.3 Missing Backend Route: `/api/wallet`

The backend `src/index.ts` registers:
```
/api/auth, /api/users, /api/news, /api/shorts, /api/admin, /api/webhooks/offerwall, /api/referral, /api/rewards
```

There is **no `/api/wallet` registration**. The frontend calls `getCatalog()`, `getHistory()`, `requestWithdrawal()`, and `getSuggestions()` — all of which will 404. A `wallet.ts` routes file exists but is never mounted.

**Fix:** In `src/index.ts`, add:
```typescript
import walletRoutes from './routes/wallet';
// ...
app.use('/api/wallet', walletRoutes);
```

### 2.4 Missing Backend Route: Offerwall Tasks

The frontend calls `GET /api/webhooks/offerwall/tasks` and `POST /api/webhooks/offerwall/complete` but the offerwall route file likely only contains webhook handlers, not user-facing task endpoints.

**Fix:** Add user-facing offerwall endpoints (see Section 8).

---

## 3. Critical Business Logic Errors

### 3.1 ERROR: Shorts Are Incorrectly Giving Coins

**Current state (WRONG):**
- `HomeScreen.tsx` shows: `Watch Shorts → 10🪙 each`
- `ShortItem.tsx` calls `claimShortReward()` after 8 seconds watch
- Backend `POST /api/rewards/shorts` awards `short_watch_reward_coins` (default 10) per video
- `DiscoverScreen.tsx` tooltip says: "Every card you read earns you 5🪙"
- `ShortsFeed` tooltip says: "Watch YouTube Shorts for at least 8 seconds to earn 10🪙 each"

**Actual business model:** Coins are ONLY awarded when users watch rewarded AdMob ads, not for watching content. Content keeps users in the app long enough for ad opportunities to appear.

**Why this matters:**
1. It's factually false UX — users expect coins per short, don't get it reliably
2. It creates a farming vector: watch 20 shorts programmatically, get 200 coins
3. It potentially violates AdMob policies by implying ad revenue comes from content
4. It confuses the reward loop

**Fix — Two options depending on product decision:**

**Option A (Recommended):** Remove `claimShortReward`. Coins come ONLY from ads. Update all UI copy.
- Remove the `POST /api/rewards/shorts` reward payout or gate it behind an ad view
- Update HomeScreen copy to: "Watch Shorts → Reward opportunities appear while browsing"
- Keep `ShortsSessions` table for engagement tracking only (no coins)

**Option B:** Keep shorts reward but make it very small (2-3 coins) and strictly fraud-guarded, treating it as an engagement bonus, never the primary earning mechanism. Make it crystal clear in UI this is separate from ad rewards.

**Recommended: Option A.** This document assumes Option A.

### 3.2 ERROR: Daily Ad Counter Is Tracked Client-Side Only

The `useAppStore.ts` has:
```typescript
rewardedAdsWatchedToday: number
canWatchAd: () => state.rewardedAdsWatchedToday < 20
```

This is purely client-side. A user can clear AsyncStorage and get a fresh 20 ads. The BACKEND enforces the real cap (which it does correctly in `claimAdReward`), but the frontend shows misleading counts and the user gets a false sense that the limit resets.

**Fix:** On app open, sync the daily ad count from the backend. Add `dailyAdsUsed` to the `GET /api/users/profile` response. Do not trust the client-side count for limit enforcement (backend already doesn't).

### 3.3 ERROR: Streak Logic Not Implemented

The schema has `User.streak` and `User.lastLogin` but there is no backend code that:
- Increments streak on daily login
- Resets streak if a day is missed
- Awards streak bonuses
- Triggers notifications for streak maintenance

**Fix:** Implement streak logic in `POST /api/auth/google` handler. See Section 8.

### 3.4 ERROR: News Read Reward Is Misleading

`DiscoverScreen.tsx` shows a tooltip: "Every card you read earns you 5🪙". This is wrong for the same reason as shorts — news reading should keep users engaged, not directly earn coins. The coins come from the rewarded ad card that appears in the discover feed.

**Fix:** Change tooltip copy to: "Scroll through news cards. Reward videos appear as you discover." Remove `claimNewsReadReward` or make it award 0 coins (or remove the call entirely).

---

## 4. Design System & Tokens

### 4.1 Color Palette (Strict Usage Rules)

```typescript
// DESIGN TOKENS — Apply these everywhere
export const COLORS = {
  // Backgrounds
  bg_primary: '#0A0A0A',        // Main app background (darker than current #111)
  bg_card: '#161616',           // Card background
  bg_elevated: '#1E1E1E',       // Modal, bottom sheet, elevated cards
  bg_input: '#252525',          // Input fields

  // Brand Colors — STRICT USAGE RULES BELOW
  yellow: '#FFD700',            // ONLY for coin/reward amounts and coin icons
  yellow_dim: 'rgba(255,215,0,0.12)',  // Yellow tinted backgrounds
  orange: '#FF4D1A',            // ONLY for CTA buttons and action elements
  orange_dim: 'rgba(255,77,26,0.12)',  // Orange tinted backgrounds

  // Content Colors
  white: '#FFFFFF',             // Primary text
  white_80: 'rgba(255,255,255,0.80)',  // Secondary text
  white_55: 'rgba(255,255,255,0.55)', // Tertiary text / subtitles
  white_30: 'rgba(255,255,255,0.30)', // Disabled / placeholder

  // Status Colors
  green: '#4CAF50',             // Completed states, success
  red: '#FF6B6B',               // Errors, destructive actions
  blue: '#4A9EFF',              // Info states

  // Borders
  border_subtle: 'rgba(255,255,255,0.07)',
  border_card: 'rgba(255,255,255,0.10)',
  border_active: 'rgba(255,215,0,0.35)',

  // Gradients (use expo-linear-gradient)
  gradient_coin: ['#FFD700', '#FF8C00'],     // Coin glow
  gradient_hero: ['#1A1400', '#0A0A0A'],     // Hero card background
  gradient_reward: ['#1E1400', '#0A0A0A'],   // Reward card background
};
```

**Color Rule Enforcement:**
- Yellow `#FFD700` = coins, rewards, balances, earnings. NOWHERE ELSE.
- Orange `#FF4D1A` = primary CTA buttons, action verbs. Not decorative.
- White = readable content text only.
- Never use yellow as a background color for large areas.
- Never put yellow text on yellow background.

### 4.2 Typography

```typescript
export const TYPOGRAPHY = {
  // Hero numbers (coin balance, big stats)
  hero: { fontSize: 48, fontWeight: '800', letterSpacing: -1 },
  // Section headers
  h1: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '700' },
  h3: { fontSize: 15, fontWeight: '600' },
  // Body
  body: { fontSize: 14, fontWeight: '400', lineHeight: 21 },
  // Small / captions
  caption: { fontSize: 12, fontWeight: '500' },
  small: { fontSize: 11, fontWeight: '400' },
  // Reward amount (always yellow)
  reward: { fontSize: 16, fontWeight: '800', color: '#FFD700' },
};
```

### 4.3 Spacing & Layout

```typescript
export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};
export const RADIUS = {
  sm: 8, md: 12, lg: 16, xl: 20, full: 999,
};
export const SHADOW = {
  card: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  glow_yellow: {
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
};
```

---

## 5. Motion System Specification

The biggest missing element. Every screen must have at minimum these animations. Use `react-native`'s `Animated` API + `expo-haptics` for feedback.

### 5.1 Coin Counter Animation

Used everywhere a coin value is displayed or changes. When the balance increases, animate the number counting up.

```typescript
// CoinCounter component — create at src/components/ui/CoinCounter.tsx
// Uses Animated.Value interpolated to display value
// Duration: 800ms, Easing: Easing.out(Easing.cubic)
// On mount: count from 0 to value
// On update: count from previous to new value
// Trigger haptic: Haptics.impactAsync(ImpactFeedbackStyle.Light) on each 10-coin increment
```

### 5.2 Reward Celebration

Triggered when coins are awarded (ad completion, mission complete, daily bonus).

```typescript
// CoinRain component — create at src/components/ui/CoinRain.tsx
// Render 12-15 coin emoji/icons that:
//   - Start at the coin counter position
//   - Animate outward with random velocities (dx: -100 to 100, dy: -200 to -50)
//   - Fade out over 800ms
//   - Scale from 0.5 to 1.2 then to 0
// Show a "+{amount} 🪙" badge that rises and fades
// Heavy haptic: Haptics.notificationAsync(NotificationFeedbackType.Success)
```

### 5.3 Card Lift on Press

All cards must respond to press with a micro-scale animation.

```typescript
// Apply to every TouchableOpacity card:
const scaleAnim = useRef(new Animated.Value(1)).current;
const onPressIn = () => Animated.spring(scaleAnim, {
  toValue: 0.97, useNativeDriver: true, tension: 300, friction: 10
}).start();
const onPressOut = () => Animated.spring(scaleAnim, {
  toValue: 1, useNativeDriver: true, tension: 300, friction: 10
}).start();
// Wrap card in <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
```

### 5.4 Progress Bar Fill Animation

All progress bars must animate their fill width when mounted or updated.

```typescript
// Animate width from 0% to target% over 600ms on mount
// Easing: Easing.out(Easing.cubic)
// Color transitions: 0-30% → red, 30-70% → yellow, 70-100% → green
```

### 5.5 Spring Navigation

Bottom navigation tab changes should bounce.

```typescript
// Already partially implemented in BottomNavBar with Animated.spring
// ENHANCE: Add a scale pulse (1.0 → 1.3 → 1.0) on the icon when a tab is selected
// Duration: 200ms, add haptic: Haptics.selectionAsync()
```

### 5.6 Shimmer Skeleton (Already Exists — Enhance)

The `Shimmer` component exists. Ensure it's used on EVERY loading state across all screens.

### 5.7 Streak Fire Animation

The streak counter in the header should pulse when > 0:
```typescript
// Repeat Animated.sequence: scale 1.0 → 1.15 → 1.0
// Duration: 1500ms, loop while streak > 0
```

---

## 6. Screen-by-Screen UI Transformation

### 6.1 Splash Screen (App.tsx — hydration loading state)

**Current:** Plain black screen with "ReelFlow" text and ActivityIndicator.

**New Implementation:**

Replace the hydration splash in `App.tsx`:

```tsx
// When !hydrated, render <SplashScreen /> component
// src/screens/SplashScreen.tsx

// Layout:
// 1. Full black screen (#0A0A0A)
// 2. Center: Animated logo
//    - Start with coin icon (🪙 or custom SVG) at scale 0, opacity 0
//    - Animate to scale 1, opacity 1 over 400ms
//    - Then "ReelFlow" text slides up from below with fade-in
// 3. Below logo after 800ms delay, value proposition appears:
//    Text: "Your screen time, finally rewarded."
//    Subtitle: "Watch sponsored videos to earn real rewards."
// 4. At bottom: animated coin counter counting up 0 → 150 → 320 → 580
//    (simulated earnings, creates anticipation)
// 5. Progress bar at very bottom, fills over 1.5s, then app transitions
// Total duration: ~2 seconds before hydration completes or 2.5s timeout

const SPLASH_LINES = [
  'Your screen time,',
  'finally rewarded.',
];
```

### 6.2 Auth / Sign-In Screen (AuthScreen.tsx)

**Current:** Logo box, "Watch. Read. Earn.", Google button, legal text. No motivation.

**New Layout (top to bottom):**

```
[Full screen, black background]

TOP 40% — Value Proposition Zone:
┌─────────────────────────────┐
│  [Animated coin logo, 72px] │
│  ReelFlow                   │
│                             │
│  Earn real rewards by       │
│  watching sponsored videos. │
│                             │
│  ✓ Trusted by 18,000+ users │
│  ✓ Instant Google login     │
│  ✓ Real coin rewards        │
│  ✓ Redeem for UPI / vouchers│
└─────────────────────────────┘

MIDDLE — Simulated Reward Stats:
  [Animated counter card]
  "₹2.4M+ redeemed this month"
  Coins icon spinning slowly

BOTTOM 35% — Action Zone:
  [Google Sign-In button — full width, white, rounded]
  "Continue with Google  →"
  "Takes less than 10 seconds"
  
  [Legal text, small, centered]
```

**Key Changes:**
- Change tagline from "Watch. Read. Earn." to "Your screen time, finally rewarded."
- Add 3-4 trust bullets with checkmarks (green)
- Add a simulated stat (coins redeemed) with animated counter
- Google button text: "Continue with Google →" (adds momentum language)
- Button subtext: "Takes less than 10 seconds"
- Remove the big empty space in the middle

### 6.3 Home Screen (HomeScreen.tsx) — MOST IMPORTANT

**Current Layout:**
- Header (avatar, level, bell, balance, streak, XP bar)
- Balance card ("Current Balance")
- What to Do (Watch Shorts 10🪙 each ← WRONG)
- Today's Missions (empty state)
- Play Games
- Invite & Earn banner

**New Layout (complete redesign):**

```
[HEADER — keep, enhance]
Avatar | Name | Level Badge     Bell | [Coin] 45 | 🔥 3
XP progress bar fills animated

[HERO REWARD CARD — replace balance card]
┌─────────────────────────────────────────┐
│  Today's Opportunity                    │
│                                         │
│  [ 45 ] ←animated counter        🪙    │
│  coins earned                           │
│                                         │
│  Daily limit: 18 rewards remaining      │
│  ████████░░░░░░░░░░  (progress bar)    │
│                                         │
│  [🔥 WATCH A REWARDED VIDEO] ← CTA    │
│   → Earn 50 coins now                   │
└─────────────────────────────────────────┘

[DAILY BONUS — if available]
┌─────────────────────────────────────────┐
│  🎁 Daily Bonus Available               │
│  Claim your 20 coins for today          │
│  [Claim Now →]                          │
└─────────────────────────────────────────┘

[EXPLORE CONTENT — renamed from "What to Do"]
Section title: "Explore & Earn"
Subtitle: "Reward opportunities appear as you browse"

Cards (horizontal scroll):
┌──────────┐ ┌──────────┐ ┌──────────┐
│ ▶ SHORTS │ │ 📰 NEWS  │ │ ✅ TASKS │
│          │ │          │ │          │
│Reward    │ │Reward    │ │Up to     │
│opps      │ │opps      │ │500🪙     │
│available │ │available │ │          │
└──────────┘ └──────────┘ └──────────┘

IMPORTANT: Remove "10🪙 each" from Watch Shorts card.
Replace with: "Reward opportunities available"
Remove "5🪙 per card" from Read News.
Replace with: "Sponsored content available"

[TODAY'S MISSIONS — never empty]
If missions exist: show mission cards with progress bars
If no missions: show countdown to next missions
  "New missions unlock in 3h 42m  ⏱"
  [Animated countdown timer]
  
[PLAY GAMES]
Keep but enhance cards — add glow, depth, coin indicators

[REFERRAL BANNER — redesign]
Replace plain orange rectangle with:
- Illustration area (flying coins, people icons)
- "Invite friends, earn forever"
- "Get 10% of every withdrawal your friends make"
- Show referral progress: "2/5 friends invited"
- [Share Code] button

[STREAK SECTION — NEW]
If streak > 0:
  "🔥 {streak} Day Streak — Keep it going!"
  Tomorrow's bonus: +30 coins
If streak == 0:
  "Start your streak today. Come back tomorrow!"
```

**Specific Code Changes in HomeScreen.tsx:**

1. Remove `shortcutReward` text that says "10🪙 each" and "5🪙 per card"
2. Replace balance card with the new Hero Reward Card
3. Add `dailyRewardsRemaining` to state, fetch from profile
4. Add a "Watch Rewarded Ad" primary CTA that calls the rewarded ad directly from home
5. Never show empty missions — show countdown instead
6. Add streak section at bottom

### 6.4 Discover Screen (DiscoverScreen.tsx)

**Current:** Vertical scroll of news cards. Tooltip says "Every card earns 5🪙" (WRONG).

**Changes:**
1. Fix tooltip: "Scroll through news cards. Reward videos appear as you browse."
2. Remove `claimNewsReadReward()` call or ensure it awards 0 coins
3. Make sponsored video cards (ad cards) more prominent:
   - Give them a `border: 2px solid #FFD700` glow
   - Label them clearly: "🎁 Sponsored — Earn 50🪙"
   - Add a subtle pulsing glow animation
4. After watching a rewarded ad, show CoinRain celebration
5. Add a sticky header showing today's earned coins: "Today: 45🪙 earned"
6. News cards should be 80% image, 20% text (currently ~50/50)
7. Remove the "reward per card" language entirely

### 6.5 Article Detail Screen (DiscoverDetail.tsx)

**Current:** Article opens, shows content, has a "Read Full Article" button and a banner ad.

**Changes:**
1. Show a sticky top pill: "📖 Reading... Reward opportunity coming"
2. At the bottom of the article, if a rewarded ad is available, show:
   ```
   ┌─────────────────────────────┐
   │  🎁 Reward Available        │
   │  Watch a sponsored video    │
   │  Earn 50 coins              │
   │  [Watch Now →]              │
   └─────────────────────────────┘
   ```
3. After watching ad: coin rain animation + "+50 🪙" badge

### 6.6 Hot / Shorts Screen (ShortsFeed + ShortItem)

**Current:** YouTube Shorts embedded in WebView, swipe vertically. Tooltip: "Watch for 8 seconds to earn 10🪙".

**Changes:**
1. Fix tooltip: "Watch shorts. Sponsored reward videos appear occasionally."
2. Remove the 8-second coin claim mechanism entirely (Option A)
3. The rewarded interstitial ad (already coded) is the correct mechanism — KEEP THAT
4. Enhance the rewarded ad card UI:
   ```
   Instead of just showing an ad card, show:
   ┌─────────────────────────────────────┐
   │  ⭐ REWARD BREAK                    │
   │                                     │
   │  Watch a 30-sec sponsored video     │
   │  Earn 50 coins                      │
   │                                     │
   │  [▶ Watch & Earn →]  [Skip]        │
   └─────────────────────────────────────┘
   ```
5. After rewarded ad completes: coin rain + counter animation
6. During rewarded ad: show a countdown timer overlay "8 / 30 sec"

### 6.7 Earn / Rewards Screen (RewardsScreen.tsx)

**Current:** Three tabs: Tasks (preview mode / empty), Daily, Referrals.

**Changes:**
1. Tasks tab — replace "Preview mode" warning with actual offerwall integration OR show placeholder tasks with proper messaging:
   ```
   🔒 Offerwall tasks unlock at Level 3
   Complete daily missions to level up!
   [Your level: 1 of 3 required]
   ```
2. Daily tab — show missions properly, add animated countdown for next reset
3. Referrals tab — add referral tree visualization (how many friends, how much earned)
4. Add a "Daily Bonus" section at top of screen:
   ```
   [Day 1] [Day 2] [Day 3] [Day 4] [Day 5] [Day 6] [Day 7]
    ✅      ✅      🟡      ⬜      ⬜      ⬜      ⬜
   Claim Today: +30 coins
   ```
5. Add a streaks section with calendar-style visualization

### 6.8 Sponsored Video Card (in Discover/Shorts)

**Current:** Blue background, play button icon, "Watch Video, Earn 50🪙", yellow "Watch Video →" button.

**Enhanced Design:**
```
┌─────────────────────────────────┐  ← border: 1px #FFD700 glow
│ SPONSORED              50🪙     │
│                                 │
│  [Video thumbnail if available] │
│  [Or animated coin graphic]     │
│                                 │
│  Watch a short sponsored video  │
│  Don't skip — watch all the way │
│                                 │
│  ⭐⭐⭐⭐⭐  Top earning today   │
│  Duration: ~30 seconds          │
│                                 │
│  [▶ Watch & Earn 50🪙 →]      │
└─────────────────────────────────┘
```

Add: animated coin icons floating gently in the card background.

### 6.9 Wallet Screen (WalletScreen.tsx)

**Current:** Large "45" balance, three tabs: Catalog (coming soon), History, Suggest.

**Changes:**
1. Replace "Current Balance" with a proper wallet hero:
   ```
   ┌─────────────────────────────────┐
   │  Your Wallet                    │
   │                                 │
   │   45 🪙                        │
   │   ≈ ₹4.50                      │
   │                                 │
   │  Min redemption: 500 🪙 (₹50)  │
   │  [████░░░░░░░] 9% to redemption │
   └─────────────────────────────────┘
   ```
2. Catalog tab — fix the backend connection (route was not mounted)
3. Add catalog items with clear coin cost and INR value
4. History tab — show transaction history with icons per source type
5. Suggest tab — keep, but add "Popular requests" section showing top suggestions
6. Add a progress bar toward next redemption threshold

### 6.10 Games Screen (GamesScreen.tsx)

**Current:** Two-column grid of game cards with thumbnail images.

**Changes:**
1. Add coin earning indicators to each game card:
   ```
   ┌──────────────────┐
   │ [Game image]     │
   │                  │
   │ Quick Rush       │
   │ Runner           │
   │                  │
   │ ⭐⭐⭐⭐☆        │
   │ Earn up to 15🪙  │
   └──────────────────┘
   ```
2. Games earn coins via completing rewarded ads that appear during/after gameplay, not from gameplay itself
3. Add "Rewarded ad available after game" badge on cards

---

## 7. Frontend Code Changes

### 7.1 New Components to Create

**`src/components/ui/CoinCounter.tsx`**
```typescript
// Animated counter that counts from previousValue to newValue
// Props: value: number, size?: 'sm' | 'md' | 'lg' | 'hero'
// Size maps to font sizes: 14 / 20 / 32 / 48
// Duration: 800ms, always shows yellow coin icon after number
// Export as default
```

**`src/components/ui/CoinRain.tsx`**
```typescript
// Particle explosion component
// Props: visible: boolean, amount: number, onComplete?: () => void
// Renders 12 animated coin particles + "+{amount}" rising badge
// Auto-hides after 1200ms, calls onComplete
// Use position: absolute, zIndex: 999, full screen overlay
// Export as default
```

**`src/components/ui/RewardCard.tsx`**
```typescript
// The golden-bordered card that appears before rewarded ads
// Props: coins: number, onWatch: () => void, onSkip?: () => void
// Shows coin amount, description, watch/skip buttons
// Has pulsing border glow animation
```

**`src/components/ui/AnimatedProgressBar.tsx`**
```typescript
// Props: progress: number (0-1), color?: string, height?: number
// Animates from 0 to progress on mount
// Animates from old progress to new progress on update
// Color-adaptive: red < 0.3, yellow 0.3-0.7, green > 0.7
```

**`src/components/ui/DailyStreakRow.tsx`**
```typescript
// Renders 7 day circles, filled for past days, current day highlighted
// Props: streak: number, claimedToday: boolean, onClaim?: () => void
```

**`src/screens/SplashScreen.tsx`**
```typescript
// Full animated splash screen
// See Section 6.1 for layout spec
```

### 7.2 Modified Files

**`App.tsx`** — Replace hydration loading with `<SplashScreen />` component.

**`src/store/useAppStore.ts`** — Add fields:
```typescript
interface AppState {
  // Add:
  dailyRewardsRemaining: number;
  dailyRewardsCap: number;
  todayCoinsEarned: number;
  streakClaimedToday: boolean;
  dailyBonusAvailable: boolean;
  // Actions:
  setDailyStats: (stats: { remaining: number; cap: number; todayEarned: number }) => void;
  setStreakClaimedToday: (claimed: boolean) => void;
}
```

**`src/api/user.ts`** — Update `getProfile()` to handle new response fields:
```typescript
// Profile response should now include:
// { coins, xp, level, streak, dailyAdsUsed, dailyAdCap, todayCoinsEarned, streakClaimedToday }
```

**`src/screens/HomeScreen.tsx`** — Complete rewrite per Section 6.3 spec.

**`src/screens/AuthScreen.tsx`** — Redesign per Section 6.2 spec.

**`src/components/discover/DiscoverScreen.tsx`** — Fix tooltip copy, remove news-read reward coins.

**`src/components/shorts/ShortItem.tsx`** — Remove `claimShortReward()` call, update tooltip.

**`src/screens/WalletScreen.tsx`** — Redesign per Section 6.9.

**`src/screens/RewardsScreen.tsx`** — Add daily bonus section, fix missions empty state.

### 7.3 Copy Changes (All Files)

Find and replace these strings across the entire frontend:

| OLD (Remove) | NEW (Use Instead) |
|---|---|
| "Watch Shorts" + "10🪙 each" | "Watch Shorts" + "Reward opportunities available" |
| "Read News" + "5🪙 per card" | "Discover News" + "Sponsored content inside" |
| "Every card you read earns you 5🪙" | "Scroll through news. Reward videos appear as you browse." |
| "Watch YouTube Shorts for at least 8 seconds to earn 10🪙 each" | "Watch shorts. Earn coins by watching sponsored reward videos." |
| "Watch. Read. Earn." | "Your screen time, finally rewarded." |
| "Current Balance" | "Your Wallet" or "Today's Earnings" |
| "Occasional reward videos pay 50-100🪙" | "Sponsored reward videos earn 50 coins each." |
| "Complete Tasks for Big Rewards" | "Complete Sponsored Tasks" |

---

## 8. Backend Code Changes

### 8.1 Mount Missing Wallet Routes (URGENT)

In `src/index.ts`:
```typescript
// ADD THIS LINE after other route registrations:
import walletRoutes from './routes/wallet';
app.use('/api/wallet', walletRoutes);
```

Create `src/routes/wallet.ts` if it doesn't contain the right routes:
```typescript
import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { getCatalog, getWalletHistory, requestWithdrawal, createSuggestion, getSuggestions } from '../controllers/walletController';

const router = Router();
router.use(authenticate);
router.get('/catalog', getCatalog);
router.get('/history', getWalletHistory);
router.post('/withdrawal', requestWithdrawal);
router.get('/suggestions', getSuggestions);
router.post('/suggestions', createSuggestion);
export default router;
```

Verify `src/controllers/walletController.ts` implements all these functions. If any are missing, implement them using the Prisma models `CatalogItem`, `CoinLedger`, `Withdrawal`, `RewardSuggestion`.

### 8.2 Add Daily Stats to Profile Response

In `src/controllers/userController.ts`, update the `getProfile` handler:
```typescript
// Add to profile response:
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);

const dailyAdRewardsUsed = await prisma.coinLedger.count({
  where: {
    userId: user.id,
    source: { in: ['AD_REWARDED', 'AD_REWARDED_INTERSTITIAL', 'AD_REWARDED_DISCOVER'] },
    timestamp: { gte: todayStart },
  },
});

const capConfig = await prisma.appConfig.findUnique({ where: { key: 'daily_ad_cap' } });
const dailyAdCap = capConfig ? parseInt(capConfig.value) : 20;

const todayEarnings = await prisma.coinLedger.aggregate({
  _sum: { amount: true },
  where: {
    userId: user.id,
    amount: { gt: 0 },
    timestamp: { gte: todayStart },
  },
});

// Return in profile:
res.json({
  ...existingProfileFields,
  dailyAdsUsed: dailyAdRewardsUsed,
  dailyAdCap,
  dailyAdRemaining: Math.max(0, dailyAdCap - dailyAdRewardsUsed),
  todayCoinsEarned: todayEarnings._sum.amount || 0,
});
```

### 8.3 Implement Streak Logic

In `src/controllers/authController.ts`, in the Google login handler, after user creation/lookup:
```typescript
// After finding/creating user:
const now = new Date();
const lastLogin = user.lastLogin;
const daysSinceLastLogin = Math.floor((now.getTime() - lastLogin.getTime()) / 86400000);

let newStreak = user.streak;
let streakReset = false;

if (daysSinceLastLogin === 0) {
  // Same day login — keep streak, no change
} else if (daysSinceLastLogin === 1) {
  // Next day — increment streak
  newStreak = user.streak + 1;
} else {
  // Missed a day — reset streak
  newStreak = 1;
  streakReset = true;
}

await prisma.user.update({
  where: { id: user.id },
  data: { streak: newStreak, lastLogin: now, lastActiveAt: now },
});

// Award streak bonus coins
if (daysSinceLastLogin >= 1) {
  const streakBonus = Math.min(newStreak * 5, 50); // Cap at 50
  const ip = requestIp.getClientIp(req) || 'unknown';
  const sessionId = `STREAK:${user.id}:${now.toISOString().slice(0, 10)}`;
  try {
    await addLedgerEntry(user.id, streakBonus, 'DAILY_LOGIN', ip, sessionId);
  } catch (e: any) {
    if (e.code !== 'P2002') throw e; // Ignore duplicate (already claimed today)
  }
}

// Include streakReset in JWT payload if needed for client notification
```

### 8.4 Update XP / Level System

In `src/services/expService.ts`, ensure the level-up logic runs after every ledger entry. Currently the service likely exists but may not be called. Wire it up:

```typescript
// In rewardsController.ts, after addLedgerEntry succeeds:
import { checkLevelUp } from '../services/expService';
const xpGained = Math.floor(coinsEarned / 2); // 1 XP per 2 coins (configurable)
await checkLevelUp(userId, xpGained);
```

### 8.5 Remove SHORT_WATCH as a Coin Source (Option A)

In `src/controllers/rewardsController.ts`, update `claimShortReward`:
```typescript
// Option A: Track the session for analytics but award 0 coins
export const claimShortReward = async (req, res) => {
  // ... validate inputs same as before ...
  
  // Log the session for analytics (keep this)
  await prisma.shortsSessions.create({
    data: { userId, videoId, watchSeconds, coinsEarned: 0 },
  });
  
  // Return 0 coins — engagement is tracked, no coin reward
  res.json({ message: 'Session tracked', coinsEarned: 0 });
};
```

### 8.6 Add Offerwall User-Facing Endpoints

Create user-facing offerwall endpoints in `src/routes/offerwall.ts` (add alongside webhook):
```typescript
router.get('/tasks', authenticate, getUserTasks);      // GET tasks for user
router.post('/tasks/:taskId/complete', authenticate, markTaskComplete);  // User completes task
```

In the controller, `getUserTasks` should return tasks from the offerwall provider OR from a manually seeded task list in `AppConfig`. Until a real offerwall is integrated, seed default tasks via admin panel.

### 8.7 Strengthen Fraud Detection

The current `fraudMiddleware.ts` uses in-memory Maps which reset on server restart and don't work across multiple instances. Fix:

```typescript
// Replace in-memory Maps with Redis-backed counters
// Use the existing BullMQ/Redis connection
// Key format: "ratelimit:{userId}" with TTL 60s
// Key format: "ip_users:{ipHash}" with TTL 3600s

// Also add to fraudService.ts:
export const checkAdFraud = async (userId: number, adSessionId: string): Promise<{ allowed: boolean; reason?: string }> => {
  // 1. Check if adSessionId was already used (idempotency — already done in claimAdReward)
  // 2. Check time since last ad claim (minimum 60 seconds between ads)
  const lastAdClaim = await prisma.coinLedger.findFirst({
    where: { userId, source: { startsWith: 'AD_' } },
    orderBy: { timestamp: 'desc' },
  });
  
  if (lastAdClaim) {
    const secondsSince = (Date.now() - lastAdClaim.timestamp.getTime()) / 1000;
    if (secondsSince < 45) {
      await logFraud(userId, 'AD_TOO_FAST', 'MEDIUM', { secondsSince, adSessionId });
      return { allowed: false, reason: 'Too soon since last reward' };
    }
  }
  
  // 3. Check daily pattern — if all ads were claimed in < 30 minutes total, flag
  return { allowed: true };
};
```

### 8.8 Add Daily Login Bonus Endpoint

```typescript
// New endpoint: POST /api/users/daily-bonus
// Checks if user has already claimed today via idempotency key
// Awards configurable daily bonus (default 20 coins from AppConfig key 'daily_bonus_coins')
// Returns { claimed: boolean, coinsEarned: number, nextBonus: ISO date string }
```

Add to `src/routes/users.ts`:
```typescript
router.post('/daily-bonus', authenticate, claimDailyBonus);
```

### 8.9 Seed Default AppConfig Values

Ensure these keys exist in the database via migration or seed:
```sql
INSERT INTO "AppConfig" (key, value) VALUES
  ('daily_ad_cap', '20'),
  ('short_watch_seconds_required', '8'),
  ('short_watch_reward_coins', '0'),  -- Changed from 10 to 0
  ('daily_bonus_coins', '20'),
  ('ad_cooldown_seconds', '60'),
  ('min_withdrawal_coins', '500'),
  ('coin_to_inr_rate', '0.10'),
  ('referral_percent', '10'),
  ('max_level', '50'),
  ('xp_per_level', '100')
ON CONFLICT (key) DO NOTHING;
```

---

## 9. Admin Panel Changes

### 9.1 Connectivity Fix

The admin panel's `services/api.ts` calls endpoints that exist in the backend. The main issue is the wallet route not being mounted (fixed in Section 8.1). The admin panel itself is well-connected.

### 9.2 Add Daily Bonus Configuration

In `src/pages/Config.tsx`, add config row for:
- `daily_bonus_coins` — Daily login bonus amount
- `ad_cooldown_seconds` — Minimum seconds between rewarded ad claims
- `short_watch_reward_coins` — Set to 0 (Document that it was changed)
- `coin_to_inr_rate` — Exchange rate (show ₹ equivalent in wallet)

### 9.3 Add Streak Monitoring to Dashboard

In `src/pages/Dashboard.tsx`, add a stat card:
```
Active Streaks Today: {count}
Average Streak: {avg} days
Users with 7+ day streak: {count}
```

Query: `GET /api/admin/analytics/dashboard` — backend should return these stats.

### 9.4 Fix Missing Admin Endpoints

Add these to `adminController.ts` if not present:
```typescript
// GET /api/admin/analytics/streaks
export const getStreakAnalytics = async (req, res) => {
  const stats = await prisma.user.aggregate({
    _avg: { streak: true },
    _max: { streak: true },
  });
  const usersWithStreak = await prisma.user.count({ where: { streak: { gt: 0 } } });
  res.json({ avgStreak: stats._avg.streak, maxStreak: stats._max.streak, usersWithStreak });
};
```

### 9.5 Mission Builder Enhancement

The `Missions.tsx` admin page should allow:
- Setting mission type (DAILY / ONETIME / WEEKLY)
- Preview of what users will see
- Bulk activate/deactivate missions
- Schedule missions (start/end date — add to Missions schema)

Add to `Missions` Prisma model:
```prisma
model Missions {
  // ADD:
  activeFrom  DateTime? // null = always active
  activeTo    DateTime? // null = no expiry
  isActive    Boolean   @default(true)
  iconEmoji   String    @default("🎯")
  difficulty  String    @default("EASY") // EASY, MEDIUM, HARD
}
```

---

## 10. Psychology & Retention Loops

Every screen must answer these four questions implicitly:

1. **What do I have?** → Coin balance always visible in header
2. **How much can I earn today?** → Daily remaining counter on home screen
3. **What's the fastest way to earn right now?** → Single primary CTA, not five equal options
4. **What's coming next?** → Streak countdown, mission timer, bonus unlock

### 10.1 The Earning Loop (Must Be Visible On Every Screen)

The circular loop that drives retention:
```
Open App
   ↓
See Today's Progress (% of daily limit used)
   ↓
Browse Content (Shorts / News / Games)
   ↓
Reward Opportunity Appears (Rewarded Ad Card)
   ↓
Choose to Watch Sponsored Video
   ↓
Coins Awarded → CoinRain Animation → Counter Increases
   ↓
"5 more to complete today's mission!"
   ↓
Return to content browsing
```

### 10.2 Never Show Empty States — Show Countdowns Instead

| Screen | Current Empty State | New Empty State |
|---|---|---|
| Home Missions | "No daily missions active" | "Next missions in 3h 42m ⏱" with countdown |
| Earn Tasks | "Preview mode" | "Tasks unlock at Level 3. You're Level 1." |
| Wallet Catalog | "Coming soon" | Show placeholder items with "Launching soon" |
| Earn Daily | Empty | Show daily bonus widget |

### 10.3 Streak System

Daily streaks drive the strongest retention. Implement:
- Day 1-7 streak: +5/+10/+15/+20/+25/+30/+50 bonus coins
- "Streak at risk" push notification at 6pm if user hasn't logged in
- Streak freeze mechanic (earn 1 freeze by watching 10 rewarded ads)
- Streak milestones: 7 days = badge, 30 days = premium badge, 100 days = special badge

### 10.4 Level System

```
Level 1  → 0 XP      (default) — Basic features
Level 2  → 100 XP   — Unlocks daily bonus
Level 3  → 250 XP   — Unlocks offerwall tasks
Level 5  → 500 XP   — Unlock higher-value catalog items
Level 10 → 1000 XP  — VIP status, higher referral percentage
```

Show level progress bar in header, celebrate level-ups with coin rain.

---

## 11. AdMob Safety Architecture

### 11.1 Policy-Safe Implementation Rules

**NEVER:**
- Show coins awarded before the ad finishes
- Allow users to tap "back" and still receive coins
- Label ad clicks as "earn coins by clicking"
- Run unlimited ads without cooldowns
- Award coins from banner ad impressions

**ALWAYS:**
- Award coins only in `onRewarded` callback from AdMob SDK
- Verify the reward server-side via `/api/rewards/ad` with idempotency key
- Log every ad reward with timestamp, device ID, IP hash
- Enforce minimum 60 seconds between rewarded ad claims (server-side)
- Enforce daily cap server-side (already done in `claimAdReward`)

### 11.2 App State Guard (Already in DiscoverScreen — Enforce Everywhere)

The `adAbortedRef` pattern in `DiscoverScreen.tsx` is correct. Make sure it's also in `ShortsFeed.tsx`:
```typescript
// If app goes to background during ad, set adAborted = true
// If adAborted is true when onRewarded fires, do NOT call claimAdReward
// This prevents backgrounding → switching accounts → collecting reward
```

### 11.3 Idempotency Key Format

The current format `AD_REWARDED:${userId}:${adSessionId}` is correct. Ensure `adSessionId` is:
- Generated client-side as a UUID before showing the ad
- Sent to backend in `claimAdReward` body
- Used as the idempotency key
- Expires after 24 hours (clean up old ledger entries periodically)

### 11.4 Device Fingerprinting

The `DeviceFingerprint` table exists. Make sure fingerprinting runs on login and is checked before reward claims. Currently `fingerprintController.ts` exists but may not be called during ad reward flow.

Add to `claimAdReward`:
```typescript
// Look up device's fingerprint from req.body.deviceId
// If device isRooted or isEmulator, flag fraud and return 403
const fingerprint = deviceId ? await prisma.deviceFingerprint.findUnique({
  where: { deviceIdHash: deviceId },
}) : null;

if (fingerprint?.isRooted || fingerprint?.isEmulator) {
  await logFraud(userId, 'ROOTED_DEVICE_AD_CLAIM', 'HIGH', { deviceId });
  res.status(403).json({ error: 'Device not eligible for rewards.' });
  return;
}
```

---

## 12. Implementation Priority Order

Work in this exact order. Each phase must be complete before starting the next.

### Phase 1: Fix Critical Bugs (Do First — Breaks App)

1. **Mount wallet routes in `src/index.ts`** — Without this, wallet screen 404s on every API call.
2. **Remove misleading coin copy** — Change "10🪙 each" and "5🪙 per card" across all frontend files.
3. **Fix `claimShortReward` to award 0 coins** — Critical business logic error.
4. **Fix offerwall user-facing endpoints** — Earn screen shows "preview mode" which makes the app look broken.

### Phase 2: Home Screen Transformation (Most Impact on Retention)

5. Redesign HomeScreen per Section 6.3 (Hero card, progress, CTA, missions countdown)
6. Add `CoinCounter`, `AnimatedProgressBar`, `CoinRain` components
7. Update `getProfile` backend response to include daily stats
8. Add streak logic in auth controller

### Phase 3: Auth + Splash (First Impression)

9. Build `SplashScreen.tsx` with animations
10. Redesign `AuthScreen.tsx` with value proposition
11. Test full auth flow end-to-end

### Phase 4: Reward Loop Enhancement

12. Enhance rewarded ad card UI (RewardCard component)
13. Add coin rain celebration after every ad reward
14. Add daily bonus endpoint + UI
15. Add daily login streak bonus logic

### Phase 5: Remaining Screens

16. Discover screen copy fix + ad card enhancement
17. Shorts screen tooltip fix + reward break UI
18. Wallet screen redesign
19. Earn/Rewards screen improvements

### Phase 6: Motion System

20. Add press animations to all cards
21. Add spring animation to bottom nav tab changes
22. Add progress bar fill animations everywhere
23. Add streak pulse animation

### Phase 7: Admin Panel + Backend Hardening

24. Add streak analytics to admin dashboard
25. Strengthen fraud detection with Redis-backed counters
26. Add ad cooldown enforcement in `claimAdReward`
27. Add device fingerprint check in reward claim
28. Seed all required AppConfig values via migration

### Phase 8: Polish + Retention

29. Implement full level/XP system
30. Build DailyStreakRow component
31. Add push notification triggers for streak at risk
32. Add milestone celebrations (level up, first redemption, 7-day streak)

---

## Appendix A: Environment Variables Required

### Backend `.env`
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
API_CLIENT_SECRET=...     # For signature middleware
REDIS_URL=redis://...     # For BullMQ and future Redis rate limiting
CORS_ALLOWED_ORIGINS=https://admin.yourdomain.com,http://localhost:5173
```

### Frontend `.env`
```
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_TERMS_URL=https://yourdomain.com/terms
EXPO_PUBLIC_PRIVACY_URL=https://yourdomain.com/privacy
EXPO_PUBLIC_ADMOB_REWARDED_ANDROID=ca-app-pub-...
EXPO_PUBLIC_ADMOB_REWARDED_IOS=ca-app-pub-...
EXPO_PUBLIC_ADMOB_REWARDED_INTERSTITIAL_ANDROID=ca-app-pub-...
EXPO_PUBLIC_ADMOB_REWARDED_INTERSTITIAL_IOS=ca-app-pub-...
EXPO_PUBLIC_ADMOB_DISCOVER_REWARDED_ANDROID=ca-app-pub-...
EXPO_PUBLIC_ADMOB_DISCOVER_REWARDED_IOS=ca-app-pub-...
EXPO_PUBLIC_ADMOB_BANNER_ARTICLE_ANDROID=ca-app-pub-...
EXPO_PUBLIC_ADMOB_BANNER_ARTICLE_IOS=ca-app-pub-...
```

### Admin Panel `.env`
```
VITE_API_URL=https://api.yourdomain.com/api
VITE_GOOGLE_CLIENT_ID=...
```

---

## Appendix B: Prisma Schema Additions Required

Add these fields to existing models:

```prisma
// Missions — add scheduling and metadata
model Missions {
  // existing fields...
  isActive    Boolean   @default(true)    // ADD
  activeFrom  DateTime?                   // ADD
  activeTo    DateTime?                   // ADD
  iconEmoji   String    @default("🎯")   // ADD
  difficulty  String    @default("EASY")  // ADD ENUM: EASY, MEDIUM, HARD
}

// User — add daily login bonus tracking
model User {
  // existing fields...
  lastDailyBonus    DateTime?             // ADD — when they last claimed daily bonus
  streakFreezes     Int       @default(0) // ADD — streak protection mechanic
  totalCoinsEarned  Int       @default(0) // ADD — lifetime earnings for analytics
}

// New: DailyStats for quick analytics queries (denormalized)
model DailyUserStats {
  id            Int      @id @default(autoincrement())
  userId        Int
  date          DateTime  // Store as date only (truncate to day)
  coinsEarned   Int       @default(0)
  adsWatched    Int       @default(0)
  sessionCount  Int       @default(0)
  @@unique([userId, date])
  @@index([date])
}
```

After adding to schema, run: `npx prisma migrate dev --name add_missions_scheduling_and_daily_stats`

---

## Appendix C: Quick Reference — What Each Screen Should Feel Like

| Screen | Reference App | Key Feeling |
|---|---|---|
| Splash | CRED | Premium, dark, anticipation |
| Auth | Duolingo | Trustworthy, motivating, fast |
| Home | Clash Royale | Reward machine, always something to do |
| Discover | Apple News | Clean, content-first, reward secondary |
| Shorts | TikTok | Addictive scroll, reward feels earned |
| Earn | Google Opinion Rewards | Professional, legitimate, organized |
| Wallet | CRED | Premium, clear value, aspirational |
| Games | Google Play | Fun categories, reward visible |

---

*End of Specification. Total estimated implementation time: 80-120 hours of development across all three systems. Start with Phase 1 (critical bugs) as those are blocking real users from using the wallet and earn screens.*
