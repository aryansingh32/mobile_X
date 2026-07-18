# ADMIN_AND_MONETIZATION_CHANGES.md

Continuation of `BACKEND_CHANGES.md` — covers this round only: admin-panel
auth hardening and the new ad-farming detection system. Same caveat as
before: written and hand-verified without a live DB/Redis to test against.

---

## 1. Admin panel auth — real backend verification, not just "a token exists"

**Added**: `GET /admin/me` (`src/controllers/adminController.ts` → `getMe`,
wired in `src/routes/admin.ts`). Returns `{ id, email, name, role }` for
the authenticated admin. It's deliberately trivial — its only job is to be
a cheap, fast round-trip the admin panel can call once on load to get a
real, backend-verified answer to "is this actually a valid, current admin
session," instead of the previous client-only check (see
`ADMIN_PANEL_CHANGES.md` in the `admin-panel` project for the frontend side
of this).

This was already safe from a data standpoint — every `/admin/*` route
already re-verifies role server-side via `authorizeAdmin`/`authenticate`,
and `authenticate` re-fetches the user row from the DB on every request
(not just trusting old JWT claims), so a demoted or banned admin was always
rejected immediately regardless of token age. `/admin/me` doesn't change
that — it just gives the frontend a clean way to ask the question directly
instead of inferring it from whether the dashboard shell happens to render
before the first real API call 401s.

## 2. Fixed a bug in my own env-redaction change (from the previous round)

`BACKEND_CHANGES.md` #8 redacted secret values out of `GET /admin/env` and
blocked `PUT /admin/env` from setting any key matching a secret-like name
pattern. That was correct as far as it went, but had a real bug: since the
admin panel's env editor is a single textarea that resubmits the *entire*
file on every save, and any real `.env` will contain at least one secret,
every save would include the still-redacted placeholder line for that
secret — which my check treated as "someone is trying to set a secret" and
rejected outright. In practice this made `updateEnvConfig` unusable for
changing *anything*, including totally unrelated non-secret values, the
moment any secret existed in the file (which is always).

**Fixed**: `updateEnvConfig` now reads the current on-disk `.env` first and
reconciles line-by-line — if a sensitive key's submitted value is still
exactly the redacted placeholder (meaning the admin never touched that
line), it's silently rewritten back to the real current value before
saving; only a sensitive key whose submitted value has genuinely changed
gets rejected. This also means an admin can never accidentally overwrite a
real secret with the literal string `***REDACTED***` by saving without
editing that line — a side benefit of the reconciliation approach, not an
accident.

## 3. New: ad-farming detection (backend-monitored, not a client heuristic)

You asked specifically for: ads shown at randomized intervals (already
existed — see `useAdPlacement.ts` / the `AdPlacement` config table, with
`intervalMin/Max`, `cooldownSeconds`, `maxPerSession`, `skipFirstNActions`,
all admin-tunable and already wired into every ad surface), **and** a
mechanism where a user trying to abuse/farm the rewarded-ad card gets shown
ads *less* often afterward, specifically to avoid AdMob invalid-traffic /
ad-farming policy bans — and for that mechanism to be backend-owned, not a
client-side trick.

**What existed already, reviewed and left alone**: the whole ad
placement/timing/reward system (`useAdPlacement.ts` on the client,
`AdPlacement`/`AdRewardRule`/`DailyCapPolicy` tables + `getRemoteConfig` on
the backend) was already well-built — randomized intervals per placement,
per-placement and global cross-placement cooldowns, session caps,
server-derived reward amounts via `claimAdReward`, full ad-lifecycle
telemetry (`AdEvent` table) already feeding the existing Ad Analytics admin
page. Real device detection to avoid initializing the ad SDK on emulators,
ATT permission handling, `MaxAdContentRating.G` — this reflects real
AdMob-policy awareness already baked in before I touched anything.

