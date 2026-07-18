# BACKEND_CHANGES.md — Production-readiness audit

Scope: `backend/` only (Node/Express + Prisma/PostgreSQL + Redis/BullMQ).
This documents every bug found and fixed, plus what was reviewed and found
to already be solid, and what's flagged but not changed.

**Not tested against a real database/Redis instance** — no network access
was available to run `npm install`, `prisma migrate dev`, or actually boot
the server. Every fix below was verified by hand: reading the exact Prisma
schema fields/relations it touches, cross-checking function signatures
against real call sites, and a full brace/paren balance + import-resolution
sweep across all 42+ backend TypeScript files (all clean). Run the real
build and a staging deploy before trusting this in production — treat this
as a thorough first pass, not a merged PR.

**Headline finding**: this backend was already unusually solid going in —
HMAC-signed webhooks with replay protection, server-derived reward amounts
(never trusting client-claimed coin values), an append-only ledger instead
of a mutable balance column, SERIALIZABLE transactions on the withdrawal
path, idempotency keys throughout. The bugs found below are real, but they're
gaps in an already-good design, not a rewrite situation.

---

## Fixed — Correctness / "don't trust the client" bugs

### 1. Device-cloning-farm detection was structurally impossible to trigger
`DeviceFingerprint.deviceIdHash` was globally `@unique`. Since the endpoint
`upsert`s on `deviceIdHash` alone, every device could only ever have **one**
row, permanently owned by whichever user registered it first — later
registrations of the same physical device (by different accounts) silently
overwrote that row's IP/trustScore but never its `userId`. The fraud check
right below it (`uniqueUsers.size > 2` across rows sharing a `deviceIdHash`)
could therefore never see more than one distinct user, ever. This is a
device-farming detector that could never fire.

**Fixed**: changed the unique constraint to `@@unique([userId, deviceIdHash])`
with a separate non-unique index on `deviceIdHash`, and changed the upsert
to key on the compound constraint. Now the same device registered by 5
different accounts produces 5 rows, and the cross-user check actually works.
See `prisma/schema.prisma` (`DeviceFingerprint` model) and the new migration
`prisma/migrations/20260708000000_fix_device_fingerprint_unique/`.

**Known remaining limitation** (not fixable in backend code alone):
`hardwareId`, `isRooted`, and `isEmulator` are entirely self-reported by the
client. A sophisticated abuser can just send a fresh random `hardwareId` on
every request to evade this table entirely. Closing that gap needs a native
attestation layer (Google Play Integrity API / similar) on the client side,
which is a bigger cross-stack project, not a backend fix — flagging it here
so it isn't mistaken for solved.

### 2. Unlimited XP could be minted via `POST /shorts/watch`
`reportWatchTime` took `watchSeconds` entirely on faith from the client and
used it directly to compute `xpEarned` (2 XP per 10 seconds), with no upper
bound and no de-duplication. A client could report `watchSeconds: 999999`
in one call, or call the endpoint in a tight loop for the same video, and
mint effectively unlimited XP — which now feeds real, visible things
(levels, and the Leaderboard/Achievements screens built in the frontend
pass). Coins were already safe here (`REWARD_COINS_PER_10_SEC` is hardcoded
`0`), but XP was wide open.

**Fixed**: `watchSeconds` is now validated (finite, non-negative) and
**clamped** to a plausible per-report ceiling (180s) regardless of what's
claimed, and a Redis-backed per-user-per-video cooldown (30s) blocks rapid
repeat reports for the same video from earning again — it acknowledges the
request but awards nothing further, so a legitimate client retry doesn't
see an error. See `src/controllers/shortsController.ts`.

### 3. `addExp` had a lost-update race under concurrent reward claims
`addExp` read `user.xp`, computed `newXp = user.xp + xpToAdd` in application
code, then wrote it back with a plain `update`. Two reward claims landing
close together for the same user (very plausible — e.g. an ad reward and a
mission-completion firing near-simultaneously) could both read the same
starting `xp`; whichever write lands second silently overwrites the first,
and that XP is gone.

**Fixed**: now uses Prisma's atomic `{ xp: { increment: xpToAdd } }`, which
Postgres applies as a single atomic row operation regardless of how many
concurrent calls land — no XP can be lost this way anymore. Level-up is then
computed from the authoritative post-increment value. See
`src/services/expService.ts`. (The follow-up `level` write has a much
narrower, lower-stakes residual race — see "Known non-blocking gaps" below.)

### 4. `applyReferral` / `processWithdrawal` had read-then-write races
- `applyReferral` checked "does this user already have a referral?" and then
  created the row as two separate steps — a race between two near-simultaneous
  calls could both pass the check. The DB's `referredId @unique` constraint
  was already the real backstop, but the second (losing) request wasn't
  catching that failure, so it surfaced as a raw 500 instead of a clean
  "already applied" message. **Fixed**: now catches the `P2002` unique
  violation and returns a proper 400.
