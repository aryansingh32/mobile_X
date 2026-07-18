# ReelFlow — Admin Panel as the Single Source of Truth
## Remote-Controlled Monetization, Content & Behavior Engine

> Written for AI implementation. Goal: nothing in the app should be hardcoded. Ad placement, ad-to-coin reward mapping, daily caps, fraud thresholds, haptics, animations, and every piece of UI copy must be readable and writable from the admin panel, fetched by the app at runtime. This document is the build spec for that system.

---

## 0. What "Fully Admin-Controlled" Means

Today the codebase has a `AppConfig` key-value table and a config endpoint, but most of the actual ad-placement and reward logic is hardcoded directly inside frontend and backend files. The admin panel can already edit some numeric settings, but the app never reads them. This document closes that gap completely: every number, every interval, every coin amount, every line of UI text, and every animation/haptic toggle moves into one config system that the admin panel owns and the app fetches.

---

## 1. Evidence — Exactly What Is Hardcoded Right Now

This is the concrete list of hardcoded values found in the current source code that must move into the admin-controlled system. Treat this as the worklist.

### 1.1 Ad Placement Intervals (Hardcoded, Never Read From Config)

**`src/components/discover/DiscoverScreen.tsx` line 101-102:**
```typescript
const adInterval = Math.floor(Math.random() * (6 - 3 + 1)) + 3; // 3 to 6
if (data.length % adInterval === 0 || fetchedItems.length > 5) { ... }
```
This randomly inserts a sponsored ad card every 3–6 news cards. The range `3` and `6` is hardcoded in the component. Interestingly, the backend's `configController.ts` already validates config keys named `discover_ad_interval_min` and `discover_ad_interval_max` — the validation exists, but nothing in the app ever fetches or applies them. The wiring is half-built.

**`src/components/shorts/ShortsFeed.tsx` lines 52-69:**
```typescript
if ((items.length + fetchedItems.length) % 6 === 0) { /* insert interstitial */ }
if ((items.length + fetchedItems.length) % 11 === 0) { /* insert rewarded video card */ }
```
The interstitial trigger appears every 6th short; the opt-in rewarded video card every 11th short. Both numbers are hardcoded. The backend again already validates `shorts_ad_interval_min/max` and `rewarded_ad_interval_min/max` config keys that are never consumed.

### 1.2 Coin Reward Amounts (Hardcoded in Backend Controller)

**`src/controllers/rewardsController.ts` lines 108-111:**
```typescript
const adRewardMap: Record<string, { source: string; coins: number }> = {
  REWARDED_DISCOVER: { source: 'AD_REWARDED_DISCOVER', coins: 50 },
  REWARDED: { source: 'AD_REWARDED', coins: 100 },
  REWARDED_INTERSTITIAL: { source: 'AD_REWARDED_INTERSTITIAL', coins: 50 },
};
```
Every coin value for every ad placement is a hardcoded literal inside a TypeScript object. To change a reward amount today requires a code deploy, not an admin panel edit.

### 1.3 Daily Caps (Partially Config-Driven, Inconsistent)

`claimAdReward` correctly reads `daily_ad_cap` from `AppConfig` (good — this one is already dynamic). But the cap applies as one flat number across ALL ad types combined. There is no per-ad-type cap (e.g., "max 5 interstitials but 15 rewarded videos"), no per-user-tier cap (e.g., higher caps for high-trust users), and no cooldown-between-ads enforcement at all — a user could claim ads back-to-back with zero seconds between them as long as they stay under the daily count.

### 1.4 Haptics (Hardcoded Everywhere, No Toggle)

Every screen calls `Haptics.impactAsync(...)` / `Haptics.notificationAsync(...)` directly and unconditionally. Examples found: `DiscoverScreen.tsx` lines 138, 150, 159, 186, 191, 219; the same pattern repeats in `ShortsFeed.tsx`, `HomeScreen.tsx`, and `WalletScreen.tsx`. There is no global flag to disable haptics (useful for low-end devices, A/B testing "do haptics improve retention", or accessibility needs), and no way to tune haptic intensity per event type from the admin panel.

### 1.5 UI Copy (Hardcoded in JSX Across Every Screen)

Every visible string — "Watch Shorts", "10🪙 each", tooltip text in `TabTooltip.tsx`, the "Preview mode" warning in `RewardsScreen.tsx`, the wallet's "Coming soon" message — is a literal string baked into JSX. None of it can be changed without a frontend deploy. The admin panel has zero content-editing capability today; `Config.tsx` only edits numeric/string `AppConfig` rows that map to business logic, not display copy.

### 1.6 Animation Toggles (None Exist)

There is no concept of an animation feature flag anywhere in the codebase. Card press animations, progress bar fills, coin counters — none of these exist yet (per the UI audit, this is also a missing-feature problem, not just a hardcoding problem), but when they are built per the companion UI transformation spec, they must be born admin-toggleable from day one rather than retrofitted later.

---

## 2. AdMob Policy Findings That Constrain This Design

Before building the remote ad-placement engine, these policy facts from Google's published AdMob/AdSense program policies and Help Center documentation must shape the defaults and the guardrails the admin panel enforces. This is not optional reading — violating these risks account suspension.

### 2.1 Rewarded ad reward rules

Google's policy for "ad units that offer rewards" states that publishers must not use any text or icon beyond what's needed to describe the reward, and must not phrase things in a way that pressures or misleads users into a particular choice (their example of a banned phrase is something like "watch this ad to support our business"). The reward must be delivered immediately on completion of the required action, and the publisher — not Google — is solely responsible for actually granting it. Google also requires that the action required and the reward offered be disclosed clearly before every single instance the rewarded ad is shown, with icons allowed only if their meaning is unambiguous.

**Design implication:** every ad placement card's copy (what the admin panel calls "ad card copy" in the CMS) must always state, in plain language, exactly what coin amount the user will receive and what action triggers it — *before* the ad plays, not after.

### 2.2 Direct monetary rewards are restricted

