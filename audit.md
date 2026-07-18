# Reel Flow — Staff Engineer Technical Audit
**Scope:** `reel-flow` (React Native/Expo app), `admin-panel` (React/Vite), `backend` (Node/Express/Prisma)
**Audit type:** Architecture, code quality, security, scalability, technical debt + missing-feature analysis
**Method:** Full extraction and static review of all three repositories. No code was written or modified — this is analysis only.

---

## 1. Project Overview

**What this product is:** A rewarded-engagement mobile app ("Reel Flow"). Users watch a YouTube-Shorts-style vertical video feed and a news feed, earn coins/XP for watch-time, complete offerwall tasks and missions, and withdraw coins as INR via a catalog of redemption options. A React/Vite admin panel gives staff control over users, fraud, withdrawals, content, A/B tests, and config. The backend is a single Express/Prisma API gateway serving both the app and admin panel.

**Confirmed stack:**
- **Mobile app:** React Native + Expo, Zustand (`useAppStore`), Axios, file-based screens (no router library detected — `App.tsx` likely does manual screen switching).
- **Admin panel:** React 18 + Vite + TypeScript + Tailwind, plain `axios` service layer, Google OAuth login (`@react-oauth/google`).
- **Backend:** Express 5, Prisma 6 (SQLite in dev — `prisma/dev.db`, schema explicitly notes a Postgres migration path), BullMQ + Redis (ioredis) for async reward processing, Firebase Admin + Google `OAuth2Client` for auth, Winston logging, Prometheus metrics (`express-prom-bundle`), `node-cron` for scheduled jobs, `rss-parser` + `cheerio` for news ingestion.
- **Deployment:** `docker-compose.yml` and `prometheus.yml` present — containerized, single-region, no evidence of multi-instance orchestration (k8s manifests, load balancer config) in the repo.
- **Repo structure:** Three separate repositories (not a monorepo) — frontend, admin-panel, backend each have their own `package.json` and are deployed independently.

**Core business flows confirmed in code:**
1. Google sign-in → JWT issuance (`authController.googleLogin`).
2. Shorts feed → watch-time reporting → BullMQ job → coin/XP ledger entry (`shortsController`, `queueService`, `ledgerService`).
3. News/Discover feed sourced from RSS feeds via a fully automated ingestion pipeline (`newsIngestionService`, `node-cron`).
4. Offerwall demo tasks + a signed webhook postback path for real offerwall providers.
5. Wallet → withdrawal → admin approval workflow, with a fraud/risk-score layer gating it.
6. Admin panel: users, fraud logs, withdrawals, content (RSS + YouTube pool), categories, catalog, missions, referrals, A/B tests, env config, analytics.

---

## 2. Frontend Analysis (`reel-flow`)

### Architecture
- Reasonably clean separation: `api/` (one file per domain — `shorts.ts`, `wallet.ts`, `rewards.ts`, etc.), `screens/`, `components/<feature>/`, `store/useAppStore.ts` for global state, `hooks/`.
- Single global Zustand store holds auth token and triggers `logout()` from the Axios response interceptor on 401 — a clean, centralized pattern.
- No visible navigation library (no `@react-navigation` in the dependency tree based on file naming); screen switching appears to be handled manually in `App.tsx`. This works at the current size but will not scale well once more than a handful of screens/modals exist — deep linking, back-stack behavior, and gesture navigation become hard to maintain by hand.

### Code Quality
- `src/data/shorts.json` (52 lines of mock short-video data) is **dead code** — not imported anywhere in `src/`. Should be deleted or clearly marked as fixture/test data.
- `test.js`, `test2.js`, and `scratch.tsx` sit at the project root, outside `src/`. These look like scratch files left in the shipped tree — they should move to a `__tests__`/`scripts` folder or be removed before this goes to a client/production handoff.
- `ShortItem.tsx` is 743 lines for a single feed item component — this is large for one component and is a strong candidate for splitting (e.g., separate the WebView wrapper, the reward/HUD overlay, and the gesture handling into their own files).
- Type safety: API layer (`api/*.ts`) generally types responses, but several spots use `any` for return values (e.g., `fetchShorts` casts `data as {...}` only at the call site, not at the Axios layer), and `client.ts`'s response interceptor doesn't type the error shape.