**What was missing**: nothing computed *abuse*, specifically. A user could
repeatedly trigger a rewarded ad and back out before it finished (or before
the reward fires) as fast as the existing cooldowns allowed, with no
escalating consequence — exactly the "invalid traffic" pattern that gets
AdMob accounts suspended.

**Added**: `reportAdEvent` (`src/controllers/configController.ts`) now does
real work on `DISMISSED`/`ABANDONED` events for rewarded ad types:

1. Looks at the user's rewarded-ad `AdEvent` history over a rolling window
   (`ad_farming_window_minutes`, default 60 min).
2. Computes abandonment **per session, not per raw event** — this matters:
   a legitimate full ad watch also fires a `DISMISSED` event right after
   `EARNED_REWARD` (the ad UI still has to close), so counting raw
   `DISMISSED` events would flag every honest user. What actually indicates
   farming is a `sessionId` that got dismissed/abandoned *without* ever
   earning a reward.
3. Deliberately scoped to `adType` values starting with `REWARDED` only —
   plain interstitials (game-completion, nav-transition, app-open) have no
   `EARNED_REWARD` counterpart by design, so every dismissal of those would
   otherwise look like 100% abandonment and unfairly penalize a user's
   legitimate rewarded ads elsewhere just for playing games normally.
4. If the abandon-without-reward ratio crosses `ad_farming_abandon_threshold`
   (default 0.6) with at least `ad_farming_min_sample` (default 5) sessions
   in the window, the response includes an escalating `penaltyUntil`
   timestamp (`ad_farming_penalty_base_seconds` × strikes, capped at
   `ad_farming_penalty_max_seconds` — defaults 5 min base, 30 min cap)
   instead of the usual empty `204`.
5. If the pattern is severe (`ad_farming_fraud_sample`, default 10+
   sessions, `ad_farming_fraud_threshold`, default 0.85+ abandon ratio), it
   also logs a `AD_FARMING_SUSPECTED` / `HIGH` entry via the existing
   `fraudService.logFraud` — which means it shows up in the admin panel's
   existing Fraud Center page automatically, no new admin UI needed for the
   severe cases.

All six thresholds are plain `AppConfig` rows (seeded in
`prisma/seed-config.ts`, `ad_farming_*` keys) — editable through the
existing generic Config admin page like every other tunable in this app,
per your "controlled in admin panel" requirement.

### Client wiring

Every ad-trigger point in the app now respects this:

- `src/hooks/useAdPlacement.ts` — `canShow()` (which decides whether to
  even inject an ad card into a feed) now also checks a local
  `adPenaltyUntil` timestamp; exports standalone `isAdPenalized()` /
  `getAdPenaltyRemainingSeconds()` for trigger functions that don't go
  through `canShow()`.
- `src/utils/adFarmingGuard.ts` (new) — `reportAdEventWithPenaltyCheck`
  wraps the existing `reportAdEvent` call and stores any returned
  `penaltyUntil` into `useAppStore`; `formatAdPenaltyMessage` turns it into
  a friendly "Ads will be available again in 5 minutes" string.
- Wired into all five ad surfaces: `DiscoverScreen.tsx` (sponsored card),
  `ShortsFeed.tsx` (both the interstitial and rewarded-video-opt-in
  triggers), `GamesScreen.tsx` (completion interstitial — doesn't
  *contribute* to the penalty since it's non-rewarded, but still *respects*
  an active one, for overall account-health safety), and `App.tsx` (nav
  transition interstitial and app-open ad, same reasoning).
- `adPenaltyUntil` is persisted in `useAppStore` (survives app restart —
  otherwise a farming attempt could just be reset by killing the app,
  though the *real* signal is server-side and would just get recomputed
  and reapplied on the next dismissal anyway).

The actual AdMob-ban-prevention mechanism is that penalized trigger
functions **never call `.load()`/`.show()` on the AdMob SDK at all** while
penalized — it's not just hiding a UI card, it's refusing to make the SDK
request in the first place, which is what actually matters for invalid-
traffic detection.