This is the single most important compliance fact for this product. Google's policy explicitly distinguishes "direct monetary items" (legal tender or anything directly usable to buy real-world goods/services — this would include UPI cash payouts) from "indirect or non-monetary items" (discounts, loyalty points, in-app currency, gift cards). The policy states that direct monetary items must never be offered as a reward for watching a rewarded ad under any circumstance. Indirect/non-monetary rewards are allowed, but only if they stay non-transferable and are redeemable within the publisher's own platform — a reward that can be converted into cash or transferred to someone else does not qualify as "non-monetary" in the way the policy intends.

**This directly affects ReelFlow's business model**, since the wallet redeems coins for UPI cash. The honest reading of the policy is that coins-for-UPI-cash sits in a gray zone that many "get-paid-to" apps operate in anyway, but it carries real risk of account suspension if AdMob's enforcement interprets the coin economy as a thin wrapper around "watch ad, get cash." The admin panel must give the business levers to reduce this risk rather than ignore it:
- Make non-monetary redemptions (gift cards, vouchers, merchandise) the default, most-promoted catalog items, with cash/UPI positioned as one option among several rather than the headline.
- Decouple the language: never say "watch this ad and get ₹X cash" anywhere in the ad card copy. Always say "earn coins," with the coins→cash conversion happening later, separately, in the wallet — not framed as part of the ad transaction itself.
- Keep a kill-switch in the admin panel (`cash_withdrawal_enabled` feature flag) to instantly disable cash/UPI payouts platform-wide if Google flags the account, while leaving gift-card/voucher redemption running.
- This is a business and legal decision, not just an engineering one — flag it to the product owner explicitly. This document gives the technical levers; it does not make the legal call.

### 2.3 Frequency capping is a first-class AdMob feature — use both layers

AdMob lets publishers set frequency caps directly in the AdMob dashboard at the app level or per ad unit, expressed as "N impressions per X minutes/hours/days," and confirms this applies across interstitial, rewarded, and app-open formats together. Google's own Firebase tutorial on ad-frequency optimization recommends testing higher and lower caps (their worked example starts around 4 impressions per 10 minutes for interstitials) via Remote Config/A-B testing rather than guessing a single number.

**Design implication:** the admin panel's ad-pacing settings are a *second, app-side* layer of frequency control that works alongside (not instead of) the caps configured natively in the AdMob dashboard. Document both layers clearly in the admin UI so the team doesn't assume the app-side cooldown alone is sufficient — the AdMob-side cap should always be configured too, as a hard backstop.

### 2.4 Clicking/incentivizing non-rewarded ad units is banned

Google's publisher policies are explicit that, outside of properly implemented rewarded inventory, publishers may never compensate users for viewing or clicking ads, and may never ask users to click ads to "support" the app. This means banner ads and native ads in ReelFlow must never have any coin value attached to them, ever — only the dedicated Rewarded and Rewarded Interstitial ad formats may pay out coins, and only through the official `EARNED_REWARD` SDK callback, never through a generic click handler.

### 2.5 Thin/low-value content risk ("Valuable Inventory" policy)

Separately, Google's "Valuable Inventory" enforcement (most commonly seen on framed or scraped content) flags apps that show ads next to content with little original value — relevant here because the Discover feed pulls RSS-aggregated news. The admin panel's content settings should let the team ensure aggregated articles always link out to the original source clearly (already done via `sourceUrl`/`sourceName` fields in the schema) and avoid stacking excessive ad density against thin article previews.

---

## 3. Architecture: The Remote Control Config System

### 3.1 New Prisma Models

Add these models to `prisma/schema.prisma`. They replace ad-hoc hardcoded values with structured, admin-editable, versioned configuration.