### Performance
- The shorts feed already implements the right idea — a small pool of persistent WebViews recycled across scroll positions (per your own project history) rather than mounting a new WebView per video, which is the correct fix for the known RN-WebView memory/performance ceiling.
- No explicit `React.memo`/`useCallback` audit was done at file level here, but given `ShortItem.tsx`'s size, re-render scope is a real risk: any state change in the parent `ShortsFeed.tsx` that isn't carefully scoped will re-render all mounted WebView slots, which is exactly what the pooling strategy is trying to avoid.
- Image optimization: thumbnails are pulled directly from `https://img.youtube.com/vi/{id}/default.jpg` (see admin panel) with no caching/CDN layer in front of them — acceptable for now, but as the pool grows this is 100% dependent on YouTube's own thumbnail CDN being fast and available.

### Security
- `client.ts` correctly attaches the JWT via an interceptor and centrally handles 401 (logout) and 429 (toast). No obvious secret leakage into the client bundle.
- `app.json` bundles `google-services.json` directly in the repo — standard for Firebase/Expo, but confirm this doesn't contain anything beyond the public Firebase config (it normally doesn't, but worth a quick check before any public repo push, given your GitHub presence).

---

## 3. Backend Analysis (`backend`)

### Architecture
- Reasonable layered structure: `routes/` → `controllers/` → `services/` → Prisma. Domain logic (fraud scoring, ledger math, news ingestion) is correctly pulled into `services/`, not left in controllers.
- `prisma/schema.prisma` is detailed and clearly admin-driven by design — `AppConfig` (key/value), `Category`, `RssSource`, `CatalogItem`, `Missions`, `ABTest` are all explicitly modeled as "admin-controlled" in the schema comments. This is a good, consistent pattern... **except it was not applied to YouTube Shorts** (see Section 6 — this is the core gap you asked about).

### API Design
- Endpoints are consistent (`/api/admin/...`, `/api/shorts`, `/api/wallet`, etc.), JSON in/out, no versioning (`/api/v1/...`) — fine for a single-client product today, but will hurt later if the admin panel and mobile app ever need to evolve independently against different API versions.
- Error handling is centralized in `errorMiddleware.ts`, but most controllers manually `try/catch` and return ad-hoc `{ error: message }` — there's no shared input-validation layer (no Zod/Joi/class-validator anywhere in the dependency list). Validation is done by hand per controller (`if (!videoIds) ...`), which is inconsistent and easy to forget on new endpoints.

### Database
- SQLite in dev with an explicit comment pointing to the Postgres migration path — fine for prototyping, but note that **BullMQ + Redis + SQLite is an unusual production combination**: SQLite does not handle concurrent writers well, and once the queue worker and the API process are both writing under load, this will become a real bottleneck. This needs to move to Postgres before any real scale test.
- Indexing is present where it matters (`CoinLedger` on `[userId, timestamp]`, `NewsArticle` on `publishedAt`/`sourceId`/`categoryId`/etc.) — good practice, clearly intentional.
- `YoutubeVideoPool` has **no index beyond the unique `videoId`**, no `categoryId`, no `source` field (manual vs. API-fetched), no `viewCount`/engagement tracking that `NewsArticle` has. It is the least-developed model in the schema relative to its sibling content models.

### Scalability
- `cacheMiddleware.ts` and the fraud-detection request counters (`requestCounts`, `ipToUsers` in `fraudMiddleware.ts`) are **plain in-memory `Map`s with no TTL eviction and no shared store**. Two consequences:
  1. They leak memory slowly forever (no cleanup of stale entries).
  2. The moment you run more than one backend instance (which you will need to, to scale past a single Node process), each instance has its own cache and its own fraud counters — an attacker (or just a normal user load-balanced across instances) can trivially bypass the 150-req/min fraud threshold and the GET cache becomes inconsistent across instances. This needs to move to Redis (which you already depend on for BullMQ) before horizontal scaling is viable.
- News ingestion uses `node-cron` running **inside the same process as the API server**. Same problem: if you ever run 2+ API instances, you get N duplicate ingestion runs instead of 1. This should move to a separate worker process or a BullMQ repeatable job (you already have the infrastructure for the latter).

