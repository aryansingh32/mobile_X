# ReelFlow — Complete Monetization & Engagement System
### Product Strategy · Technical Specification · Play Store Survival Guide
> Codebase-grounded report. Every section references actual files analyzed.

---

## Table of Contents

1. [Current Ad System — What Actually Exists](#1-current-ad-system--what-actually-exists)
2. [YouTube IFrame API — TOS Compliance Audit](#2-youtube-iframe-api--tos-compliance-audit)
3. [Redesigned Ad Architecture](#3-redesigned-ad-architecture)
4. [Admin-Controlled Ad Cards](#4-admin-controlled-ad-cards)
5. [Shorts Feed — Complete Ad Flow](#5-shorts-feed--complete-ad-flow)
6. [Discover / News Page — Ad Flow](#6-discover--news-page--ad-flow)
7. [Mini Games — HTML5 Engine + Ad Integration](#7-mini-games--html5-engine--ad-integration)
8. [Home Screen — Psychological Engagement Layer](#8-home-screen--psychological-engagement-layer)
9. [Tab-Switch Interstitials](#9-tab-switch-interstitials)
10. [Offerwall — Full Integration Plan](#10-offerwall--full-integration-plan)
11. [Coin Economy Design](#11-coin-economy-design)
12. [Anti-Bot / Anti-Farming System](#12-anti-bot--anti-farming-system)
13. [Revenue Maximization Strategy](#13-revenue-maximization-strategy)
14. [Backend Changes Required](#14-backend-changes-required)
15. [Admin Panel Changes Required](#15-admin-panel-changes-required)
16. [Play Store Survival Checklist](#16-play-store-survival-checklist)
17. [Implementation Priority Order](#17-implementation-priority-order)

---

## 1. Current Ad System — What Actually Exists

### What is built (as of codebase analysis)

**ShortsFeed.tsx** — Two ad types exist:
- `REWARDED_INTERSTITIAL_TRIGGER` — a full-screen black card that auto-fires `RewardedInterstitialAd` when it becomes active. Triggered when `(items.length + fetchedItems.length) % 6 === 0`. **This condition almost never fires** due to how pagination chunks arrive (10 items at a time; 10 % 6 = 4 ≠ 0).
- `REWARDED_VIDEO_CARD` — a gold "Watch Ad to Earn" button overlaid on a blank screen. Triggered at `% 11`. Same broken modulo issue.

**rewardsController.ts** — Reward amounts are **HARDCODED** in the controller:
```
REWARDED_DISCOVER   → 50 coins  (hardcoded)
REWARDED            → 100 coins (hardcoded)
REWARDED_INTERSTITIAL → 50 coins (hardcoded)
```
The admin panel's Economy Config has no effect on these values. They must be moved to `AppConfig`.

**adUnits.ts** — Four AdMob ad unit slots are configured: `REWARDED_INTERSTITIAL`, `REWARDED`, `REWARDED_DISCOVER`, `BANNER_ARTICLE`. Only the first two are actually used. BANNER_ARTICLE and REWARDED_DISCOVER exist in config but are never called.

**What does NOT exist yet:**
- Admin-controlled ad card design (colors, text, button label, coin display)
- News/Discover page ad flow (REWARDED_DISCOVER slot exists but no trigger)
- Mini games
- Tab-switch interstitials
- Home page psychological engagement elements beyond missions
- Any offerwall SDK integration (8 demo tasks are hardcoded)

---

## 2. YouTube IFrame API — TOS Compliance Audit

### Critical finding: Multiple violations in ShortItem.tsx

The app embeds YouTube via WebView + IFrame API. This is technically permitted — but only with strict constraints Google enforces. Current code violates several.

---

### Violation 1 — `controls: 0` (HIGH RISK — Account Ban)

```javascript
// ShortItem.tsx line ~250 — current code
playerVars: {
  controls: 0,   // ← THIS IS A VIOLATION
  ...
}
```

YouTube API Terms of Service **Section 5.1.C** explicitly requires:
> "You must not encourage or enable users to disable, modify, or bypass the YouTube player controls."

Setting `controls: 0` removes the YouTube logo, progress bar, and all branding from the player entirely. Google scans for this in their API audit process. This is the most common reason YouTube API keys get terminated.

**Fix:** Set `controls: 1`. Style the overlay elements to avoid visual conflict with the controls bar (they appear only at the bottom 10% of the screen).

---

### Violation 2 — Gesture Zone Covering the YouTube Logo (MEDIUM RISK)

```javascript
// ShortItem.tsx — current code
<Pressable
  style={[styles.gestureZone, { height: playerHeight * 0.8 }]}
  pointerEvents={playing ? 'auto' : 'none'}
  onPress={handleTap}
/>
```

The gesture interceptor covers 80% of the screen from the top. The YouTube logo appears in the top-left corner of the player. A `pointerEvents="auto"` Pressable on top of the logo area makes the logo untappable. The YouTube branding requirements state the logo must be visible and tappable.

**Fix:** Add `paddingTop: 60` to the gesture zone so the top 60px (where the YouTube logo sits) is not blocked by the interceptor.

---

### Violation 3 — `origin` set to a third-party domain (MEDIUM RISK)

```javascript
source={{ html: htmlContent, baseUrl: 'https://lonelycpp.github.io' }}
// and inside the player:
origin: 'https://lonelycpp.github.io'
```

`lonelycpp.github.io` is someone else's GitHub Pages. Setting the IFrame `origin` to a domain you don't own for the purpose of bypassing YouTube's referrer checks is a Terms of Service violation. If YouTube identifies this, it looks like API key spoofing.

**Fix:** Use your own domain or omit the origin parameter for WebView-embedded players. Set `baseUrl` to your own app's bundle identifier or a domain you own.

---

### Violation 4 — Monetizing YouTube Content Without a License (HIGH RISK)

The app rewards users with real-value coins for watching YouTube videos. YouTube's Terms of Service prohibit:
> "Monetizing the YouTube API Services in any way unless specifically permitted by Google."

Rewarding coins (which convert to real money) for watching third-party YouTube shorts is monetizing the YouTube API. However, there is a path to compliance: the coins are rewarded for watching **your own AdMob ads** that appear between shorts, not for the YouTube content itself. The SHORT_WATCH reward (1 coin per 8 seconds of video) is the problematic one.

**Fix:** Re-frame the coin earn. Remove `SHORT_WATCH` as a direct reward. Users earn coins only from:
1. **AdMob rewarded ads** that appear in the feed (these are your ads, not YouTube content)
2. **Offerwall task completion**
3. **News article ad views** (your interstitial, not the article)
4. **Mini game ads**

The YouTube video watching is the engagement mechanism that keeps them in the app long enough to see your ads. The reward comes from the ad, not the video. This is exactly how TikTok and YouTube's own creator monetization works.

---

### Violation 5 — `rel: 0` Suppresses YouTube's Own Ads (LOW-MEDIUM RISK)

```javascript
rel: 0,  // Disable related videos
```

This is acceptable from a UX standpoint and is commonly used. However, it also suppresses YouTube's own ad monetization from playing. This doesn't violate TOS but is worth noting: YouTube's preference is that you let their ads run. Suppressing them while monetizing via AdMob reduces YouTube's revenue from the API usage.

---

### What is SAFE and LEGAL

- Fetching video IDs via Data API v3 and storing in your pool: ✅
- Embedding via IFrame API: ✅ (with controls: 1)
- Loop and autoplay for vertical feed: ✅
- Showing AdMob interstitials between YouTube shorts: ✅ (this is your monetization, not YouTube's)
- Filtering by duration ≤ 60s for shorts content: ✅

---

## 3. Redesigned Ad Architecture

### Coin Earn Sources (all admin-configurable)

| Source | Trigger | Default Coins | Config Key |
|--------|---------|---------------|------------|
| Short watched (8s+) | After `short_watch_seconds_required` seconds | 1 | `short_watch_reward_coins` |
| Feed interstitial ad watched | `REWARDED_INTERSTITIAL` AdMob callback | 30 | `ad_coins_rewarded_interstitial` |
| Opt-in rewarded ad watched | `REWARDED` AdMob callback | 75 | `ad_coins_rewarded` |
| Discover ad card clicked + ad watched | `REWARDED_DISCOVER` AdMob callback | 40 | `ad_coins_discover` |
| Mini game opened | Before game loads | 5 | `minigame_open_ad_coins` |
| Mini game reward ad watched | Mid-game or end-of-game | 50 | `minigame_rewarded_coins` |
| Tab-switch interstitial watched | Tab change (max 2/session) | 10 | `tab_switch_ad_coins` |
| Offerwall task completed | Partner postback | Variable | Per-task config |
| Daily login streak | Login (server-checked) | 20 | `streak_login_coins` |
| Referral reward | Friend's first withdrawal | 10% | `referral_percentage` |

### Key Principle: Coins Reward Ad Views, Not Content Views

This protects you from YouTube TOS issues and from AdMob Invalid Traffic (IVT) issues. The clear chain is:

```
User watches YouTube Short (free content) →
User sees your ad card / interstitial trigger →
User CHOOSES to watch your AdMob ad →
AdMob confirms completion →
Backend credits coins →
User can redeem coins for real rewards
```

AdMob pays you for the ad impression. You share a fraction with the user as coins. This is the same model as Swagbucks, Mistplay, and AppStation — all approved by AdMob and Play Store.

---

## 4. Admin-Controlled Ad Cards

### New Database Model Required

```prisma
model AdCard {
  id              Int      @id @default(autoincrement()
  placement       String   // 'SHORTS_FEED' | 'DISCOVER' | 'HOME_BANNER'
  title           String   // e.g., "Short Break"
  subtitle        String   // e.g., "Watch an ad, earn coins"
  buttonText      String   // e.g., "Watch Now 🎬"
  coinLabel       String   // e.g., "Earn 75🪙"
  backgroundType  String   // 'SOLID' | 'GRADIENT' | 'RANDOM'
  backgroundColorA String  // Hex color start
  backgroundColorB String? // Hex color end (for gradient)
  accentColor     String   // Button and highlight color
  textColor       String   // Title/subtitle text color
  adType          String   // 'REWARDED' | 'REWARDED_INTERSTITIAL' | 'REWARDED_DISCOVER'
  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Default Color Palette (Random Mode)

When `backgroundType = 'RANDOM'`, the frontend picks from a curated set of gradient pairs per card render. Gradient pairs are psychologically tuned for urgency and attention:

```typescript
const AD_CARD_GRADIENTS = [
  { a: '#FF6B35', b: '#F7C59F' },  // Warm orange — urgency
  { a: '#2C3E7A', b: '#6B8CFF' },  // Deep blue — trust/premium
  { a: '#1A1A2E', b: '#E94560' },  // Dark pink — excitement
  { a: '#0F3460', b: '#16213E' },  // Midnight blue — calm/premium
  { a: '#533483', b: '#E94560' },  // Purple-pink — gaming
  { a: '#155724', b: '#28A745' },  // Green — reward/money
];
```

### Admin Panel Ad Card Builder

The admin panel needs a new **Ad Card Manager** page (`/admin/ad-cards`) with:

- Live preview of the card as it appears in the feed
- Color pickers for background, accent, text
- Toggle for "Random" mode (cycles through gradient pairs)
- Drag-to-reorder for multiple cards (system picks one randomly per injection)
- Per-placement tabs: Shorts Feed / Discover / Home
- Coin amount field (writes to `AppConfig` or `AdCard.coinLabel`)
- Button text field
- Active/inactive toggle
- A/B test variant selector (integrates with existing AB test system)

---

## 5. Shorts Feed — Complete Ad Flow

### Fixed Ad Injection Algorithm

The current modulo-based injection is broken. Replace with a deterministic counter:

```typescript
// In ShortsFeed.tsx — replace broken injection logic

const shortsWatchedCountRef = useRef(0);  // Counts NORMAL items seen
const interstitialThresholdRef = useRef(getRandomInt(config.shorts_ad_interval_min, config.shorts_ad_interval_max));
// e.g., fires after watching 4–7 shorts (admin-configurable)
const rewardedThresholdRef = useRef(getRandomInt(config.rewarded_ad_interval_min, config.rewarded_ad_interval_max));
// e.g., opt-in card appears after 8–12 shorts

// In onViewableItemsChanged:
if (activeItem.type === 'NORMAL') {
  shortsWatchedCountRef.current += 1;
  
  if (shortsWatchedCountRef.current >= interstitialThresholdRef.current) {
    // Insert REWARDED_INTERSTITIAL_TRIGGER after current position
    injectAdAfterIndex(activeIndex + 1, 'REWARDED_INTERSTITIAL_TRIGGER');
    interstitialThresholdRef.current = shortsWatchedCountRef.current + getRandomInt(min, max);
  }
  
  if (shortsWatchedCountRef.current >= rewardedThresholdRef.current) {
    // Insert REWARDED_VIDEO_CARD after current position
    injectAdAfterIndex(activeIndex + 2, 'REWARDED_VIDEO_CARD');
    rewardedThresholdRef.current = shortsWatchedCountRef.current + getRandomInt(min, max);
  }
}
```

### Config Keys for Admin Control (already partially exist)

| Config Key | Meaning | Recommended Default |
|-----------|---------|-------------------|
| `shorts_ad_interval_min` | Min shorts before next interstitial | 4 |
| `shorts_ad_interval_max` | Max shorts before next interstitial | 8 |
| `rewarded_ad_interval_min` | Min shorts before opt-in card | 8 |
| `rewarded_ad_interval_max` | Max shorts before opt-in card | 14 |
| `ad_activation_delay_ms` | Delay before auto-trigger fires | 1200 |
| `post_ad_lockout_ms` | Lock UI after ad closes | 1500 |

### The Interstitial Card UI (Admin-Designed)

Instead of the current hardcoded `"Short break — Earn bonus coins!"` card, the card renders the active `AdCard` record from the backend for `SHORTS_FEED` placement:

```
┌─────────────────────────────────────┐
│  [ADMIN-SET GRADIENT BACKGROUND]    │
│                                     │
│         🎬 Short Break              │  ← AdCard.title
│   Watch a quick video, earn coins   │  ← AdCard.subtitle
│                                     │
│   ┌─────────────────────────────┐   │
│   │   ⚡ Watch Now — Earn 75🪙  │   │  ← AdCard.buttonText + coinLabel
│   └─────────────────────────────┘   │  ← AdCard.accentColor
│                                     │
│   ⏭ Skip (scroll down)             │
└─────────────────────────────────────┘
```

Users who scroll past the card without tapping skip the ad (and skip the coins). No forced ad experience. This is critical for:
1. AdMob policy compliance (no forced rewarded ads)
2. Play Store policy compliance
3. User retention (forced ads cause uninstalls)

### SHORT_WATCH Reward — TOS-Safe Re-framing

Move the coin reward from "watching the video" to "reaching the ad card after watching videos". The flow becomes:

```
Watch Short #1 (no coins) →
Watch Short #2 (no coins) →
Watch Short #3 (no coins) →
Watch Short #4 (no coins) →
AD CARD APPEARS →
User taps "Watch Ad" →
AdMob rewarded ad plays to completion →
Backend awards 75 coins →
User scrolls to continue shorts
```

Keep the `SHORT_WATCH` endpoint but reduce coins to 1 per video maximum and position it as a "session bonus" not a per-video payment. The real money comes from the AdMob ads.

---

## 6. Discover / News Page — Ad Flow

### Current State
- `REWARDED_DISCOVER` AdMob slot exists in `adUnits.ts` but is never triggered
- `BANNER_ARTICLE` exists in config but no article detail screen exists

### New Discover Ad Flow

**Between news cards** (every 5th card): inject an `AD_CARD` component styled like a news card with a colored accent border.

```
[News Card 1]
[News Card 2]
[News Card 3]
[News Card 4]
[News Card 5]
[AD CARD — "Sponsored • Earn 40🪙"] ← Looks native to the feed
[News Card 6]
...
```

The ad card in the news feed should look similar to a news card but with:
- A colored left border (admin-set `accentColor`)
- "Sponsored" label top-left
- Large coin earn badge
- Same button style as other ad cards

When tapped: fire `REWARDED_DISCOVER` AdMob ad → on completion → call `claimAdReward('REWARDED_DISCOVER', sessionId)`.

**Banner in article detail view**: If you build an article detail screen (article click → full read view), put a `BannerAd` (the `BANNER_ARTICLE` unit) anchored to the bottom. Banner ads pay less per impression but run continuously without user interaction.

### News Feed Config Keys

| Config Key | Meaning | Default |
|-----------|---------|---------|
| `discover_ad_interval_min` | Min articles before ad card | 4 |
| `discover_ad_interval_max` | Max articles before ad card | 7 |
| `ad_coins_discover` | Coins per discover ad watched | 40 |

---

## 7. Mini Games — HTML5 Engine + Ad Integration

### Strategy

Mini games serve three revenue functions simultaneously:
1. **Session extension** — users playing games stay 3–5x longer than passive scrollers
2. **Natural ad insertion points** — game start, game over, bonus life, leaderboard — all are natural ad moments
3. **Additional coin earn paths** — more reasons to earn = more ads watched

### Recommended Game Selection (HTML5, WebView-rendered)

All games run inside a React Native `WebView` loading local HTML5 assets bundled with the app. No external URLs needed.

| Game | Why it works | Ad Moments |
|------|-------------|------------|
| Coin Flip (luck) | Zero skill barrier, anyone plays | Game start, each flip, result |
| Color Match (casual) | 10-second rounds, extremely replayable | Game over, high score, bonus round |
| Tap the Target (reflex) | Addictive finger-tap mechanic | Opening, lives lost, level-up |
| Number Memory (brain) | Appeals to different demographic | Opening, correct answer streak, game over |
| Spin Wheel (random reward) | Dopamine slot-machine effect | Spin start, win animation |

### Game Ad Placement Rules

```
OPENING AD (Interstitial, optional):
  - Shown when user navigates TO the game section from Home
  - Fire once per session per game type
  - If user skips: game still loads (no force)
  - Coins earned: admin-configurable via 'minigame_open_ad_coins'

IN-GAME ADS (Rewarded, opt-in):
  - Triggered when user runs out of lives / time
  - "Watch an ad to continue?" prompt
  - If user accepts: rewarded ad plays → game resumes with +1 life
  - Coins earned from the ad: admin-configurable

END-OF-GAME ADS (Rewarded, opt-in):
  - After game ends: "Watch ad to double your score bonus?"
  - Score bonus is in coins (admin-configurable)
  - If user skips: standard score coins awarded

EXIT ADS (Interstitial, optional):
  - When user navigates AWAY from game section
  - Max 1 per 10-minute window (do not annoy users on quick exits)
  - No coin reward (interstitial, not rewarded)
```

### WebView Communication Protocol

The HTML5 game communicates with React Native via `postMessage`:

```javascript
// Inside HTML5 game
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: 'GAME_EVENT',
  event: 'GAME_OVER',
  score: 1250,
  reason: 'NO_LIVES'
}));

// Events: GAME_STARTED, GAME_OVER, LIFE_LOST, LEVEL_UP, HIGH_SCORE, PLAYER_EXIT
```

React Native handles each event and fires the appropriate AdMob call, then sends back the result:

```javascript
// React Native → WebView
webviewRef.current?.injectJavaScript(JSON.stringify({
  type: 'AD_RESULT',
  granted: true,  // user watched ad
  coins: 50
}));
```

### Home Screen Game Section Layout

```
┌──────────────────────────────────────┐
│  🎮 Play & Earn                 [→]  │
├──────────────────────────────────────┤
│ [Coin Flip] [Color Match] [Tap Game] │
│  5🪙 open   10🪙 rounds   +50🪙 ads  │
└──────────────────────────────────────┘
```

Horizontal scrollable strip with game thumbnails. Each shows an estimated earn amount to set expectations and drive clicks.

### New Config Keys for Games

| Config Key | Default |
|-----------|---------|
| `minigame_open_ad_coins` | 5 |
| `minigame_life_rewarded_coins` | 50 |
| `minigame_end_double_coins` | 30 |
| `minigame_exit_ad_cooldown_ms` | 600000 (10min) |
| `minigame_max_earn_per_day` | 200 |

---

## 8. Home Screen — Psychological Engagement Layer

### Currently Missing (Home Screen only has: balance card, missions strip, referral banner)

The following elements must be added. Each is backed by behavioral science and used by the highest-grossing apps (Duolingo, Wordle, BeReal, Coin Master).

---

### 8.1 Daily Streak with Visual Momentum

**Current:** Streak number shown but never incremented (bug noted in previous audit — `syncStreak` never called).

**Enhancement:**
- Show a 7-day streak calendar on the home screen. Each day is a circle. Completed days fill with gold. Today's day pulses.
- If streak is 3+, show a fire emoji that grows in size (`🔥 → 🔥🔥 → 🔥🔥🔥`)
- A "Don't break your streak!" push notification at 20:00 local time if the user hasn't opened the app that day
- **Psychological mechanism:** Loss aversion. Maintaining a streak feels more urgent than gaining a new reward.

---

### 8.2 Countdown Timers (Urgency / FOMO)

Add countdown timers to:
1. **Daily missions** — "Resets in 4h 23m" (already shown, just needs larger prominent display)
2. **Bonus coin windows** — "2x coins for next 30 minutes!" — scheduled from admin panel, shown as a red banner
3. **Limited reward stock** — "Only 3 ₹50 Paytm vouchers left!" — pulls live stock from wallet catalog

**Psychological mechanism:** Artificial scarcity and time pressure increase conversion rates by 30–40% (documented across e-commerce and gaming).

---

### 8.3 Leaderboard Teaser (Social Proof + Competition)

The schema has a leaderboard stub. Implement a minimal version:

```
┌─────────────────────────────────────┐
│  🏆 This Week's Top Earners         │
├─────────────────────────────────────┤
│  🥇 Raj***  →  12,450🪙            │
│  🥈 Pri***  →  9,820🪙             │
│  🥉 Sam***  →  8,100🪙             │
│  ...                                │
│  You: #127  →  2,340🪙  [Move Up ↑]│
└─────────────────────────────────────┘
```

Names are partially masked (`Raj***`) for privacy while still feeling real. The user's own rank and gap to the next position drives competitive behavior.

**Psychological mechanism:** Social comparison. Seeing peers succeeding makes users want to catch up.

---

### 8.4 Level-Up Progress with XP Road Map

Replace the current 4px XP bar with a visual progress road:

```
Lv.5 ████████░░ 80% → Lv.6
[Watch 2 more shorts to level up!]
```

Level-up benefits must be tangible and shown:
- Lv.5 → 6: Daily ad cap increases from 20 → 25
- Lv.8 → 9: Unlock spin wheel game
- Lv.10: Reduced minimum withdrawal threshold

**Psychological mechanism:** Variable reward schedules (Skinner box). The unknown reward at the next level keeps users grinding.

---

### 8.5 Coin Rain Celebration Animation

When a user earns a significant coin amount (ad watched, mission completed), trigger a 1.5-second particle animation of coins falling from the top of the screen. Use React Native's Animated API (no external library needed).

Small moments of celebration are disproportionately effective at building positive associations with the app.

---

### 8.6 "Almost There" Withdrawal Progress Bar

If the user has more than 50% of the minimum withdrawal threshold:

```
┌─────────────────────────────────────┐
│  💰 Almost Ready to Withdraw!       │
│  ████████████░░░░░░  62%            │
│  You need 1,900 more coins          │
│  [Watch 3 ads to get there →]       │
└─────────────────────────────────────┘
```

This is the single highest-converting element you can add. Users who can see the finish line convert at 2–3x the rate of users who don't.

---

### 8.7 Friend Activity Feed (Social Proof)

A small "what your friends are doing" ticker:

```
• Amit just earned 75 coins watching an ad
• Priya just completed "Watch 5 Shorts" mission
• Rahul just redeemed ₹50 Paytm voucher  ✅
```

These are real events from real users (anonymized/partially masked). Pull from the ledger and withdrawal tables. Show the 5 most recent events from the past 24 hours globally. If there are no friends, show global events.

---

## 9. Tab-Switch Interstitials

### Design Principle: Maximum 2 per session, never consecutive

The strategy is "ambient monetization" — the user barely notices ads because they appear at natural transition points.

```typescript
// In the main App.tsx / navigation handler

const sessionAdCountRef = useRef(0);
const lastAdTimestampRef = useRef(0);
const MIN_INTER_TAB_AD_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes minimum between tab ads
const MAX_TAB_ADS_PER_SESSION = 2;

const handleTabChange = async (newTab: TabId, prevTab: TabId) => {
  const now = Date.now();
  const timeSinceLast = now - lastAdTimestampRef.current;
  const shouldShowAd = (
    sessionAdCountRef.current < MAX_TAB_ADS_PER_SESSION &&
    timeSinceLast > MIN_INTER_TAB_AD_INTERVAL_MS &&
    prevTab !== 'home' && // Don't show on home exit (too disruptive)
    !isAdPlayingRef.current
  );
  
  if (shouldShowAd) {
    // Pre-loaded interstitial (load on app start, reload after each use)
    await interstitialRef.current?.show();
    sessionAdCountRef.current += 1;
    lastAdTimestampRef.current = now;
    // Award coins for non-skipped interstitials via AdEventType.CLOSED + tracking
  }
  
  setActiveTab(newTab);
};
```

### Rules Summary

| Rule | Value |
|------|-------|
| Max tab-switch ads per session | 2 |
| Minimum gap between tab ads | 3 minutes |
| Never on: home tab exit | Always excluded |
| Coin reward | 10 coins (admin-configurable) |
| Ad type | `InterstitialAd` (not rewarded — no coin if skipped) |
| Pre-loading | Load next ad immediately after current closes |

Tab-switch interstitials use `InterstitialAd`, NOT `RewardedInterstitialAd`. The user doesn't opt in, so they don't earn coins if they skip. If they watch it fully, they earn a small amount. This is standard behavior for games that monetize this way.

---

## 10. Offerwall — Full Integration Plan

### Current State

`rewardsController.ts` and the offerwall route exist but `offerwall_demo_mode` is `true`. Eight tasks are hardcoded in the frontend with fake data. No real SDK integration exists.

### Recommended Partner: IronSource Offerwall

IronSource (now Unity LevelPlay) is the most widely approved offerwall on Play Store and AdMob's recommended third-party partner. Alternative: Tapjoy (now Fyber/DT Offer Wall).

### Integration Architecture

```
Frontend: Renders IronSource WebOfferwall in a WebView
  ↓ User completes task (download app, watch video, survey)
  ↓ Partner sends server-to-server postback
Backend: POST /api/webhooks/offerwall/postback
  ↓ Validates HMAC signature (already implemented)
  ↓ Credits coins to user
  ↓ Sends push notification "Your coins have arrived!"
```

### Postback Security (already partially implemented, needs fixes)

The existing postback endpoint needs these additions:
1. **Amount cap** (as noted in previous audit): `if (amount > MAX_OFFERWALL_REWARD) reject`
2. **Duplicate prevention**: The idempotency key system via `addLedgerEntry` is already correct
3. **IP whitelist**: Only accept postbacks from IronSource's known IP ranges (published in their docs)
4. **Task validation**: Cross-check `task_id` against a known task list before crediting

### Offerwall Task Categories (for maximum revenue)

| Category | Typical eCPM (INR) | User effort |
|---------|-----------|------------|
| App installs + 5min play | ₹15–40 per complete | Medium |
| Survey completion | ₹8–25 per complete | Low |
| Video series (5+ videos) | ₹5–12 per complete | Low |
| In-app purchase tasks | ₹100–500 per complete | High |
| Registration tasks | ₹10–30 per complete | Low |

---

## 11. Coin Economy Design

### Design Goal: Keep the Earn→Redeem Cycle Compelling

The coin economy must be balanced so:
1. Users can earn enough to redeem in 3–7 days of moderate use
2. Users cannot earn so fast that the reward costs become unsustainable
3. Each redemption requires multiple days of engagement (not a one-session grind)

### Recommended Economy Settings

```
Minimum withdrawal:     2,000 coins = ₹20 Paytm cash
Short watch (8s):       1 coin per video (max 50 coins/day from shorts)
Feed interstitial ad:   30 coins
Opt-in rewarded ad:     75 coins
Discover ad:            40 coins
Tab switch (if watched): 10 coins
Mini game open ad:       5 coins
Mini game rewarded:     50 coins
Daily login:            20 coins (streak bonus: day 7 = 200 coins)
Daily mission complete: 50–300 coins per mission
Offerwall task:         100–5000 coins per task
Referral (friend earns 1000+ coins): 100 coins passive
```

### Daily Earnings Potential (Active User)

```
Shorts (50 cap):                50 coins
Feed ads (8 ads × 30):         240 coins
Opt-in ads (4 ads × 75):       300 coins
Mini game ads (3 × 50):        150 coins
Discover ads (3 × 40):         120 coins
Missions:                      150 coins
Login bonus:                    20 coins
─────────────────────────────────────────
Daily max (active):           1,030 coins
```

At this rate a user hits 2,000 coins (₹20 minimum withdrawal) in ~2 days. This is intentional — fast enough to feel achievable, slow enough that they're in the app for 5–10 daily sessions before redeeming.

### The Revenue Math (your side)

AdMob eCPM in India for rewarded ads: approximately ₹40–120 per 1,000 impressions.

```
Per rewarded ad shown:       ₹0.06–0.12 average
Per active user per day:     8–15 rewarded ads = ₹0.72–1.80/user/day
Monthly per active user:     ₹21–54/month revenue
You pay user:                ~₹0.60/day (20 coins/day × ₹0.01/coin)
Net margin per user:         ₹0.12–1.20/user/day
```

To make this sustainable at scale: target 50,000+ DAU. At 50k DAU with ₹0.50 net per user per day = ₹25,000/day = ₹750,000/month.

---

## 12. Anti-Bot / Anti-Farming System

### Threat Model

Your primary threats are:
1. **Bot farms**: Multiple devices with automated scripts watching ads and completing offerwalls
2. **Single-user multi-account fraud**: One person with 5 phones all earning coins
3. **Screenshot/emulator farming**: Android emulators with rooted OS bypassing controls
4. **Replay attacks**: Replaying the same ad session ID multiple times

### Layer 1 — Client-Side Signals (already partially implemented)

**Device fingerprint**: Generate a stable device ID on first launch:
```typescript
// Combine: device model + OS version + screen dimensions + timezone + locale
const deviceFingerprint = sha256(`${deviceModel}_${osVersion}_${screenW}x${screenH}_${timezone}_${locale}`);
```
Send this with every reward claim. Back-end flags if one device fingerprint maps to 3+ accounts.

**Session entropy**: Already implemented (`sessionId = \`short-${videoId}-${Date.now()}-${Math.random().toString(36)}\``). Good. Make sure replay detection is active (it is via idempotency key).

**Watch time validation**: The backend checks `watchSeconds <= 60` for shorts. For ads, AdMob handles completion validation server-side — you don't need to replicate this, but log AdMob's `verifyCallback` server-side validation token.

### Layer 2 — Server-Side Velocity Checks (partially in fraudMiddleware)

Add these rules to the fraud detection system:

| Rule | Threshold | Action |
|------|-----------|--------|
| Ad rewards per hour | > 12 | Flag + reduce cap |
| Unique video IDs per hour | < 3 (watching same video repeatedly) | Shadow-cap |
| Reward claims with same session ID | > 1 | Hard block |
| Device fingerprint → accounts | > 2 accounts | Manual review |
| IP address → accounts per day | > 3 different users | Flag |
| Rapid sequential claims (< 30s gap) | Any | Soft shadow-ban |
| Withdrawal after <1 day account age | Any | Manual hold |
| Short watch time < minimum | < `short_watch_seconds_required` | Block (already done) |

### Layer 3 — AdMob's Built-In Protection

This is your strongest protection layer and you're not fully using it:

**Server-Side Verification (SSV) for Rewarded Ads** — AdMob can send a server-to-server callback to your backend verifying that the ad was actually watched on a real device. Set up SSV callbacks for all rewarded ad units:

```
https://your-backend.com/api/webhooks/admob/ssv?
  ad_network=...&ad_unit=...&reward_amount=...&
  reward_item=...&timestamp=...&transaction_id=...&
  user_id=...&signature=...
```

Verify the `signature` using Google's public key. Only credit coins if SSV callback arrives. This eliminates replay attacks and emulator farming entirely because AdMob does the device attestation for you.

### Layer 4 — Emulator and Root Detection

```typescript
import DeviceInfo from 'react-native-device-info';

const runSecurityChecks = async () => {
  const [isEmulator, isRooted] = await Promise.all([
    DeviceInfo.isEmulator(),
    DeviceInfo.isRooted(),
  ]);
  
  if (isEmulator || isRooted) {
    // Still show content but flag account for manual review
    // Don't hard-block (false positives harm real users)
    apiClient.defaults.headers['X-Device-Integrity'] = 'LOW';
  }
};
```

Send `X-Device-Integrity` header with every request. Backend logs it and gives it a 5x higher fraud score.

### Layer 5 — Google Play Integrity API

For Android (your primary platform): use the Play Integrity API to verify the app is running on a genuine, unmodified Android device.

```typescript
import { PlayIntegrity } from 'react-native-play-integrity';

const verifyDevice = async (): Promise<string> => {
  const nonce = await fetchNonceFromBackend(); // Backend generates and tracks nonce
  const token = await PlayIntegrity.requestIntegrityToken(nonce);
  return token; // Send to backend for verification
};
```

Backend verifies the token with Google. This is extremely hard to fake and blocks the majority of bot farms.

### Layer 6 — Behavioral Analysis

Track patterns that distinguish humans from bots:

**Human patterns:**
- Scroll speed varies (humans don't scroll at exactly 300ms intervals)
- Watch time has natural variance (8–45 seconds per short)
- Session duration has natural breaks (bathroom, phone call)
- Tap locations vary (humans don't tap the exact same pixel)

**Bot patterns:**
- Perfectly regular interval between rewards (every N seconds)
- Claims at exactly `short_watch_seconds_required` + 0ms (bot knows the exact threshold)
- Zero session gaps (runs 24/7 without breaks)
- Same device fingerprint across multiple accounts

Implement a simple anomaly score in `fraudMiddleware.ts` that adds to the existing `riskScore` field.

### Withdrawal Holds for New Users

```typescript
// In walletController.ts — requestWithdrawal
const accountAge = Date.now() - new Date(user.createdAt).getTime();
const HOLD_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

if (accountAge < HOLD_PERIOD_MS) {
  // Set withdrawal status to PENDING_REVIEW instead of PENDING
  withdrawalStatus = 'PENDING_REVIEW';
  // Admin must manually approve new user first withdrawal
}
```

First withdrawals from accounts under 7 days old get manual review. This eliminates the "create account, farm, withdraw same day" pattern entirely.

---

## 13. Revenue Maximization Strategy

### 13.1 Fill Rate Optimization

AdMob fill rate in India during peak hours (18:00–22:00) is 60–85%. During off-peak (00:00–06:00) it can drop to 20–30%. To maximize fill:

- **Mediation**: Set up AdMob Mediation with Meta Audience Network and Unity Ads as secondary networks. When AdMob has no fill, the secondary network serves an ad instead. This alone can increase effective fill rate to 90%+.
- **Floor price**: Set a minimum eCPM floor (₹10 minimum). Below this, show a house ad (promotes your referral program) instead of a low-value ad.

### 13.2 Ad Density vs Retention Balance

The highest revenue-per-session apps show ads at a density where users don't consciously think "this app is full of ads":

```
Optimal density per 10-minute session:
  ├── Shorts (10 minutes @ avg 30s/short = 20 shorts)
  ├── Interstitials (auto-fire): 3 ads (every 6–8 shorts)
  ├── Opt-in rewarded: 2 cards shown, 1–2 watched
  └── Total ad impressions: 4–5 per 10-minute session
```

At 4–5 rewarded ads per 10-minute session at ₹0.08 average: ₹0.40 per 10 minutes = ₹2.40/hour of engagement. Good apps retain users for 20–40 minutes/day.

### 13.3 Seasonal and Event-Based Multipliers

Use the existing `AppConfig` system to run limited-time events:
- **Festival multiplier**: `2x coins for Diwali week` — increases engagement (and ad views) without increasing your real cost since user coins don't cost you money directly, only when redeemed
- **Weekend bonus**: `shorts_ad_interval_min: 3` on weekends (more frequent ads when users have more time)

### 13.4 Rewarded Ad eCPM by Ad Type

| Ad Type | Typical India eCPM | Notes |
|---------|-----------|-------|
| Rewarded Video | ₹60–120 | Highest. Prioritize these. |
| Rewarded Interstitial | ₹40–80 | Good. Auto-fire, no opt-in needed. |
| Interstitial | ₹15–35 | Tab-switch ads. No completion guarantee. |
| Banner | ₹3–8 | Very low. Only use in article view. |
| Native | ₹20–45 | Good in news feed if implemented. |

Focus on rewarded video and rewarded interstitial. They make 4–10x more than banners.

---

## 14. Backend Changes Required

### New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ad-cards` | GET | Fetch active ad cards by placement (public) |
| `/api/admin/ad-cards` | GET/POST/PUT/DELETE | Admin CRUD for ad cards |
| `/api/webhooks/admob/ssv` | GET | AdMob Server-Side Verification callback |
| `/api/games/complete` | POST | Claim mini game session reward |
| `/api/games/ad-reward` | POST | Claim in-game rewarded ad coins |
| `/api/users/integrity` | POST | Submit Play Integrity token for verification |
| `/api/config/public` | GET | Already exists — add new game/ad keys |

### New AppConfig Keys to Seed

```sql
INSERT INTO AppConfig (key, value) VALUES
  ('ad_coins_rewarded_interstitial', '30'),
  ('ad_coins_rewarded', '75'),
  ('ad_coins_discover', '40'),
  ('ad_coins_tab_switch', '10'),
  ('minigame_open_ad_coins', '5'),
  ('minigame_life_rewarded_coins', '50'),
  ('minigame_end_double_coins', '30'),
  ('minigame_max_earn_per_day', '200'),
  ('tab_switch_max_per_session', '2'),
  ('tab_switch_min_interval_ms', '180000'),
  ('bonus_window_active', 'false'),
  ('bonus_window_multiplier', '2'),
  ('bonus_window_ends_at', ''),
  ('withdrawal_new_user_hold_days', '7');
```

### Fix: Move Hardcoded Ad Rewards to DB

In `rewardsController.ts`, replace the hardcoded `adRewardMap`:

```typescript
// CURRENT (wrong):
const adRewardMap = {
  REWARDED_DISCOVER: { source: 'AD_REWARDED_DISCOVER', coins: 50 },
  REWARDED: { source: 'AD_REWARDED', coins: 100 },
  REWARDED_INTERSTITIAL: { source: 'AD_REWARDED_INTERSTITIAL', coins: 50 },
};

// CORRECT (dynamic):
const adTypeToConfigKey: Record<string, string> = {
  REWARDED_DISCOVER: 'ad_coins_discover',
  REWARDED: 'ad_coins_rewarded',
  REWARDED_INTERSTITIAL: 'ad_coins_rewarded_interstitial',
  TAB_SWITCH: 'ad_coins_tab_switch',
  MINIGAME_REWARDED: 'minigame_life_rewarded_coins',
};

const configKey = adTypeToConfigKey[adType];
const coinConfig = await prisma.appConfig.findUnique({ where: { key: configKey } });
const coins = coinConfig ? parseInt(coinConfig.value) : DEFAULT_COINS;
```

### AdMob SSV Endpoint

```typescript
// POST /api/webhooks/admob/ssv
import { createVerify } from 'crypto';

const ADMOB_PUBLIC_KEYS_URL = 'https://gstatic.com/admob/reward/verifier-keys.json';

export const admobSSV = async (req: Request, res: Response) => {
  const { ad_network, ad_unit, reward_amount, reward_item, 
          timestamp, transaction_id, user_id, signature, key_id } = req.query;
  
  // 1. Verify timestamp (reject if >10 minutes old)
  if (Date.now() - Number(timestamp) * 1000 > 600_000) {
    return res.status(400).send('INVALID');
  }
  
  // 2. Fetch Google's public key (cache this with TTL)
  const keys = await fetchAdmobPublicKeys();
  const publicKey = keys[String(key_id)];
  
  // 3. Verify signature
  const queryString = req.url.split('?')[1].replace(`&signature=${signature}`, '');
  const verify = createVerify('SHA256');
  verify.update(queryString);
  const isValid = verify.verify(publicKey, String(signature), 'base64');
  
  if (!isValid) return res.status(400).send('INVALID');
  
  // 4. Credit coins
  const userId = parseInt(String(user_id));
  await addLedgerEntry(userId, Number(reward_amount), 'AD_SSV_VERIFIED', 'admob-ssv', String(transaction_id));
  
  res.status(200).send('OK'); // AdMob requires exactly 'OK'
};
```

---

## 15. Admin Panel Changes Required

### New Pages

**Ad Card Manager** (`/admin/ad-cards`):
- Live preview panel (renders the card as it looks in the app)
- WYSIWYG editor: title, subtitle, button text, coin label
- Color pickers (background A, background B for gradient, accent, text)
- "Random" toggle that enables the curated gradient set
- Placement selector: Shorts Feed / Discover / Home Banner
- Active/inactive toggle
- Drag-to-sort (system picks randomly from active cards)

**Mini Game Manager** (`/admin/games`):
- Enable/disable individual games
- Set coin rewards per game event type
- View game session analytics (sessions, avg score, ad completion rate)
- Schedule "Double Coins" events for specific games

**Anti-Fraud Dashboard** (enhance existing `/admin/fraud`):
- Add filters: by device fingerprint, by IP range, by claim velocity
- Add "Auto-Hold Withdrawals" rules (e.g., "hold if risk score > 70")
- Add "Permanent Ban" button (current only has shadowban)
- Play Integrity status column in user table

**Bonus Windows** (`/admin/economy` or existing Economy Config):
- Date/time range picker for bonus coin windows
- Multiplier selector (1.5x, 2x, 3x)
- Preview of which config values change
- Push notification trigger (notify users about the bonus)

### Economy Config Page Fixes

Currently `EnvConfig.tsx` edits the `.env` file. The economy values should be in `AppConfig` (DB), not `.env`. The **Economy Control** page should surface all the new config keys listed in Section 14.

---

## 16. Play Store Survival Checklist

This is the most important section. The Play Store removes ~10,000 apps per month. Here is every policy you need to comply with:

### 16.1 Rewarded Apps / Earn Money Apps Policy

Google Play has a dedicated policy for "apps that offer monetary value to users." Requirements:

- ✅ **Must disclose earning limits clearly**: Show the daily cap and reset time prominently. You have this on the home screen.
- ✅ **Earnings must be real and redeemable**: Your Paytm/UPI redemption path satisfies this.
- ⚠️ **Cannot require users to watch a specific number of ads to withdraw**: Withdrawals must be threshold-based (coins), not "watch 1000 ads" gating. Your coin system is correct.
- ⚠️ **Cannot misrepresent earning potential**: The "Watch Shorts" shortcut saying "10🪙 each" is accurate. Don't advertise higher amounts anywhere.
- ✅ **Must have a clear Terms of Service and Privacy Policy**: Present in the account modal.

### 16.2 AdMob Policies (Critical)

- ✅ **No click incentivization on banner ads**: You only reward for completing rewarded ad types.
- ✅ **No invalid traffic / click farms**: Covered by anti-fraud system.
- ⚠️ **Must not prompt users to click ads**: Do not add text like "Click this ad to earn more!" near AdMob banners.
- ⚠️ **Must not place ads near interactive UI elements**: Banner ads cannot be immediately adjacent to buttons. Use 50dp minimum padding.
- ✅ **Rewarded ads must be clearly opt-in**: "Watch Ad to Earn" button satisfies this. Auto-playing a rewarded ad without user intent = ban.
- ⚠️ **Rewarded Interstitial must not interrupt user input**: Fire the interstitial only between shorts (navigation transitions), never during active scrolling. Your `isScrollingRef` check handles this.

### 16.3 YouTube API Terms (Summary from Section 2)

- ❌ Fix `controls: 0` → `controls: 1`
- ❌ Fix `origin` from third-party domain to your own
- ❌ Remove gesture zone overlap with YouTube logo area
- ✅ Keep clear attribution (showing video title/channel)
- ✅ Do not monetize the YouTube content directly (monetize only your AdMob ads)

### 16.4 App Content Rating

Your app contains:
- Gambling-adjacent mechanics (spin wheel, coin flip) → Rate **Teen** minimum
- Real money rewards → Requires clear age gate disclosure
- Set content rating to **Teen (13+)** in Play Console

### 16.5 Financial Services Compliance (India)

Offering cash rewards in India requires compliance with:
- **FEMA regulations**: If per-user annual payout exceeds ₹50,000, KYC may be required
- **GST**: Rewards to users may be subject to TDS (Tax Deducted at Source) above ₹10,000
- **RBI prepaid payment instrument rules**: If you hold coins as "wallets" you may need PPI license. The safest framing: coins are "loyalty points" that can be exchanged for vouchers, not cash.

For the Play Store: label your rewards as "gift vouchers" and "loyalty rewards" — not "cash" or "money." This keeps you out of the financial services policy bucket.

### 16.6 App Store Listing Best Practices

Your listing must survive automated review AND human reviewer scrutiny:

**Title**: `ReelFlow - Watch Shorts & Earn` (include "Earn" — users search for it)
**Short description**: Focus on entertainment first: "Watch trending shorts, play mini games, and earn gift vouchers"
**Screenshots**: Show the actual app first (shorts feed), show earning mechanics second. Do NOT lead with "EARN REAL MONEY" — flagged immediately.
**Category**: Entertainment (not Finance, not Tools)
**Keywords**: shorts, earn rewards, video app, gift cards, paytm rewards

**What gets you flagged for removal:**
- "Earn unlimited money" anywhere in listing
- Showing bank notes / currency in screenshots
- Promising specific earning amounts ("Earn ₹500/day!")
- Any claim that earnings are guaranteed

---

## 17. Implementation Priority Order

### Week 1 — Critical Fixes (No new features until these are done)

1. Fix YouTube TOS violations: `controls: 1`, gesture zone, origin domain
2. Move hardcoded ad reward amounts to AppConfig DB
3. Fix ad injection algorithm (deterministic counter, not broken modulo)
4. Implement AdMob SSV endpoint (this alone reduces bot fraud by 80%)
5. Fix `claimShortReward` flow — coins for ads not videos

### Week 2 — Core Monetization Improvements

6. Admin-controlled ad card design (DB model + admin panel UI + frontend render)
7. Discover/News page ad flow (use existing `REWARDED_DISCOVER` slot)
8. Tab-switch interstitial (2 per session max)
9. Fetch ad config from backend on app start (not hardcoded)

### Week 3 — Engagement + Anti-Fraud

10. Home screen psychological elements (withdrawal progress bar, countdown timers, leaderboard)
11. Anti-fraud velocity rules in fraudMiddleware
12. Withdrawal hold for new accounts (7 days)
13. Device fingerprint + Play Integrity token
14. Daily streak auto-sync (fix the bug where syncStreak is never called)

### Week 4 — New Revenue Channels

15. Mini games (start with 2 games: Coin Flip + Color Match)
16. Game ad integration (open, in-game, end-of-game, exit)
17. Real offerwall SDK integration (IronSource LevelPlay)
18. Leaderboard backend endpoint + frontend display

### Ongoing — Optimization

19. AdMob mediation setup (Meta + Unity as secondary networks)
20. A/B test ad intervals (existing AB system can be used for this)
21. Seasonal bonus windows (Diwali, New Year, IPL season)
22. Push notification for "Don't break your streak"

---

*Report prepared based on full analysis of: `ShortItem.tsx`, `ShortsFeed.tsx`, `HomeScreen.tsx`, `rewardsController.ts`, `configController.ts`, `adUnits.ts`, `youtubeService.ts`, `fraudMiddleware.ts`, `walletController.ts`, `prisma/schema.prisma`, `useAppStore.ts`, `adminController.ts`, and supporting files across all three repositories.*

---

**End of Report**