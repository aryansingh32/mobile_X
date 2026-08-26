# MONETIZATION_CHANGES.md

Continuation of `CHANGES.md` — covers this round only: wiring the new
backend ad-farming penalty into every ad surface in the app.

**What I found on review**: AdMob was already fully integrated, and better
than a first pass usually looks — `DiscoverScreen.tsx`, `ShortsFeed.tsx`
(two placements), `GamesScreen.tsx`, and `App.tsx` (nav interstitial +
app-open ad) all already used `react-native-google-mobile-ads` correctly,
with server-derived rewards (`claimAdReward`, never trusting a client-
reported amount), full lifecycle telemetry (`reportAdEvent`), app-
backgrounding abort protection so switching apps mid-ad doesn't still pay
out, real-device detection so the ad SDK never initializes on an emulator,
and ATT permission handling for iOS. Ad placement timing already came from
`useAdPlacement.ts`, which reads admin-configured `intervalMin/Max`,
`cooldownSeconds`, `maxPerSession`, and `skipFirstNActions` per placement,
plus a global cross-placement cooldown — this is the "shown randomly after
a few seconds/items" behavior, and it was already solid before I touched
anything.

**What was missing**: nothing detected *abuse* — a user repeatedly
triggering and backing out of rewarded ads had no escalating consequence.
See `backend/ADMIN_AND_MONETIZATION_CHANGES.md` for the full server-side
design; this file covers only the client wiring.

## New files

- `src/utils/adFarmingGuard.ts` — `reportAdEventWithPenaltyCheck(event)`
  wraps the existing `reportAdEvent` API call; if the backend responds with
  a `penaltyUntil` timestamp (only possible on a `DISMISSED`/`ABANDONED`
  report), it's stored via `useAppStore.setAdPenaltyUntil`.
  `formatAdPenaltyMessage(seconds)` turns that into a friendly string
  ("Ads will be available again in 5 minutes.").

## Changed files

- `src/store/useAppStore.ts` — added `adPenaltyUntil: number` (persisted)
  and `setAdPenaltyUntil`.
- `src/hooks/useAdPlacement.ts` — `canShow()` now also checks
  `adPenaltyUntil` before allowing an ad card to be injected into a feed.
  Added standalone exports `isAdPenalized()` and
  `getAdPenaltyRemainingSeconds()` for trigger functions that don't go
  through feed injection (game completion, nav interstitial, app open).
- `src/api/config.ts` — `reportAdEvent` now returns the parsed
  `{ penaltyUntil?, penaltySeconds? }` payload instead of discarding the
  response body.
- `src/components/discover/DiscoverScreen.tsx` — `triggerRewardedAd` bails
  out with a friendly alert (no AdMob SDK call at all) if
  `isAdPenalized()`; its `CLOSED` handler now reports the dismissal through
  `reportAdEventWithPenaltyCheck` instead of the bare `reportAdEvent`.
- `src/components/shorts/ShortsFeed.tsx` — same pattern applied to both
  `handleInterstitialTrigger` and `handleVideoOptInTrigger`.
- `src/screens/GamesScreen.tsx` — `handleGameExit`'s completion interstitial
  now also checks `isAdPenalized()`. This placement is non-rewarded
  (`INTERSTITIAL`, not `REWARDED_*`) so it never *contributes* to the
  penalty calculation — dismissing a non-rewarded interstitial isn't a
  farming signal — but it still *respects* an active penalty from
  elsewhere, on the reasoning that a user already flagged for abuse
  shouldn't keep triggering additional AdMob SDK calls anywhere in the app.
- `App.tsx` — same reasoning applied to the nav-transition interstitial and
  the app-open ad (both non-rewarded).

## Why the penalty logic itself lives on the backend, not here

The actual abandonment-ratio computation and threshold comparison happen
entirely server-side (`configController.ts`), reading real `AdEvent`
history — the client never computes or claims its own penalty state, it
only *receives and respects* what the backend already decided. That's
deliberate: a client-side-only "you've dismissed 3 ads, wait 5 minutes"
counter would reset the moment someone cleared app storage or reinstalled,
and wouldn't survive multi-device abuse. The backend signal is tied to the
authenticated user, not the device.