### Security — Critical Finding
- **`fraudDetectionMiddleware` is mounted globally in `index.ts` *before* the routers that run `authenticate`.** Since `authenticate` is applied per-route (inside `routes/admin.ts`, `routes/users.ts`, etc.), `req.user` does not exist yet when `fraudDetectionMiddleware` executes for *any* request, on *any* route. That means `userId = req.user?.id` is always `undefined` at that point in the chain, so:
  - the multi-account-per-IP detection (`ipToUsers`),
  - the shadow-ban auto-trigger,
  - and the per-user 150-req/min auto-tapper detection
  …**never actually fire for any authenticated user, ever**, in the current wiring. The middleware only ever falls back to IP-based counting. This is a real, evidence-based bug, not a style nit — the fraud system's most important checks are currently dead code in practice. *(Confidence: high — confirmed by reading the exact middleware registration order in `src/index.ts`.)*

- **Reward farming exposure in `reportWatchTime`:** the endpoint trusts client-supplied `watchSeconds` with no server-side cap, no cross-check against the actual duration of the video, and no per-(user, video) idempotency. In `ledgerService.addLedgerEntry`, the call from the watch-completion job passes `sessionId: undefined`, so the idempotency key falls back to a fresh random UUID every time — meaning the system does **not** prevent the same user from calling `POST /shorts/watch` repeatedly with an inflated `watchSeconds` for the same `videoId` to mint unlimited coins. The global rate limiter (1000 req/15min) and the (currently non-functional, see above) per-user fraud counter are the only things standing in the way today.