```prisma
// ─────────────────────────────────────────────────────────
// AD PLACEMENT ENGINE
// ─────────────────────────────────────────────────────────

// Defines WHERE and HOW OFTEN ad cards/triggers appear per screen
model AdPlacement {
  id              Int      @id @default(autoincrement())
  key             String   @unique  // e.g. "discover_feed_sponsored_card", "shorts_interstitial_trigger", "shorts_rewarded_card", "home_hero_cta"
  screen          String   // DISCOVER, SHORTS, HOME, WALLET, GAMES, ARTICLE_DETAIL
  adFormat        String   // REWARDED, REWARDED_INTERSTITIAL, BANNER, NATIVE, INTERSTITIAL
  enabled         Boolean  @default(true)

  // Placement pacing — app-side layer, works alongside AdMob's own dashboard frequency caps
  intervalMin     Int      @default(3)   // minimum items/scrolls/screens between appearances
  intervalMax     Int      @default(6)   // maximum items/scrolls/screens between appearances
  cooldownSeconds Int      @default(45)  // minimum seconds since this placement last fired for THIS user

  // Session pacing — prevents overwhelming users on navigation-triggered placements
  maxPerSession   Int      @default(8)   // hard cap per app session regardless of interval
  skipFirstNActions Int    @default(2)   // don't show this placement during the user's first N actions in a session (reduces "ad wall on open")

  // AdMob unit reference (resolved by platform at runtime via adUnits config)
  adUnitKey       String   // maps to AD_UNITS object key e.g. "REWARDED_DISCOVER"

  // Content (linked to ContentString CMS — see below)
  titleKey        String?  // e.g. "ad_card.discover.title"
  descriptionKey  String?
  ctaLabelKey     String?

  updatedAt       DateTime @updatedAt
  updatedBy       Int?     // adminId

  @@index([screen])
}

// Defines HOW MUCH each ad format/placement pays out, plus per-type daily caps
model AdRewardRule {
  id                Int      @id @default(autoincrement())
  adType            String   @unique // REWARDED, REWARDED_INTERSTITIAL, REWARDED_DISCOVER (matches claimAdReward adType param)
  coinsAwarded      Int      @default(50)
  dailyCapForType   Int      @default(10)   // max times THIS ad type can be rewarded per user per day
  cooldownSeconds   Int      @default(45)   // min seconds between rewards of THIS type for a user
  enabled           Boolean  @default(true)
  requiresFullWatch Boolean  @default(true) // must reach EARNED_REWARD callback, never partial
  updatedAt         DateTime @updatedAt
  updatedBy         Int?
}

// Global + tiered daily caps (independent of per-type caps — this is the overall ceiling)
model DailyCapPolicy {
  id              Int      @id @default(autoincrement())
  tier            String   @unique  // DEFAULT, NEW_USER (first 3 days), HIGH_TRUST (trustScore > 80), LOW_TRUST (riskScore > 50)
  maxAdsPerDay    Int      @default(20)
  maxCoinsPerDay  Int      @default(1000)
  minCooldownSeconds Int   @default(45)  // global min seconds between ANY two ad rewards, regardless of type
  updatedAt       DateTime @updatedAt
}

// ─────────────────────────────────────────────────────────
// CONTENT MANAGEMENT SYSTEM (every UI string, admin-editable)
// ─────────────────────────────────────────────────────────

model ContentString {
  id          Int      @id @default(autoincrement())
  key         String   @unique  // dot-namespaced e.g. "home.hero.title", "auth.tagline", "discover.tooltip.body"
  screen      String   // HOME, AUTH, SPLASH, DISCOVER, SHORTS, WALLET, EARN, GAMES, GLOBAL
  value       String   @db.Text
  description String?  // admin-facing note explaining where this string appears, shown in the CMS editor
  variant     String?  // for A/B testing copy — null = default, otherwise tied to an ABTest variant
  locale      String   @default("en")
  updatedAt   DateTime @updatedAt
  updatedBy   Int?

  @@unique([key, locale, variant])
  @@index([screen])
}

// ─────────────────────────────────────────────────────────
// FEATURE FLAGS (haptics, animations, experimental UI)
// ─────────────────────────────────────────────────────────

model FeatureFlag {
  id          Int      @id @default(autoincrement())
  key         String   @unique  // e.g. "haptics_enabled", "coin_rain_enabled", "card_press_animation_enabled", "splash_animation_enabled"
  category    String   // HAPTICS, ANIMATION, EXPERIMENTAL, KILL_SWITCH
  enabled     Boolean  @default(true)
  rolloutPercent Int   @default(100)  // gradual rollout: 0-100, deterministic by userId hash
  description String?
  updatedAt   DateTime @updatedAt
  updatedBy   Int?
}

// ─────────────────────────────────────────────────────────
// SCREEN LAYOUT / SECTION ORDERING (grids, banners, section visibility)
// ─────────────────────────────────────────────────────────

model ScreenSection {
  id          Int      @id @default(autoincrement())
  screen      String   // HOME, EARN, WALLET
  sectionKey  String   // "hero_card", "daily_bonus", "explore_grid", "missions", "games", "referral_banner", "streak_row"
  enabled     Boolean  @default(true)
  sortOrder   Int      @default(0)
  layoutVariant String @default("default") // for grid sections: "default" | "compact" | "large_first"
  updatedAt   DateTime @updatedAt

  @@unique([screen, sectionKey])
  @@index([screen])
}

// ─────────────────────────────────────────────────────────
// MONETIZATION ANALYTICS EVENTS (app reports these; admin dashboard reads them)
// ─────────────────────────────────────────────────────────

model AdEvent {
  id           Int      @id @default(autoincrement())
  userId       Int
  placementKey String   // matches AdPlacement.key
  adType       String   // REWARDED, REWARDED_INTERSTITIAL, REWARDED_DISCOVER, BANNER, NATIVE, INTERSTITIAL
  eventType    String   // REQUESTED, LOADED, FAILED_TO_LOAD, SHOWN, CLICKED, EARNED_REWARD, DISMISSED, ABANDONED
  screen       String
  sessionId    String
  errorCode    String?  // populated on FAILED_TO_LOAD
  latencyMs    Int?     // load time, for fill-rate/latency monitoring
  timestamp    DateTime @default(now())

  @@index([userId, timestamp])
  @@index([placementKey, eventType, timestamp])
  @@index([adType, eventType])
}
```

### 3.2 Config Versioning & Caching Strategy

The app must never make a blocking network call before it can render. The config system needs three layers:

1. **Bundled defaults** — a `defaultConfig.ts` file shipped inside the app binary itself, containing safe fallback values for every `AdPlacement`, `AdRewardRule`, `ContentString`, and `FeatureFlag`. This is what renders if the network is unavailable on first launch. These bundled defaults double as the "what happens during a backend outage" safety net (see Section 8.2).

2. **Fetched remote config** — on app launch (and silently refreshed every 15 minutes while the app is foregrounded, plus on app-foreground-from-background events), the app calls `GET /api/config/remote` which returns one consolidated JSON payload combining ad placements, reward rules, content strings, feature flags, and screen sections, each tagged with a `configVersion` (an incrementing integer or hash bumped on every admin save). Store this in AsyncStorage so a cold start after the first successful fetch always has real config, not just bundled defaults.

3. **Diffing for efficiency** — the app sends its currently cached `configVersion` as a query param; if unchanged, the backend returns `304`-style `{ unchanged: true }` to save bandwidth. On any admin save anywhere in this system, bump the global version counter.

```typescript
// GET /api/config/remote?version=42
// Response when changed:
{
  "version": 43,
  "adPlacements": [ /* AdPlacement[] */ ],
  "adRewardRules": [ /* AdRewardRule[] */ ],
  "dailyCapPolicies": [ /* DailyCapPolicy[] */ ],
  "contentStrings": { "home.hero.title": "Today's Opportunity", ... }, // flattened key→value map for fast lookup
  "featureFlags": { "haptics_enabled": true, "coin_rain_enabled": true, ... },
  "screenSections": { "HOME": [ {sectionKey, enabled, sortOrder, layoutVariant}, ... ] }
}
// Response when unchanged:
{ "unchanged": true, "version": 42 }
```

### 3.3 Why Reward Rules Stay Server-Authoritative

The `AdRewardRule.coinsAwarded` value is fetched by the client for **display purposes only** (so the ad card can say "Earn 50 coins" before the ad plays, satisfying the AdMob disclosure requirement from Section 2.1). The actual coin grant in `claimAdReward` must **re-read `AdRewardRule` from the database server-side** at claim time, never trust a client-supplied amount. This prevents a tampered client from claiming an inflated reward.

---

## 4. Ad Placement Engine — Exact Interaction Model

### 4.1 Discover Feed (News Cards)

Replace the hardcoded `Math.random() * (6-3+1) + 3` in `DiscoverScreen.tsx` with config-driven logic:

