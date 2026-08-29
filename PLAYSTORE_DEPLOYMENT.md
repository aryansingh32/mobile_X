# Play Store Deployment Guide

Status as of this pass: the app-side blockers I can fix from code are done. What's left needs your Google Play Console account, your signing/AdMob credentials, and store-listing art — those are called out explicitly below.

## 1. Compliance status (audited against `playstore_tos_audit_report.md`)

That report flagged this app as **NOT READY** with three critical violations. Re-checking the current code, all three are already resolved:

| Violation (original audit) | Current state |
|---|---|
| Coins paid for watching YouTube videos (`SHORT_WATCH`) | Gated behind a `short_watch_reward_coins_legal_review_approved` admin flag — forced to 0 unless explicitly turned on (`rewardsController.ts`). Ships **off** by default. |
| YouTube player controls hidden (`controls: 0`) + gesture-zone overlay blocking the logo/controls | `ShortItem.tsx` now sets `controls: 1` (native controls visible), with a comment marking it TOS-required. |
| Roulette wheel pays real, cashable coins (unlicensed gambling) | Roulette is XP-only — it can never credit coins directly (enforced server-side, covered by an E2E test: "roulette NEVER credits coins directly"). |
| Fraud middleware runs before auth, so `req.user` is always undefined | `fraudMiddleware.ts` independently decodes the JWT itself when `req.user` isn't set yet — multi-account/rate limiting works per-user, not just per-IP. |

**This pass additionally fixed** two pieces of default copy that read as real-money/gambling framing to a reviewer, per that same report's own guidance ("label rewards as gift vouchers/loyalty rewards, not cash or money"):
- `defaultConfig.ts`: `"Cash out real money."` → `"Redeem real rewards."`
- `AutoMarquee.tsx`: `"won a jackpot"` → `"won a bonus reward"`

These were both **client-bundled default strings** — even though the live text is admin-editable via the Content Strings CMS, whatever ships in the binary is what a reviewer sees on a fresh install before any admin edits anything, so it had to be safe out of the box.

**Not fixed, and worth your own read:** this is fundamentally a watch-ads/complete-tasks → virtual coins → real payout (UPI/vouchers) app. That model is legal and Play-approved (Swagbucks, Mistplay, etc. run it), but it sits close enough to regulated territory (gambling, money transmission) that I'd get an actual lawyer's sign-off before your first real-money payout goes out, not just a code audit. The `short_watch_reward_coins_legal_review_approved` flag exists specifically so that decision is made deliberately, not by leaving a default on.

## 2. Legal pages (new)

Play Console **requires** a live, publicly reachable Privacy Policy URL, and a Terms link inside the app is expected for anything handling accounts/payments. Neither existed before this pass — `EXPO_PUBLIC_PRIVACY_URL`/`EXPO_PUBLIC_TERMS_URL` were referenced in `SettingsScreen.tsx` but never set, so tapping those rows just showed "not configured yet."