- `processWithdrawal` (admin approve/reject) read `status`, checked it was
  `PENDING`, then updated it as two separate steps — two concurrent
  approve/reject calls for the same withdrawal could both pass the check and
  both pay out a refund or referral bonus (double-payment). **Fixed**: the
  status transition is now a single atomic `updateMany({ where: { id, status:
  'PENDING' }, ... })`; only one concurrent request can win, and the loser
  gets a clean 409 instead of double-paying. See `src/controllers/
  adminController.ts` / `src/controllers/referralController.ts`.

## Fixed — Robustness (a Redis blip should never take the API down)

### 5. `fraudDetectionMiddleware` ran on every single request with no error handling
This middleware is mounted globally (`app.use(fraudDetectionMiddleware)`,
before all routes) and made several unguarded `await redisConnection.x()`
calls. The shared Redis client is configured with `maxRetriesPerRequest:
null` (required for BullMQ), which means commands sent while Redis is
unreachable queue **indefinitely** rather than throwing — so a Redis outage
wouldn't just degrade fraud detection, it would hang every request in the
entire app forever.

**Fixed**: every Redis call in this middleware now races against a 750ms
timeout and fails open (logs a warning, proceeds without that signal)
instead of hanging or throwing. The whole function is also wrapped in a
last-resort `try/catch` that fails open rather than 500ing legitimate
traffic because of an unrelated infra hiccup. See
`src/middlewares/fraudMiddleware.ts`.

### 6. The HTTP response cache was a per-process in-memory `Map`
`cacheMiddleware` cached GET responses (news, shorts) in a plain in-process
`Map`. The moment this runs as more than one instance — any real horizontally
-scaled deployment — each instance has its own cache, so `invalidateCache()`
(called when an admin edits RSS sources or ad config) only clears the
instance it happened to run on; the others keep serving stale data
indefinitely. It was also unbounded, a slow memory leak under varied query
traffic.

**Fixed**: rewritten to use Redis (already a dependency) as the primary
cache — shared and correctly invalidated across every instance — with a
size-bounded in-memory fallback if Redis is briefly unreachable, and
`SCAN`-based (not blocking `KEYS`-based) invalidation. See
`src/middlewares/cacheMiddleware.ts`.

### 7. Rate limiters were also per-process
`express-rate-limit`'s default store is in-memory, same problem as #6: a
"20 login attempts/hour" limiter actually allows `20 × instanceCount` in a
scaled deployment, and the same for the withdrawal-abuse limiter — exactly
the two endpoints where under-enforcement matters most.

**Fixed**: added `src/middlewares/redisRateLimitStore.ts`, a small custom
Store backed by the same Redis connection everything else uses (no new npm
dependency needed), also fail-open on Redis errors for the same
availability reasoning as #5. Wired into all three limiters in
`src/middlewares/securityMiddleware.ts`.

## Fixed — Security

### 8. `GET/PUT /admin/env-config` exposed and allowed rewriting raw secrets
This endpoint (gated behind `SUPER_ADMIN`, so not open to the public, but
still) returned the **entire `.env` file in plaintext** — `JWT_SECRET`,
`DATABASE_URL` with embedded credentials, `API_CLIENT_SECRET`, Firebase/
Google keys — to any request with a super-admin token, and allowed
overwriting the whole file over HTTP. If a super-admin session is ever
compromised (phished, an XSS in the admin panel that exfiltrates this one
response, etc.), the blast radius is total: forge auth tokens for any user
(`JWT_SECRET`), forge signed offerwall postbacks (`API_CLIENT_SECRET`), or
read/write the whole database directly (`DATABASE_URL`). Separately, writing
to `.env` at runtime doesn't even reliably work — `dotenv` only loads once
at process start, so changes need a restart to take effect, and many hosting
platforms (this project's `railway.json` suggests Railway) don't persist
filesystem writes across deploys at all — so admins using this to "update a
secret live" would be quietly misled.

**Fixed**: `getEnvConfig` now redacts any key matching a secret-like name
pattern (`SECRET`, `KEY`, `TOKEN`, `PASSWORD`, `DATABASE_URL`, `PRIVATE`,
`CERT`, etc. — matched broadly so a newly-added secret is redacted by
default, not accidentally exposed) before returning the file content.
`updateEnvConfig` now rejects any attempt to set a key matching that same
pattern, with a message pointing the admin at their hosting platform's
secret manager instead, and the success response now says plainly that the
change needs a restart and may not persist depending on the host. See
`src/controllers/adminController.ts`.

### 9. ~106 places leaked raw internal error messages to the client
The near-universal error-handling pattern was `catch (error: any) {
res.status(500).json({ error: error.message }) }`. `error.message` on an
unexpected failure can be a raw Prisma validation error, a driver error, or
anything else an exception happened to say — none of it meant for a client,
and some of it (schema/column names, query fragments) is genuinely useful
information to an attacker probing the API.

**Fixed**: added `src/utils/errorResponse.ts` with two helpers —
`sendServerError` (logs the full error server-side via the structured
logger, returns a generic message to the client in production, the real
message in development) and `sendControllerError` (for the few places that
deliberately throw `Object.assign(new Error(...), { statusCode: 4xx })` for
expected client-facing failures — those messages are authored to be safe to
show, so they're still echoed; only the unexpected-error fallback path is
genericized). Applied across all 12 affected controller/route files
(`remoteConfigAdminController`, `configController`, `fingerprintController`,
`adminController`, `newsController`, `rewardsController`, `shortsController`,
`referralController`, `userController`, `walletController`,
`routes/users.ts`, `routes/offerwall.ts`).
Left as-is on purpose: `configController.ts`'s YouTube-import-sync endpoint
(super-admin-only tooling; the real error is genuinely useful there and
never reaches an end user).

### 10. Case-sensitive admin user search
`GET /admin/users?search=` used Prisma's default case-sensitive `contains`,
so an admin searching "john" wouldn't find "John Smith". Minor, but a real
usability/support-tooling bug. **Fixed**: added `mode: 'insensitive'`. See
`src/controllers/adminController.ts`.

### 11. Missing `.gitignore` in `backend/`
There was no `.gitignore` in the backend project root at all — a real risk
that `.env` (containing `JWT_SECRET`, `DATABASE_URL`, etc.) or `node_modules`
gets committed the first time someone runs `git add .`. Added one covering
`.env`, `node_modules/`, `dist/`, `logs/`, and the `.env.*.bak` backup files
`updateEnvConfig` creates.

---

## Reviewed and found solid — no change made

- **Auth** (`authController.ts`): Google ID tokens are verified server-side
  against Google's public keys (both the Firebase Admin and OAuth2Client
  paths) — user identity is never taken from client-supplied claims.