```typescript
// New hook: src/hooks/useAdPlacement.ts
const { intervalMin, intervalMax, cooldownSeconds, maxPerSession } = useAdPlacementConfig('discover_feed_sponsored_card');

// Roll a fresh random interval within the admin-configured range each time a card is placed
const rollNextInterval = () => Math.floor(Math.random() * (intervalMax - intervalMin + 1)) + intervalMin;

// Track: cardsSinceLastAd, sessionAdCount, lastAdTimestamp
// Insert ad card only if ALL of:
//   1. cardsSinceLastAd >= rolled interval
//   2. (now - lastAdTimestamp) >= cooldownSeconds * 1000
//   3. sessionAdCount < maxPerSession
//   4. AdPlacement.enabled === true (admin kill-switch)
```

**Visual interaction (matches the existing "Watch Video, Earn 50🪙" card style, now config-driven):**
1. Card appears inline in the news feed scroll, styled per the companion UI spec (gold border glow, clear "Sponsored" label, coin amount pulled from `AdRewardRule`).
2. User taps "Watch Video →". The rewarded ad SDK loads and shows.
3. On `EARNED_REWARD`, the backend grants coins (re-validated server-side per 3.3), the app fires a coin-rain celebration, and the card animates out: scale down to 0 + fade + slight upward translate over 300ms ("breaks and vanishes" per the product description), removing it from the feed array.
4. The interval counter resets and a new random interval is rolled for the next ad card.
5. If the user dismisses without watching, the card simply scrolls past normally and remains until off-screen; it does not artificially block scrolling.

### 4.2 Shorts Feed

Replace the hardcoded `% 6` and `% 11` modulo checks with the same `useAdPlacement` hook, parameterized per placement key (`shorts_interstitial_trigger` and `shorts_rewarded_card` are two separate `AdPlacement` rows, each with their own admin-configured interval range, since one is a forced interstitial and the other is opt-in).

**Interstitial trigger** (`REWARDED_INTERSTITIAL_TRIGGER` item type): when the user scrolls to this position in the feed, the interstitial ad auto-loads and shows (current behavior in `handleInterstitialTrigger` is correct logic — just gate the trigger frequency by config instead of `% 6`).

**Opt-in rewarded card** (`REWARDED_VIDEO_CARD` item type): rendered inline in the vertical feed like a regular short, with its own CTA UI. The frequency this card is inserted at comes from its own `AdPlacement.intervalMin/Max`, independent of the interstitial's interval — admins can tune the two ad formats completely separately (e.g., interstitial every 8-12 shorts, opt-in card every 5-8 shorts).

### 4.3 Navigation-Triggered Ads (Tab Changes / Screen Transitions)

This is new behavior the product description asks for ("while navigating these types of ads also come") but it must be the most conservative placement to avoid the exact "overwhelmed by ads" outcome the user explicitly wants to avoid.

```typescript
// New AdPlacement row: "nav_transition_interstitial"
// Defaults (bundled fallback, admin-overridable):
intervalMin: 4          // at least 4 tab switches between interstitials
intervalMax: 8
cooldownSeconds: 120     // at least 2 minutes since ANY ad (cross-placement cooldown — see 4.4)
maxPerSession: 3         // hard ceiling — never more than 3 nav-triggered ads per session
skipFirstNActions: 3     // never show on the first 3 tab switches of a session
```

Trigger logic lives in `App.tsx`'s `setActiveTab` handler (or a wrapping `useNavigationAdGate` hook):
```typescript
const onTabChange = (tab: TabId) => {
  setActiveTab(tab);
  navAdGate.recordNavigation();
  if (navAdGate.shouldShowAd()) {
    showInterstitial('nav_transition_interstitial');
  }
};
```

### 4.4 Cross-Placement Global Cooldown (Prevents Ad Stacking)

A single global cooldown timer must be shared across ALL ad placements, not just per-placement cooldowns. This is what actually prevents "user finishes a Discover ad, immediately swipes to Shorts, gets hit with another ad 3 seconds later." Implement as a single Zustand value:

```typescript
// In useAppStore.ts:
lastAnyAdTimestamp: number;
canShowAnyAd: () => {
  const globalCooldown = configStore.getDailyCapPolicy('DEFAULT').minCooldownSeconds; // e.g. 45s, admin-controlled
  return (Date.now() - get().lastAnyAdTimestamp) >= globalCooldown * 1000;
};
```

Every ad placement — Discover card, Shorts interstitial, Shorts opt-in card, nav-triggered interstitial — must check `canShowAnyAd()` in addition to its own placement-specific interval/cooldown before firing. This single global gate is the primary defense against the "ad wall" experience.

### 4.5 Session-Start Grace Period

`skipFirstNActions` (per placement) combined with a session-wide grace period (e.g., no ads at all in the first 30 seconds after app open, admin-configurable as `session_grace_period_seconds` in `DailyCapPolicy` or a dedicated flag) ensures users always get a clean, ad-free first impression of whatever screen they land on, every time they open the app.

---

## 5. Backend Code Changes

### 5.1 New Routes

```typescript
// src/routes/config.ts — PUBLIC, authenticated, app-facing
router.get('/remote', authenticate, getRemoteConfig);

// src/routes/admin.ts — ADD these admin-only routes:
router.get('/ad-placements', getAdPlacements);
router.post('/ad-placements', createAdPlacement);
router.put('/ad-placements/:id', updateAdPlacement);
router.delete('/ad-placements/:id', deleteAdPlacement);

router.get('/ad-reward-rules', getAdRewardRules);
router.put('/ad-reward-rules/:adType', updateAdRewardRule);

router.get('/daily-cap-policies', getDailyCapPolicies);
router.put('/daily-cap-policies/:tier', updateDailyCapPolicy);

router.get('/content-strings', getContentStrings);
router.put('/content-strings/:key', updateContentString);
router.post('/content-strings/bulk', bulkUpdateContentStrings); // for CSV/JSON import

router.get('/feature-flags', getFeatureFlags);
router.put('/feature-flags/:key', updateFeatureFlag);

router.get('/screen-sections/:screen', getScreenSections);
router.put('/screen-sections/:screen', updateScreenSections); // accepts reordered array

router.get('/ad-analytics/funnel', getAdFunnelAnalytics);   // REQUESTED → LOADED → SHOWN → EARNED_REWARD drop-off
router.get('/ad-analytics/fill-rate', getFillRateAnalytics);
router.get('/ad-analytics/revenue-estimate', getRevenueEstimate);

// Every PUT/POST above must call logAdminAction() (existing helper) for audit trail
// Every PUT/POST above must increment a global configVersion counter in AppConfig
```

