# Production Readiness

Current state of the ReelFlow system, written at the end of the hardening pass. Supersedes the older point-in-time audit files at the repo root (`audit.md`, `readudit.md`, `playstore_tos_audit_report.md`, etc.), which are historical and partly stale.

## How to verify any claim here

```bash
# Backend — needs Postgres + Redis running, and the server up on :5000
cd backend
npx tsc --noEmit -p .        # typecheck
npm test                      # unit tests (6)
npm run test:e2e              # scenario suite (163) against real Postgres + Redis
npm run test:load             # load test; LOAD_USERS / LOAD_DURATION_S to tune

# Mobile app
cd modified2/reel-flow
node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit
npm test                      # 96 tests

# Admin panel
cd admin-panel
npm run build                 # includes typecheck
npm test                      # 27 tests
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push and PR.

## What is covered

| Area | State |
|---|---|
| Backend business logic | 163 E2E scenarios against real Postgres + Redis — auth, signing, wallet, referrals, missions, streaks, levels, roulette, badges, admin CRUD, crash reporting |
| Authorization & abuse | Role separation across admin tiers, IDOR, forged JWT role claims, banned/deleted accounts, SQL-injection-shaped input, pagination bounds, telemetry tampering |
| Concurrency | Double-spend on withdrawals, daily bonus, roulette spins, streak-freeze purchases |
| Error handling | Users never see technical detail; every server error and device crash is logged per-user and visible in the admin panel |
| Crash visibility | Device crashes reach the admin panel with platform, app version, screen and stack |
| Mobile logic | 96 tests — request signing parity with the server, config store resilience, ad placement eligibility, ad-farming guard, crash reporter, offline/retry behavior |
| Admin panel | 27 tests — auth/401 handling and the error-log console |
| Load | 1750 req/s at 50 concurrent users, 0 errors, p95 149ms (single container, local DB) |
| CI | All three projects on every push; also fails if migrations drift from `schema.prisma` |
| Remote config | Ad placements, reward rules, caps, level thresholds, streak milestones, referral tiers, badges, marquee, feature flags and content strings are all admin-editable |
| Play Store compliance | The three critical TOS violations are resolved; legal pages live at `/legal/privacy-policy` and `/legal/terms` |

## Bugs found and fixed in this pass

Each was found by a test written against real behavior, not by inspection.

1. **The admin withdrawal queue was entirely broken** — 500 on every request. `getWithdrawals` included a `catalogItem` relation that was never declared on the model. Since the admin UI drives its whole voucher/physical fulfillment workflow off `catalogItem.type`, finance admins could not process payouts at all.
2. **Users could exceed the streak-freeze cap** — `purchaseStreakFreeze` read the count, checked the cap, then incremented, so concurrent requests both passed the check. The cap is now enforced inside the `UPDATE`'s `WHERE`.
3. **Request signing could 401 on deeply nested payloads** — the server capped key-sorting at depth 5 (a DoS guard); the client did not, so the two produced different signatures.
4. **A malformed remote-config response could brick the app across restarts** — the payload was cast straight off the network with no validation and persisted to AsyncStorage, so a partial response wrote `undefined` into the placement/content maps and made every lookup throw.
5. **Admin-authored marquee messages could be silently dropped** — custom messages were pooled with up to 45 organic items, shuffled, then sliced to 24, so on any active app a configured message might never display. (Also the shuffle was `sort(() => Math.random() - 0.5)`, which is not uniform.)
6. **Crash reports with long stacks were rejected** — an untruncated React Native stack exceeded the 10 KB body limit, meaning the worst crashes were exactly the ones that never got reported.
7. **Negative pagination 500'd, and several list endpoints had no upper bound on `limit`** — `?limit=999999` asked the database for the whole table.
8. **Telemetry accepted negative and unbounded counts** — a tampered client could rewind lifetime counters or complete a mission in one call.
9. **A network blip silently forfeited earned XP** — `DiscoverDetail` marked an article reward-claimed before the request completed and never released it on failure.
10. **The admin error-log status filter did an exact match**, so a "5xx" filter hid 502s.

## What is NOT covered — read this before shipping

These are real gaps, not formalities.

### Requires a physical device (cannot be done from this environment)
- **No on-device testing at all.** Nothing here has run on real Android hardware. The performance work (list windowing, image handling, animation cleanup) was a code review, not a profiling run — no FPS, memory, or battery numbers exist for a low-end device.
- **Offline behavior is tested at the HTTP layer, not on a device.** The retry/offline logic is covered by tests, but nobody has put the app in airplane mode mid-flow.
- **Ad rendering is untested.** AdMob has never served a real ad to this build. Reward attribution end-to-end through a live ad is unverified.

### Requires your accounts
- Play Console setup, EAS build and signing, store graphics, and the Data Safety / content rating declarations — all itemized in `PLAYSTORE_DEPLOYMENT.md` §6.
- The iOS AdMob app ID in `app.json` is still Google's public test ID. Android is real; iOS ads will not work until you set yours.

### Deliberately left, with reasons
- **Accessibility is partial.** Core surfaces are done — primary navigation, wallet redemption, rewards, discover and reward cards, error recovery. 14 files with interactive elements still lack accessibility props (shorts player, games grid, leaderboard, notifications, and other secondary screens). No screen-reader pass on a real device.
- **Lint is not gating CI.** The repo carries pre-existing `no-explicit-any` debt across older admin pages. Lint runs and reports; it does not fail the build. Clearing that backlog is a separate cleanup.
- **No external security audit or penetration test.** The authorization and abuse coverage above is thorough but self-administered.
- **No localization.** The app is English-only, with strings admin-editable but not translated.
- **Load numbers are indicative, not a capacity plan.** They come from one container with a local database. Real capacity depends on your production Postgres, Redis and instance sizing.

### Business, not engineering
- This is a watch-ads → virtual coins → real payout product. That model is legal and Play-approved, but it sits close to regulated territory. **Get a lawyer's review before the first real payout**, particularly on the virtual-currency and payout framing. The `short_watch_reward_coins_legal_review_approved` flag exists so that decision is made deliberately rather than by leaving a default on.
- The privacy policy and terms at `/legal/*` are a compliance-oriented draft built from what the schema actually collects. They are not a substitute for counsel.

## Operational notes

- `RATE_LIMIT_GLOBAL_MAX` / `RATE_LIMIT_GLOBAL_WINDOW_MS` tune the per-IP limiter. The default (1000 per 15 min) may be too tight for a mobile app behind carrier-grade NAT, where many real users share one IP.
- `LEGAL_APP_NAME`, `LEGAL_ENTITY_NAME`, `LEGAL_SUPPORT_EMAIL` fill in the legal pages; set them before submitting to Play Console.
- Error masking keys off `NODE_ENV`: verbose only when it is explicitly `development` or `test`, masked otherwise. An unset `NODE_ENV` in production therefore fails safe.
- The admin Error Log (Super Admin only) is the first place to look when a user reports a problem — it carries both server errors and device crashes for that specific user.