Fixed by adding two public, unauthenticated backend routes (bypass HMAC signing like the health check — a browser can't sign requests):
- `GET /legal/privacy-policy`
- `GET /legal/terms`

Content lives in `backend/src/content/legalContent.ts`, built from what the schema actually collects (account info via Google Sign-In, device fingerprint/IP for fraud detection, GAID for AdMob, payout details on redemption, FCM token). Override the boilerplate identity via env vars before you deploy:
```
LEGAL_APP_NAME=ReelFlow
LEGAL_ENTITY_NAME=Your Legal Entity Name
LEGAL_SUPPORT_EMAIL=support@yourdomain.com
```
**This is a compliance-oriented draft, not a substitute for a lawyer** — get real counsel to review it before launch, especially the payout/virtual-currency section, given real money changes hands.

Once the backend is deployed, set in `modified2/reel-flow/.env` (see the new `.env.example`):
```
EXPO_PUBLIC_PRIVACY_URL=https://<your-backend-domain>/legal/privacy-policy
EXPO_PUBLIC_TERMS_URL=https://<your-backend-domain>/legal/terms
```
Use the **same URL** for the Privacy Policy field in Play Console → App content.

## 3. App identity (already correct in `app.json`)

- Package: `com.ascend.reelsapp`
- `versionCode: 2` — **you must bump this by 1 on every future upload**, Play Console rejects a duplicate/lower versionCode.
- `compileSdkVersion` / `targetSdkVersion`: 35 — meets Play's current target-API requirement.
- `AD_ID` permission declared (required for AdMob's advertising ID access on Android 13+).

## 4. Building the release (.aab)

There is **no `android/` directory in this repo** — the app is Expo-managed, not prebuilt — so the previous version of this doc's "local Gradle build" instructions and "keystore already generated" claim didn't match reality. Use EAS:

```bash
cd modified2/reel-flow
npm install -g eas-cli
eas login                                  # your own Expo account
eas build:configure                         # first time only — links this project, adds extra.eas.projectId to app.json
eas build --platform android --profile production
```
EAS generates and stores your upload keystore for you on first build (or you can supply your own — `eas credentials`). Download the resulting `.aab` from the build link, or run `eas submit --platform android` to push it to Play Console directly once a release track exists.

Required env vars for the build (`modified2/reel-flow/.env`, from `.env.example`): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_API_CLIENT_SECRET` (must match backend's `API_CLIENT_SECRET`), `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`.

## 5. Play Console setup — what to fill in

### 5.1 Store listing (draft — edit to taste, keep the "not cash/gambling" framing)
- **App name:** ReelFlow (or your chosen brand)
- **Short description (≤80 chars):** `Watch shorts & news, complete missions, redeem real rewards.`
- **Full description:** lead with the actual product (short-video + news feed, daily missions, streaks, referrals), mention rewards are redeemable for gift vouchers/items, avoid the words "cash", "money", "win", "jackpot", "gamble" anywhere in the listing copy.
- **Category:** Entertainment (or Lifestyle)
- **Privacy Policy URL:** the `/legal/privacy-policy` URL from §2

### 5.2 Data safety form (App content → Data safety) — map directly from `prisma/schema.prisma`
| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| Name, Email address | Yes | No | Account management |
| User IDs (device fingerprint hash) | Yes | No | Fraud prevention, security |
| Advertising ID | Yes | Yes (Google AdMob) | Advertising/personalization |
| App interactions (videos/articles viewed, missions, watch time) | Yes | No | Analytics, app functionality |
| Financial info (UPI ID / payout destination, delivery address, phone number) | Yes, only on redemption | Yes (payout/voucher fulfillment partner) | Reward/payout delivery |
| Device or other IDs | Yes | No | Fraud prevention, security |

Declare data is encrypted in transit (HTTPS everywhere), and that users can request account/data deletion in-app (Settings → Delete Account, already wired to `DELETE /api/users/account`).

### 5.3 Content rating questionnaire
- Category: Reference/Social/Entertainment-type app (not a game)
- No violence, no user-generated content moderation concerns beyond referral text, no gambling simulation (roulette pays XP only, not currency — this matters, answer the "simulated gambling" question with the accurate mechanic)
- Contains ads: Yes
- Users can interact/exchange content: minimal (referrals only, no chat/UGC)
- Expected outcome: **Teen (13+)** given real-money-adjacent rewards; don't under-declare this to reach a lower rating

### 5.4 Ads declaration
- "Does your app contain ads?" → **Yes** (Google AdMob rewarded + interstitial)

### 5.5 Target audience & age
- Target age 13+; if you answer "app is designed for children" anywhere, real-money payouts become a policy violation — make sure that's set correctly.

## 6. What only you can do (not fixable from code)
1. Create/own the Google Play Console developer account ($25 one-time) and the app listing itself.
2. Run `eas login` / `eas build:configure` with your own Expo account — this can't be done without your credentials.
3. Provide store graphics: app icon (already in `assets/`), a feature graphic (1024×500), and phone screenshots — take these from a real build, not generated mockups, since Play reviews for listing-vs-app mismatch.
4. Verify your AdMob account and confirm the Android app ID in `app.json` (`ca-app-pub-9240675969662866~...`) belongs to your AdMob account — the iOS app ID in the same config is still Google's public **test** sample ID (`ca-app-pub-3940256099942544~...`), which is fine for Android/Play Store but means iOS ads won't be real until you set a real iOS AdMob app ID (out of scope for this Play Store pass).
5. Fill in real values for `LEGAL_ENTITY_NAME`/`LEGAL_SUPPORT_EMAIL` and deploy the backend before submitting, so the Privacy Policy URL Play Console checks is live.
6. Get the payout/virtual-currency framing reviewed by an actual lawyer before real money goes out — see §1.
7. Submit for review under Testing → Internal testing first, confirm the build installs and the reward loop works end-to-end, then promote to Production.