### 5.2 Rewrite `claimAdReward` to Be Fully Config-Driven

```typescript
export const claimAdReward = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { adType, adSessionId, placementKey, deviceId } = req.body;

    if (!adType || !adSessionId) {
      res.status(400).json({ error: 'adType and adSessionId are required' });
      return;
    }

    // 1. Load the reward rule from DB — server is the source of truth, never trust client amount
    const rewardRule = await prisma.adRewardRule.findUnique({ where: { adType } });
    if (!rewardRule || !rewardRule.enabled) {
      res.status(400).json({ error: 'This ad type is not currently eligible for rewards' });
      return;
    }

    // 2. Resolve the user's tier for cap policy (NEW_USER / HIGH_TRUST / LOW_TRUST / DEFAULT)
    const tier = await resolveUserTier(req.user); // checks trustScore, riskScore, createdAt age
    const capPolicy = await prisma.dailyCapPolicy.findUnique({ where: { tier } })
      ?? await prisma.dailyCapPolicy.findUnique({ where: { tier: 'DEFAULT' } });

    // 3. Global daily cap (all ad types combined)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayTotalAds = await prisma.coinLedger.count({
      where: { userId, source: { startsWith: 'AD_' }, timestamp: { gte: todayStart } },
    });
    if (todayTotalAds >= capPolicy!.maxAdsPerDay) {
      res.status(429).json({ error: 'Daily ad reward limit reached', resetAt: nextMidnightISO() });
      return;
    }

    // 4. Per-type daily cap
    const todayThisType = await prisma.coinLedger.count({
      where: { userId, source: rewardRule.adType === 'REWARDED_DISCOVER' ? 'AD_REWARDED_DISCOVER'
               : rewardRule.adType === 'REWARDED_INTERSTITIAL' ? 'AD_REWARDED_INTERSTITIAL' : 'AD_REWARDED',
               timestamp: { gte: todayStart } },
    });
    if (todayThisType >= rewardRule.dailyCapForType) {
      res.status(429).json({ error: `Daily limit reached for this ad type` });
      return;
    }

    // 5. Cooldown — both per-type AND global minimum (whichever is stricter)
    const lastAnyAd = await prisma.coinLedger.findFirst({
      where: { userId, source: { startsWith: 'AD_' } }, orderBy: { timestamp: 'desc' },
    });
    const minCooldown = Math.max(rewardRule.cooldownSeconds, capPolicy!.minCooldownSeconds);
    if (lastAnyAd && (Date.now() - lastAnyAd.timestamp.getTime()) / 1000 < minCooldown) {
      await logFraud(userId, 'AD_COOLDOWN_VIOLATION', 'MEDIUM', { adType, secondsSinceLast: (Date.now() - lastAnyAd.timestamp.getTime()) / 1000 });
      res.status(429).json({ error: 'Please wait before claiming another reward' });
      return;
    }

    // 6. Device fingerprint check (rooted/emulator block — see companion spec)
    // ... existing fingerprint logic ...

    // 7. Grant reward using the DB-sourced coin amount, never a client-supplied one
    const clientIp = requestIp.getClientIp(req) || 'unknown';
    const source = `AD_${rewardRule.adType}`;
    try {
      await addLedgerEntry(userId, rewardRule.coinsAwarded, source, clientIp, adSessionId, deviceId);
    } catch (e: any) {
      if (e.code === 'P2002') { res.json({ message: 'Already claimed', coinsEarned: 0 }); return; }
      throw e;
    }

    // 8. Log the analytics event
    await prisma.adEvent.create({
      data: { userId, placementKey: placementKey || 'unknown', adType: rewardRule.adType,
              eventType: 'EARNED_REWARD', screen: req.body.screen || 'unknown', sessionId: adSessionId },
    });

    res.json({ message: 'Ad reward claimed', coinsEarned: rewardRule.coinsAwarded });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
```

### 5.3 Ad Funnel Event Ingestion Endpoint

The client must report every stage of the ad lifecycle, not just successful rewards, so the admin dashboard can show fill rate and drop-off:

```typescript
// POST /api/ads/event — lightweight, fire-and-forget from client
router.post('/event', authenticate, async (req, res) => {
  const { placementKey, adType, eventType, screen, sessionId, errorCode, latencyMs } = req.body;
  // Validate eventType against enum: REQUESTED, LOADED, FAILED_TO_LOAD, SHOWN, CLICKED, EARNED_REWARD, DISMISSED, ABANDONED
  await prisma.adEvent.create({ data: { userId: req.user.id, placementKey, adType, eventType, screen, sessionId, errorCode, latencyMs } });
  res.status(204).end();
});
```

### 5.4 Seed Migration for Initial Config Rows