- **CORS is wide open with credentials:** `cors({ origin: true, credentials: true })` reflects whatever `Origin` header the caller sends and allows credentials. This is one of the more common real-world CORS misconfigurations — it effectively disables the same-origin protection CORS is meant to provide. This should be replaced with an explicit allow-list (your admin panel domain + your app's API origin), especially since admin auth lives in `localStorage` and is sent as a Bearer token (not cookies, so the practical CSRF risk is lower here, but the open CORS policy is still worth tightening).

- **Hardcoded fallback secrets:** `process.env.JWT_SECRET || 'supersecret'` and `process.env.API_CLIENT_SECRET || 'default_secret'` — if either env var is ever missing in a deployment (a misconfigured container, a forgotten `.env` in a new environment), the app **silently** falls back to a publicly-guessable secret instead of failing to start. This should fail fast at boot instead.

### Reliability
- Logging (Winston + daily rotation) and metrics (Prometheus bundle) are properly wired — better observability than most projects at this stage.
- No retry/backoff visible around the YouTube Data API v3 call (`youtubeService.fetchTrendingShorts`) or the RSS parser calls beyond a single try/catch — a transient YouTube/RSS outage just returns an empty array/skips a sync rather than retrying.

---

## 4. Full-Stack Integration Review

- Auth flow is consistent end-to-end: Google ID token → backend verification (Firebase Admin, with a Google `OAuth2Client` fallback) → JWT → stored client-side (Zustand store in the app, `localStorage` in the admin panel) → attached via Axios interceptors on both clients. This is solid and was clearly built carefully.
- Admin role-gating is correctly enforced **server-side** (`authorizeAdmin` checks `req.user.role` on every `/api/admin/*` route) — the admin panel's client-side role check on login is just a UX nicety, not the actual security boundary, which is the right way to do it.
- Cache invalidation is manually wired (`invalidateCache('/api/shorts')` called from the YouTube-pool admin endpoints) — this works today but is a maintenance trap: every new endpoint that mutates `/api/shorts`-related data has to remember to call this by hand, or the cache silently serves stale data for up to 120 seconds.

---

## 5. The Missing Feature: Automated YouTube Shorts Ingestion (your suspicion is correct)

You were right — this feature **does not exist**. Here's exactly what's there today vs. what a fully admin-controlled pipeline (matching the pattern you already built for News/RSS) would need.

### What exists today
| Capability | News/RSS (built) | YouTube Shorts (built) |
|---|---|---|
| Admin defines a *source* | Yes — `RssSource` (name, URL, category, priority, refresh interval) | **No** — there is no "YouTube source/search query" concept at all |
| Category tagging | Yes — `Category` model, linked to both `RssSource` and `NewsArticle` | **No** — `YoutubeVideoPool` has no `categoryId` field |
| Admin controls *how many* to fetch | Implicit (whole feed per sync) | **No control exists at all** |
| Search / keyword targeting | N/A (RSS sources are fixed feeds) | **No** — the only YouTube API v3 call in the codebase (`youtubeService.fetchTrendingShorts`) uses a single hardcoded query, `q: '#shorts'`, and a hardcoded `maxResults: 10` |
| Automated, repeatable sync | Yes — `node-cron` + `newsIngestionService.syncSingleSource`, with `FeedSyncLog` tracking | **No** — `fetchTrendingShorts()` is only ever called *live*, as a fallback inside `GET /api/shorts` when the manually-curated pool runs low. Results are **never written to the database** |
| Admin add-to-database UI | Full CRUD: add/edit/delete sources, trigger sync, view sync logs (`Content.tsx`, `getNewsDashboard`, `getFeedSyncLogs`) | **One video at a time, by hand.** `Content.tsx`'s "YouTube Pool" section only has an "Add Video" modal that takes a single pasted video ID or URL (`handleAddYoutube`) and calls `uploadYoutubePool([vid])` |
| Dedup / sync history | Yes — `FeedSyncLog` per source | **No equivalent exists for YouTube** |

### In plain terms
Right now, growing the Shorts pool means an admin manually pasting one YouTube link at a time into a form, over and over. There is no way today for an admin to say "search YouTube for `#fitness shorts`, tag everything as the **Fitness** category, and pull in 50 of them" and have the system go fetch, dedupe, and store them. The only place the real YouTube Data API v3 is touched is a silent runtime fallback that fills feed gaps on the fly and forgets the results the moment the request ends — it's not a content pipeline, it's a patch.

This is a real gap relative to the rest of the product, because **you've already built the correct pattern once** (News/RSS) and just haven't extended it to Shorts yet. That makes this a fast, low-risk feature to add — it's not new architecture, it's applying an existing, working pattern to a second content type.

### What "done" looks like (plain description, no implementation)
1. **Admin panel:** a YouTube ingestion screen where staff can type a search keyword/phrase (e.g. "motivational shorts", "comedy shorts india"), pick or create a Category, set "how many videos to fetch" (a number, e.g. 25), and hit a button — "Fetch & Add to Pool."
2. **Backend:** a new endpoint that takes that keyword, category, and count; calls the YouTube Data API v3 `search` endpoint with `type=video`, `videoDuration=short`, the keyword as `q`, and the requested result count (paginating with `pageToken` if more than 50 are requested, since YouTube caps a single page at 50); filters out videos already in the pool (dedup by `videoId`); and writes the new ones into the database tagged with that category and a record of which search produced them.
3. **Visibility:** a log of past fetch runs (keyword used, category, how many requested vs. how many actually added vs. duplicates skipped), so the admin can see what's been pulled in over time — mirroring the `FeedSyncLog` pattern you already have for news.
4. **Everything stays admin-controlled:** no automatic background fetching unless you explicitly want a recurring "auto top-up" toggle later (e.g. "every day, fetch 10 new videos for category X") — that can be a phase-2 add-on once the manual search-and-fetch flow is proven out.

A ready-to-use, plain-language prompt for an AI coding agent to build exactly this is provided in **Section 11** below.

---

## 6. Technical Debt Assessment

| Area | Severity | Impact | Recommendation |
|---|---|---|---|
| Fraud middleware runs before `authenticate`, so `req.user` is always undefined inside it | Critical | Multi-account, shadow-ban, and per-user-rate fraud checks are non-functional in production traffic | Move `fraudDetectionMiddleware` to run after auth resolves `req.user` (e.g., apply it per-router after `authenticate`, or read the user from the JWT directly inside the middleware) |
| No server-side cap/validation on `watchSeconds` in `reportWatchTime`; no real idempotency key | Critical | Coin-farming exploit — a user can mint unlimited coins by replaying the watch-complete call | Cap reward by actual video duration server-side; build an idempotency key from `(userId, videoId, sessionId)` and reject duplicates within a cooldown window |
| YouTube content pipeline is "paste one video ID at a time," with no search/category/count/automation | High (your flagged gap) | Manual, slow, unscalable content operations; can't target categories at all | Build the search-and-fetch admin flow (Section 5/11) mirroring the existing RSS pipeline |
| In-memory `Map`s for rate-limit counters and GET cache | High | Breaks correctness the moment you run more than one backend instance; slow memory leak even on one instance | Move both to Redis (already a dependency via BullMQ) |
| `node-cron` news ingestion runs inside the API process | Medium | Duplicate ingestion runs once you scale to multiple instances | Move to a dedicated worker or a BullMQ repeatable job |
| Open CORS (`origin: true, credentials: true`) | Medium | Disables same-origin protection | Explicit origin allow-list |
| Hardcoded fallback secrets (`'supersecret'`, `'default_secret'`) | Medium | Silent insecure fallback if env vars are misconfigured | Fail fast at boot if required secrets are missing |
| No shared request-validation library; validation is ad hoc per controller | Medium | Inconsistent error messages, easy to forget validation on new endpoints | Adopt Zod (lightweight, TS-native) at the route layer |
| `ShortItem.tsx` at 743 lines | Medium | Hard to maintain/test; large re-render surface | Split into WebView wrapper, reward overlay, gesture layer |
| Dead code: `src/data/shorts.json`, root-level `test.js`/`test2.js`/`scratch.tsx` | Low | Clutter, confuses future contributors (including AI agents) about what's real | Delete or relocate to a clearly-named scratch folder |
| No API versioning (`/api/v1/...`) | Low (for now) | Will hurt once mobile app and admin panel need to diverge | Adopt versioning before the next breaking API change |
| SQLite + BullMQ in the same deployment | High (pre-scale) | SQLite's single-writer model will bottleneck once the queue worker and API are both writing concurrently | Migrate to Postgres before any real load test (schema already anticipates this) |

**Quick wins (hours, not days):** fix the fraud-middleware ordering bug; add a server-side cap on `watchSeconds`; delete dead files; tighten CORS; fail fast on missing secrets.
**Medium-term:** move rate-limit/cache state to Redis; build the YouTube search-and-fetch admin pipeline; split `ShortItem.tsx`.
**Long-term:** Postgres migration; move cron jobs to a dedicated worker; add API versioning; introduce a validation library project-wide.

---

## 7. Security Audit Summary

| Finding | Rating | Mitigation |
|---|---|---|
| Fraud middleware ordering bug (Section 3) | **Critical** | Reorder middleware / read user from JWT inside fraud check |
| Unbounded watch-time reward farming (Section 3) | **Critical** | Server-side duration cap + real idempotency key |
| Open CORS with credentials | High | Explicit allow-list of known frontend origins |
| Hardcoded fallback secrets | High | Required env vars should crash the app on boot if absent |
| In-memory rate limit/cache state | Medium | Move to Redis for correctness under horizontal scaling |
| Admin JWT stored in `localStorage` | Low–Medium | Standard practice for SPA admin tools but XSS-stealable; consider httpOnly cookie + CSRF token if this panel is ever exposed beyond a trusted internal network |
| No retry/backoff on external API calls (YouTube, RSS) | Low | Add basic retry-with-backoff so a transient outage doesn't silently produce empty content |

No SQL injection risk was found — all DB access goes through Prisma's parameterized query builder, no raw SQL was observed. No client-side secret exposure was found in the mobile app or admin panel beyond the expected public Firebase config.

---

## 8. Code Quality Scorecard

| Category | Score (1–10) | Why |
|---|---|---|
| Architecture | 7 | Clean layering, consistent admin-controlled-config pattern across most content types; let down only by the YouTube pipeline not following the same pattern and by cron/cache living in-process |
| Maintainability | 6 | Good naming and file organization overall; a few oversized files (`ShortItem.tsx`, `adminController.ts` at 456 lines) and ad-hoc validation hurt this |
| Scalability | 5 | SQLite + in-process cron + in-memory caches are the three things that will break first under real horizontal scaling; the rest of the design (BullMQ, Redis, Prisma) is scale-ready |
| Security | 5 | Auth design is genuinely solid (server-verified Google tokens, server-side role enforcement); pulled down hard by the dead fraud middleware and the unvalidated reward endpoint, both of which are real, exploitable gaps today |
| Performance | 7 | WebView pooling for the feed is the right architectural call; no major frontend bottlenecks identified; backend caching exists, just not distributed |
| Testability | 4 | No test files were found in any of the three repos; root-level `test.js`/`test2.js` appear to be ad-hoc scratch scripts, not a test suite |
| Readability | 7 | Code is generally clear and well-commented in the schema and services layer |
| Developer Experience | 7 | Good logging, metrics, and a clear ingestion pattern to copy from for new content types — this is genuinely a strength for a solo/AI-assisted builder workflow |
| Documentation | 5 | Schema comments are good; no README beyond the admin panel's default Vite README; no API docs |
| **Overall** | **6/10** | A fast-moving, mostly well-structured solo project with one genuinely dangerous live bug (fraud middleware), one real exploit surface (reward farming), and one clearly identified, low-risk feature gap (YouTube ingestion) that's straightforward to close because the pattern already exists elsewhere in the same codebase |

---

## 9. Refactoring Roadmap

**Phase 1 — Highest ROI (do this week, low risk, low effort)**
- Fix fraud-middleware ordering bug.
- Add server-side watch-time validation + idempotency key.
- Tighten CORS to an explicit allow-list.
- Make missing secrets a hard boot-time failure.
- Delete dead files (`shorts.json`, `test.js`, `test2.js`, `scratch.tsx`).

**Phase 2 — Architectural (next 2–4 weeks)**
- Build the YouTube search-and-fetch admin pipeline (Section 5/11) — mirrors existing RSS pattern, low risk.
- Move rate-limit counters and the GET cache to Redis.
- Split `ShortItem.tsx` into smaller components.
- Add Zod validation at the route layer, starting with money-related endpoints (wallet, withdrawals, ledger).

**Phase 3 — Scalability (before any real user-growth push)**
- Migrate SQLite → Postgres.
- Move `node-cron` ingestion jobs to a dedicated worker or BullMQ repeatable jobs.
- Add basic retry/backoff to YouTube/RSS external calls.

**Phase 4 — Future-proofing**
- API versioning.
- A real automated test suite (currently none exists in any of the three repos).
- Consider splitting the admin panel's `adminController.ts` (456 lines) by domain (users/fraud/content/config) for long-term maintainability.

---

## 10. Senior Engineer Verdict

**Top issues needing attention:**
1. Fraud-detection middleware never actually fires for authenticated users (ordering bug).
2. Reward-farming exposure in `reportWatchTime` (no duration cap, no real idempotency).
3. No admin-controlled YouTube search/fetch pipeline — manual, one-video-at-a-time content ops.
4. SQLite + concurrent BullMQ writers is not a viable production combination at scale.
5. In-memory rate-limit/cache state will break correctness across multiple instances.
6. Open CORS policy.
7. Hardcoded fallback secrets.
8. No automated tests anywhere in the stack.
9. `ShortItem.tsx` and `adminController.ts` are oversized and due for a split.
10. No API versioning — fine today, a liability later.

**Top strengths:**
1. Auth design is genuinely solid (server-verified Google ID tokens via two paths, server-enforced admin roles).
2. The News/RSS ingestion pipeline (`newsIngestionService` + `FeedSyncLog` + `Category`) is a well-designed, fully admin-controlled content pattern — exactly the template the YouTube pipeline should copy.
3. WebView pooling for the Shorts feed shows real engineering judgment about a known RN performance trap.
4. BullMQ-based async reward processing (rather than synchronous DB writes on every watch event) is the right call for write-heavy reward flows.
5. Observability (Winston + Prometheus) is in place earlier than most solo projects bother with.
6. Consistent "admin owns the config" philosophy across most of the schema (`AppConfig`, `Category`, `CatalogItem`, `ABTest`, `Missions`).
7. Ledger design (append-only `CoinLedger` with idempotency keys, balance via aggregation) is the correct pattern for a coin economy — just not yet applied consistently to the Shorts watch event.
8. Clean per-domain file structure on both frontend and backend.
9. Cache-invalidation hooks already exist for content mutation endpoints (just need to be backed by Redis).
10. Fraud scoring, shadow-bans, and risk-score escalation are well-modeled in the schema even though the live-traffic trigger has the ordering bug — the data model itself is sound.

**What would block scaling to 10x users:** SQLite as the datastore, in-memory rate-limiting/caching, and in-process cron jobs are the three concrete blockers — all three assume a single Node process, and 10x users will require more than one.

**What would block scaling the engineering team:** Zero automated tests and ad-hoc, per-controller validation. A second engineer (or a second AI agent working in parallel) joining this codebase today has no test suite to lean on to verify they haven't broken the ledger/reward logic, which is the most dangerous code to break silently.

**If starting today:** Same overall architecture (Express + Prisma + BullMQ + Redis is a good choice for this product), but Postgres from day one instead of SQLite, Redis-backed rate limiting/caching from day one, and the YouTube ingestion pipeline built using the same admin-controlled, search-and-fetch pattern as News from the start rather than the current one-video-at-a-time stopgap.

**Final assessment:** This is a well-architected solo/AI-assisted project with the right instincts in several hard places (WebView pooling, async reward processing, append-only ledger, observability). It's let down by one live correctness bug in the fraud system, one real money-exploit surface in reward reporting, and the YouTube content pipeline not yet being brought up to the same standard as the News pipeline it sits right next to in the same codebase. None of these are architectural rewrites — all three are scoped, fixable gaps.

---

## 11. The Feature Build Prompt

Copy everything in the box below and give it to your AI coding agent (Claude Code, Cursor, etc.) when you're ready to actually build this. It's written in plain language on purpose — no code, no technical jargon — so the agent can plan and implement it against your real codebase.

```
I need you to add a new feature to my app: an admin-controlled system for automatically
finding and adding YouTube Shorts videos to my app's video feed, using the official
YouTube Data API v3.

Right now, my admin panel can only add ONE YouTube video at a time, by pasting in a
single video link. I want to replace/extend that with a proper search-and-fetch system.

Here's exactly what I want, in plain terms:

1. In the admin panel, add a screen (or extend the existing Content page) where I can:
   - Type in a search keyword or phrase (for example: "motivational shorts" or
     "comedy shorts india")
   - Choose a category to tag these videos with (reuse the existing category system
     that's already used for the News section — or let me create a new category on
     the spot if one doesn't exist yet)
   - Type in a number for "how many videos to fetch" (for example: 25 or 50)
   - Click a single button, something like "Search & Add to Library"

2. When I click that button, the system should:
   - Use the official YouTube Data API v3 to search for short-form videos matching my
     keyword
   - Only pull in real YouTube Shorts (short, vertical-style videos), not long videos
   - Fetch the number of videos I asked for (handling YouTube's pagination if I ask
     for more than YouTube returns in a single page)
   - Check the database first and skip any videos that are already in the library, so
     I never get duplicates
   - Save each new video into the database with: its YouTube video ID, its title, the
     category I picked, and a note about which search/keyword brought it in
   - Show me a summary when it's done: how many I asked for, how many were actually
     new and added, and how many were skipped as duplicates

3. I also want a simple history/log screen showing past searches I've run — the
   keyword used, the category, the date, and how many videos were added each time —
   so I can see what's already been pulled in over time. (There's already a similar
   "sync log" pattern used for the News/RSS feature in this codebase — please follow
   that same pattern for consistency.)

4. Everything about this must be fully controlled from the admin panel. Nothing should
   run automatically in the background unless I explicitly build a separate
   "auto-refresh" toggle later — for now, fetching only happens when I click the
   button.

5. Please look at how the existing News/RSS content pipeline already works in this
   codebase (the source management, category linking, and sync-log pattern) and reuse
   that same approach and structure for this YouTube feature, rather than building
   something completely different from scratch. Keep the existing "manual single video
   ID" add option too, as a fallback for adding one specific video by hand if I ever
   need to.

6. Make sure the search and fetch process only happens through the admin's authenticated
   admin-only API routes — regular app users should never be able to trigger a YouTube
   search or add videos themselves.

Please first explore the codebase to confirm how the existing category and content
sync-log systems work, then build this YouTube feature to match that same pattern,
end to end (database, backend API, and admin panel screen).
```

---

*This audit covered architecture, code quality, performance, security, scalability, and the specific missing-feature analysis requested. No source files were modified during this review.*