- **Reward claiming** (`rewardsController.ts`): coin amounts are always
  server-derived from `AdRewardRule`/config rows, never trusted from the
  client; daily caps, cooldowns, and device-fingerprint fraud checks are
  enforced before crediting.
- **Ledger** (`ledgerService.ts`): append-only, balance derived by summing
  entries rather than a mutable column that could drift, idempotency keys
  throughout, negative-balance protection.
- **Withdrawal flow** (`walletController.ts`): already used a
  `SERIALIZABLE` transaction with atomic `updateMany`-guarded code issuance
  and stock decrement — this was the strongest-written part of the codebase
  and needed no changes.
- **Offerwall webhook** (`routes/offerwall.ts`): HMAC-signature verified
  (`signatureMiddleware.ts`), timing-safe comparison, replay protection,
  bounded reward amount (`MAX_OFFERWALL_REWARD_PER_CALL`), banned-user check.
- **Public config exposure** (`configController.ts`): uses an explicit
  allowlist (`SAFE_PUBLIC_KEYS` / `ADMOB_CONFIG_KEYS`) rather than exposing
  the whole `AppConfig` table to clients — the right pattern for a
  general-purpose config table with an unauthenticated public endpoint.
- **Prisma schema**: proper unique constraints and indexes throughout
  (`CoinLedger.idempotencyKey`, `Referral.referredId`, `CatalogCode`
  compound unique + `withdrawalId` unique, `ABTestAllocation` compound
  unique, `DailyUserStats` compound unique) — the only structural gap found
  was `DeviceFingerprint` (#1 above).

## Flagged, not changed — needs a product/infra decision, not a code fix

- **`Withdrawal.amountInr` / `CatalogItem.inrValue` are `Float`.** Floating-
  point money fields can accumulate rounding error over time (analytics
  sums, repeated arithmetic). The conventional fix is `Decimal` (Prisma
  `@db.Decimal(10,2)`) or storing paise as an `Int`. Didn't change this —
  it touches several models and would need a real migration + a decision on
  precision, not something to guess at without confirming with whoever owns
  the schema.
- **`getBalance` recomputes `SUM(amount)` over the full ledger on every
  call**, including on every `getProfile` request. Fine at low-to-moderate
  volume (the `@@index([userId, timestamp])` keeps it reasonably fast), but
  at high scale this is a growing per-request cost. A common fix is a
  periodically-reconciled materialized balance column — worth planning for
  before this becomes a bottleneck, not urgent today.
- **Referral `tier` never escalates.** The schema comment says tier
  "escalates with activity," and `adminController.ts` already pays out
  10/15/20% by tier — but nothing in the codebase ever moves a referral
  from tier 1 to 2 or 3. Every referral currently pays the tier-1 rate
  forever. Didn't build a tier-escalation system since the actual
  business rule (what activity, what thresholds) isn't specified anywhere
  — flagging rather than guessing.
- **XP `level` write has a narrow residual race** (see fix #3) — the `xp`
  value itself is now fully protected by an atomic increment and can never
  be lost, but if two `addExp` calls somehow complete their level-up writes
  out of order, the stored `level` could momentarily lag behind what the
  true `xp` implies. It self-corrects on the next `addExp` call for that
  user (level is always recomputed from the authoritative `xp`). A fully
  airtight fix needs row-level locking (`SELECT ... FOR UPDATE`), which
  felt like overkill for a display-only derived field — flagging in case
  you disagree.
- **Client-reported device signals** (`isRooted`, `isEmulator`,
  `hardwareId`) — see the note under fix #1. Real hardening here needs
  native attestation (Play Integrity API), not a backend change.