```typescript
// prisma/seed.ts additions
await prisma.adRewardRule.createMany({ data: [
  { adType: 'REWARDED', coinsAwarded: 100, dailyCapForType: 8, cooldownSeconds: 60 },
  { adType: 'REWARDED_INTERSTITIAL', coinsAwarded: 50, dailyCapForType: 8, cooldownSeconds: 45 },
  { adType: 'REWARDED_DISCOVER', coinsAwarded: 50, dailyCapForType: 8, cooldownSeconds: 45 },
], skipDuplicates: true });

await prisma.dailyCapPolicy.createMany({ data: [
  { tier: 'DEFAULT', maxAdsPerDay: 20, maxCoinsPerDay: 1200, minCooldownSeconds: 45 },
  { tier: 'NEW_USER', maxAdsPerDay: 10, maxCoinsPerDay: 600, minCooldownSeconds: 60 },     // more conservative for first 3 days, reduces fresh-account farming
  { tier: 'HIGH_TRUST', maxAdsPerDay: 25, maxCoinsPerDay: 1500, minCooldownSeconds: 40 },
  { tier: 'LOW_TRUST', maxAdsPerDay: 5, maxCoinsPerDay: 250, minCooldownSeconds: 120 },
], skipDuplicates: true });

await prisma.adPlacement.createMany({ data: [
  { key: 'discover_feed_sponsored_card', screen: 'DISCOVER', adFormat: 'REWARDED', intervalMin: 3, intervalMax: 6, cooldownSeconds: 45, maxPerSession: 8, skipFirstNActions: 2, adUnitKey: 'REWARDED_DISCOVER', titleKey: 'ad_card.discover.title', descriptionKey: 'ad_card.discover.description', ctaLabelKey: 'ad_card.discover.cta' },
  { key: 'shorts_interstitial_trigger', screen: 'SHORTS', adFormat: 'REWARDED_INTERSTITIAL', intervalMin: 6, intervalMax: 9, cooldownSeconds: 60, maxPerSession: 6, skipFirstNActions: 3, adUnitKey: 'REWARDED_INTERSTITIAL' },
  { key: 'shorts_rewarded_card', screen: 'SHORTS', adFormat: 'REWARDED', intervalMin: 5, intervalMax: 8, cooldownSeconds: 45, maxPerSession: 6, skipFirstNActions: 2, adUnitKey: 'REWARDED', titleKey: 'ad_card.shorts.title', descriptionKey: 'ad_card.shorts.description', ctaLabelKey: 'ad_card.shorts.cta' },
  { key: 'nav_transition_interstitial', screen: 'GLOBAL', adFormat: 'REWARDED_INTERSTITIAL', intervalMin: 4, intervalMax: 8, cooldownSeconds: 120, maxPerSession: 3, skipFirstNActions: 3, adUnitKey: 'REWARDED_INTERSTITIAL' },
], skipDuplicates: true });

await prisma.featureFlag.createMany({ data: [
  { key: 'haptics_enabled', category: 'HAPTICS', enabled: true, description: 'Master switch for all haptic feedback app-wide' },
  { key: 'haptics_ad_reward', category: 'HAPTICS', enabled: true, description: 'Haptic on successful ad reward' },
  { key: 'haptics_navigation', category: 'HAPTICS', enabled: true, description: 'Haptic on tab switches' },
  { key: 'coin_rain_enabled', category: 'ANIMATION', enabled: true, description: 'Particle celebration on coin reward' },
  { key: 'coin_counter_animation_enabled', category: 'ANIMATION', enabled: true },
  { key: 'card_press_animation_enabled', category: 'ANIMATION', enabled: true },
  { key: 'splash_animation_enabled', category: 'ANIMATION', enabled: true },
  { key: 'cash_withdrawal_enabled', category: 'KILL_SWITCH', enabled: true, description: 'Emergency disable for UPI/cash redemption — keep gift cards running' },
], skipDuplicates: true });
```

---

## 6. Frontend Code Changes

### 6.1 Remote Config Provider

```typescript
// src/providers/RemoteConfigProvider.tsx
// On mount: load cached config from AsyncStorage immediately (no loading flash)
// Then fetch GET /api/config/remote?version={cachedVersion} in background
// On response: if changed, merge into Zustand configStore and persist to AsyncStorage
// Refresh on: app foreground event, every 15 min while foregrounded
// Wraps the whole app in App.tsx, above MainApp
```

```typescript
// src/store/useConfigStore.ts — new Zustand store, separate from useAppStore
interface ConfigState {
  version: number;
  adPlacements: Record<string, AdPlacementConfig>;
  adRewardRules: Record<string, AdRewardRuleConfig>;
  dailyCapPolicies: Record<string, DailyCapPolicyConfig>;
  contentStrings: Record<string, string>;
  featureFlags: Record<string, boolean>;
  screenSections: Record<string, ScreenSectionConfig[]>;
  hydrated: boolean;
  setConfig: (config: RemoteConfigPayload) => void;
}
```

### 6.2 Content String Hook (Replaces Hardcoded JSX Text)

```typescript
// src/hooks/useContent.ts
export const useContent = (key: string, fallback: string): string => {
  const value = useConfigStore(state => state.contentStrings[key]);
  return value ?? fallback; // fallback = the bundled default, ensures app never shows a blank/missing string
};

// Usage in HomeScreen.tsx (example transformation):
// BEFORE: <Text style={styles.shortcutTitle}>Watch Shorts</Text>
// AFTER:
const watchShortsTitle = useContent('home.explore.shorts.title', 'Watch Shorts');
const watchShortsSubtitle = useContent('home.explore.shorts.subtitle', 'Reward opportunities available');
<Text style={styles.shortcutTitle}>{watchShortsTitle}</Text>
<Text style={styles.shortcutReward}>{watchShortsSubtitle}</Text>
```

This pattern must be applied to **every** user-visible string across every screen — splash tagline, auth screen copy, all section titles, all empty states, all tooltips, all button labels, all modal text, all alert messages where feasible (native `Alert.alert` titles/bodies should also pull from `useContent` where they're not purely dynamic error messages from the server).

### 6.3 Feature Flag Hook (Gates Haptics & Animation)

```typescript
// src/hooks/useFeatureFlag.ts
export const useFeatureFlag = (key: string, fallback = true): boolean => {
  return useConfigStore(state => state.featureFlags[key] ?? fallback);
};

// src/utils/haptics.ts — wraps expo-haptics, replaces all direct Haptics.* calls
import * as Haptics from 'expo-haptics';
import { useConfigStore } from '../store/useConfigStore';

export const triggerHaptic = (type: 'impact-light' | 'impact-medium' | 'success' | 'warning' | 'error', subFlag?: string) => {
  const flags = useConfigStore.getState().featureFlags;
  if (!flags['haptics_enabled']) return;
  if (subFlag && flags[subFlag] === false) return;
  switch (type) {
    case 'impact-light': return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'impact-medium': return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case 'success': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'warning': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'error': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};
```

Replace every direct `Haptics.impactAsync(...)` / `Haptics.notificationAsync(...)` call across the codebase (`DiscoverScreen.tsx`, `ShortsFeed.tsx`, `HomeScreen.tsx`, `WalletScreen.tsx`, and any new components from the companion UI spec) with `triggerHaptic(...)`.

Apply the same pattern to animation components: a `CoinRain` component checks `useFeatureFlag('coin_rain_enabled')` and renders nothing (just grants the coins silently) if disabled; a `CoinCounter` checks `coin_counter_animation_enabled` and snaps directly to the new value instead of animating if disabled; card press scale effects check `card_press_animation_enabled`.

### 6.4 Ad Placement Hook

```typescript
// src/hooks/useAdPlacement.ts
export const useAdPlacement = (placementKey: string) => {
  const config = useConfigStore(state => state.adPlacements[placementKey]);
  const { lastAnyAdTimestamp, sessionAdCounts } = useAppStore();
  
  const rollInterval = () => {
    if (!config) return 5; // bundled fallback
    return Math.floor(Math.random() * (config.intervalMax - config.intervalMin + 1)) + config.intervalMin;
  };

  const canShow = (itemsSincePlacement: number, sessionActionCount: number) => {
    if (!config?.enabled) return false;
    if (sessionActionCount < config.skipFirstNActions) return false;
    if ((sessionAdCounts[placementKey] || 0) >= config.maxPerSession) return false;
    if ((Date.now() - lastAnyAdTimestamp) / 1000 < config.cooldownSeconds) return false;
    if (itemsSincePlacement < rollInterval()) return false;
    return true;
  };

  return { config, rollInterval, canShow };
};
```

Wire this into `DiscoverScreen.tsx` (replacing the hardcoded `adInterval` math) and `ShortsFeed.tsx` (replacing the `% 6` / `% 11` checks), and into the new nav-transition gate in `App.tsx`.

### 6.5 Reporting Ad Funnel Events

Wrap every AdMob SDK event listener to also fire the analytics endpoint:
```typescript
// On every ad lifecycle event (LOADED, FAILED_TO_LOAD, SHOWN, EARNED_REWARD, DISMISSED):
reportAdEvent({ placementKey, adType, eventType, screen, sessionId, errorCode, latencyMs }).catch(() => {});
// Fire-and-forget — never block the ad UX waiting on this call
```

---

## 7. Admin Panel — New Pages

Add these pages to the admin panel, following the existing sidebar pattern in `App.tsx` (grouped under a new "Monetization Control" and "Content & Behavior" sidebar sections).

### 7.1 Ad Placement Manager (`/ad-placements`)

Table view of every `AdPlacement` row: screen, ad format, interval range (editable min/max sliders or number inputs), cooldown, max per session, skip-first-N, enabled toggle. Each row has an inline "Preview" button that shows the linked content strings (title/description/CTA) so an admin can see exactly what the user sees before saving. Bulk-disable button for emergency "turn off all ads on screen X" scenarios.

### 7.2 Reward Rules Editor (`/reward-rules`)

One row per ad type (`REWARDED`, `REWARDED_INTERSTITIAL`, `REWARDED_DISCOVER`, future offerwall types). Editable: coins awarded, daily cap for type, cooldown seconds, enabled toggle. Show a live calculation: "At current settings, the most a single user can earn from this ad type per day is X coins" — this surfaces the economic ceiling to the team so changes are made with awareness of payout cost.

### 7.3 Daily Cap & Tier Policy (`/cap-policies`)

Table of the four tiers (DEFAULT, NEW_USER, HIGH_TRUST, LOW_TRUST) with editable max ads/day, max coins/day, min global cooldown. Include a read-only explainer panel describing how `resolveUserTier()` assigns users to tiers (trust score thresholds, account age) so admins understand the levers without needing to read backend code.

### 7.4 Content CMS Editor (`/content`)

This is the biggest new page. Organized as a left-side tree (by screen: Splash, Auth, Home, Discover, Shorts, Wallet, Earn, Games, Global) and a right-side editable list of every `ContentString` under the selected screen, showing: key, current value (textarea), description (what it's for), and a "Preview on device mockup" toggle that renders the string inside a simplified mock of the actual screen layout so non-technical admins can see context. Support search-by-key and search-by-value across all strings. Add a "Revert to default" button per string that restores the bundled fallback value. Add bulk export/import as JSON for translation workflows.

### 7.5 Feature Flags (`/feature-flags`)

Simple toggle list grouped by category (Haptics, Animation, Experimental, Kill Switch). Each flag shows its current enabled state, rollout percentage slider (for gradual rollout), and description. The `cash_withdrawal_enabled` kill switch should be visually distinct (red border, confirmation dialog on toggle) given its compliance importance per Section 2.2.

### 7.6 Screen Layout Manager (`/screen-layout`)

For each screen (Home, Earn, Wallet), a drag-and-drop reorderable list of `ScreenSection` rows, each with an enabled toggle and a layout variant dropdown. This lets admins reorder Home screen sections (e.g., move "Daily Bonus" above "Hero Card" for a campaign) without a code deploy.

### 7.7 Monetization Analytics Dashboard (`/ad-analytics`) — Google-Grade

This extends the existing `Analytics.tsx` page with ad-specific funnel and revenue tracking:

- **Funnel chart per placement:** REQUESTED → LOADED → SHOWN → EARNED_REWARD, with drop-off percentage at each stage, filterable by placement key and date range. Built from `AdEvent` rows.
- **Fill rate:** `LOADED / REQUESTED` ratio per ad format per day, to catch AdMob inventory issues early.
- **Average load latency:** from `AdEvent.latencyMs`, flags slow-loading placements that hurt UX.
- **ARPDAU (Average Revenue Per Daily Active User):** requires connecting estimated eCPM (manually entered by finance admin per ad format, since AdMob's real eCPM isn't available via a simple API call without the AdMob Reporting API + OAuth setup) multiplied by daily `EARNED_REWARD` counts, divided by DAU. Surface this as an estimate with a clear "estimated, not actual AdMob revenue" label.
- **Coin payout cost vs. estimated ad revenue:** a side-by-side chart showing total coins paid out (converted to INR via `coin_to_inr_rate`) against estimated ad revenue, so the team can see margin health per day/week.
- **Cohort retention by ad exposure:** D1/D7/D30 retention segmented by how many ads a user watched in their first session — helps validate whether ad pacing is too aggressive (hurting retention) or too conservative (leaving revenue on the table).
- **Per-placement abandonment rate:** `DISMISSED` and `ABANDONED` event counts per placement, flags placements that annoy users even if they don't directly hurt fill rate.

For a deeper, real eCPM/revenue integration in a later phase, note in the admin panel UI that connecting the actual AdMob Reporting API (Google Ads API / AdMob API v1, OAuth2 service account) is a separate, optional integration — link a "Coming soon: Live AdMob Revenue Sync" placeholder card so the team knows the roadmap without conflating it with what's built now.

---

## 8. Google-Grade Monitoring, Security, Error Handling, Code Quality

### 8.1 Security (RBAC Already Exists — Harden It)

The existing `authorizeAdmin` / `authorizeSuperAdmin` middleware and three-tier role system (`SUPER_ADMIN`, `FINANCE_ADMIN`, `FRAUD_ANALYST`) is a good foundation. Extend it:
- Restrict `feature-flags` and `ad-reward-rules` writes to `SUPER_ADMIN` and `FINANCE_ADMIN` only (not `FRAUD_ANALYST`), since these directly control payout economics.
- Restrict `content-strings` writes to all admin roles (lower risk, copy changes aren't financially dangerous) but still log every change.
- Every write to any of the new models must call `logAdminAction()` (already exists in `adminController.ts`) — this is non-negotiable for audit trail completeness across a "remote control everything" system, since a single bad config push can affect every user simultaneously.
- Add a config rollback feature: store the previous value alongside the new one in `AuditLog.details` (already a string field, store as JSON `{ before, after }`) so a `POST /api/admin/rollback/:auditLogId` endpoint can restore a prior value in one click.
- Recommend (flag to the team, not a code requirement) enabling 2FA on admin accounts given the blast radius of this system; the current `AdminLogin.tsx` uses Google OAuth which can have 2FA enforced at the Google Workspace level.

### 8.2 Error Handling — What Happens When Config Fails

- If `GET /api/config/remote` fails (network error, 500, timeout), the app silently falls back to the last successfully cached config in AsyncStorage, and if that's also unavailable (true first-run with no network), falls back to the bundled `defaultConfig.ts` shipped in the app binary. The app must never show a blank screen or crash due to config unavailability.
- If a specific `ContentString` key is missing from the fetched config (e.g., admin hasn't set it yet), `useContent()` always falls back to the hardcoded default passed as its second argument — meaning every single `useContent()` call site must always carry a sensible fallback string, never an empty string.
- If `AdPlacement` config is missing or malformed, default to the conservative bundled values (Section 5.4 seed values) rather than disabling ads entirely or defaulting to an aggressive interval.
- If `claimAdReward` cannot resolve a `DailyCapPolicy` for the user's tier, fall back to the `DEFAULT` tier policy, never to "no cap" (fail closed, not open, on anything fraud/economics-related).
- All new backend endpoints follow the existing pattern of wrapping logic in try/catch and returning `{ error: message }` with appropriate status codes, consistent with the rest of the codebase.

### 8.3 Code Quality

- All new Prisma models require a migration (`npx prisma migrate dev --name add_remote_config_system`) — never hand-edit the database.
- New Zustand stores (`useConfigStore`) stay separate from `useAppStore` to keep concerns isolated (config vs. user/session state) and to avoid one store becoming an unmaintainable god-object.
- All new hooks (`useContent`, `useFeatureFlag`, `useAdPlacement`) get colocated unit tests verifying fallback behavior when config is absent — this is the most safety-critical path in the whole system since it's what prevents a broken config push from crashing the app for every user.
- TypeScript types for the remote config payload (`RemoteConfigPayload`, `AdPlacementConfig`, etc.) should be defined once in a shared types file and imported by both the admin panel's API layer and the mobile app's config store, even though they're separate codebases/repos — keep them manually in sync via a comment pointing to the canonical Prisma schema as source of truth, since there's no shared package between the three repos currently.
- Every new admin panel page follows the existing pattern in `services/api.ts` (typed axios functions) rather than inline fetch calls scattered through page components.

---

## 9. Implementation Priority Order

### Phase 1 — Backend Foundation
1. Add new Prisma models (Section 3.1), run migration, run seed (Section 5.4).
2. Build `GET /api/config/remote` endpoint with versioning (Section 3.2).
3. Rewrite `claimAdReward` to be fully config-driven (Section 5.2) — this replaces the hardcoded `adRewardMap`.
4. Build `POST /api/ads/event` funnel ingestion endpoint (Section 5.3).

### Phase 2 — Frontend Config Plumbing
5. Build `RemoteConfigProvider`, `useConfigStore`, bundled `defaultConfig.ts` fallback (Section 6.1).
6. Build `useContent`, `useFeatureFlag`, `useAdPlacement` hooks (Sections 6.2-6.4).
7. Build `triggerHaptic()` wrapper and replace every direct `Haptics.*` call across the codebase (Section 6.3).

### Phase 3 — Replace Hardcoded Ad Logic
8. Replace `DiscoverScreen.tsx`'s hardcoded `adInterval` math with `useAdPlacement` (Section 4.1).
9. Replace `ShortsFeed.tsx`'s hardcoded `% 6` / `% 11` checks with `useAdPlacement` (Section 4.2).
10. Build the new nav-transition ad gate in `App.tsx` with global cross-placement cooldown (Sections 4.3-4.4).

### Phase 4 — Replace Hardcoded Copy
11. Catalog every hardcoded string across every screen into `ContentString` seed rows.
12. Replace every JSX literal string with `useContent()` calls, screen by screen.

### Phase 5 — Admin Panel UI
13. Build Ad Placement Manager, Reward Rules Editor, Daily Cap Policy pages (Sections 7.1-7.3).
14. Build Content CMS Editor (Section 7.4) — biggest single page, build last among the editors since it depends on Phase 4's cataloging being complete.
15. Build Feature Flags page and Screen Layout Manager (Sections 7.5-7.6).

### Phase 6 — Analytics & Hardening
16. Build Monetization Analytics Dashboard (Section 7.7).
17. Add audit log rollback capability (Section 8.1).
18. Add unit tests for fallback behavior across all new hooks (Section 8.3).

---

*This document assumes the companion UI/UX transformation spec (covering screen redesigns, motion system, and copy rewrites) is implemented in parallel — the `ContentString` keys and `FeatureFlag` toggles defined here are the delivery mechanism for that spec's visual and copy changes, not a replacement for it. Build both together: the UI spec defines what good looks like; this spec defines how the admin panel controls it without another deploy.*
