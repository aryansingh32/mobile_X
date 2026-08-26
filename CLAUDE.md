# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a loose collection of separately-versioned projects checked into one top-level directory (each subproject below has its own `.git`, so treat them as independent codebases, not a single monorepo build). The product they form together is **ReelFlow** — a short-video/"reels" mobile app with a coin-earning, ad-watching reward loop, redeemable for real payouts.

- **`modified2/reel-flow/`** — the actual mobile app (React Native + Expo). This is the primary client. Package name `com.ascend.reelsapp`.
- **`backend/`** — Node/Express + TypeScript API (Prisma ORM, PostgreSQL, Redis, BullMQ). Serves the mobile app and the admin panel.
- **`admin-panel/`** — React + Vite + TypeScript dashboard used by operators to configure the backend at runtime (ad placements, reward rules, feature flags, content strings, etc.).
- **`games/`** — a large vendored collection of standalone HTML5/Phaser arcade games (mostly third-party, e.g. `2048`, `flappybird`, `pacman`), served as static content and surfaced inside the app's Games tab (`reel-flow/src/api/games_metadata.ts` maps a curated subset to in-app cards). Don't attempt to "fix" or refactor individual games — they're bundled play content, not code the team maintains.
- **`awesome-rss-feeds/`** — vendored third-party RSS feed source list used to seed the backend's news ingestion.
- **`animation/`, `vibe-pyramid.html`** — standalone one-off asset/animation generators, unrelated to the app runtime.
- Root-level `.md` / `.txt` files (`audit.md`, `todo.md`, `todo2.md`, `readudit.md`, `uiux.md`, `tos_compliance_audit.md`, `playstore_tos_audit_report.md`, `analysis.md`, etc.) are point-in-time audit/planning documents from prior sessions, not living specs — treat any file structure or "missing feature" claims in them as possibly stale; verify against current code before acting on them.

There is no single root build/test command — always `cd` into the relevant subproject first.

## The core system: remote-controlled config

The defining architectural pattern (see `todo2.md` for the original spec) is that almost nothing about monetization/UI behavior is hardcoded in the app — it's fetched at runtime from the backend and edited via the admin panel:

- Backend models (`backend/prisma/schema.prisma`): `AppConfig`, `AdPlacement`, `AdRewardRule`, `DailyCapPolicy`, `ContentString`, `FeatureFlag`, `ScreenSection` are the source of truth.
- `GET /api/config/remote?version={n}` (see `backend/src/controllers/configController.ts` / `routes/config.ts`) returns a versioned payload of all of the above.
- The app's `RemoteConfigProvider` (`reel-flow/src/providers/RemoteConfigProvider.tsx`) fetches this on mount, on foreground, and every 15 minutes, and merges it into `useConfigStore` (Zustand, persisted to AsyncStorage). It never blocks rendering — on failure it falls back to cached/bundled defaults (`reel-flow/src/store/defaultConfig.ts`).
- Admin panel pages (`AdPlacements.tsx`, `AdRewardRules.tsx`, `DailyCapPolicies.tsx`, `FeatureFlags.tsx`, `ScreenLayout.tsx`, `Config.tsx`, `EnvConfig.tsx`) write to these tables.
- When adding a new ad slot, reward type, or toggle, prefer wiring it through this config system (backend model → admin CRUD page → remote config payload → app store) rather than hardcoding it in the client.

## Backend (`backend/`)

**Commands** (run from `backend/`):
```
npm run dev              # ts-node + nodemon dev server (src/index.ts)
npm run build             # prisma generate + tsc -> dist/
npm start                 # prisma migrate deploy + node dist/index.js (production)
npm run prisma:migrate    # create/apply a dev migration
npm run prisma:push       # push schema without a migration (prototyping)
npm run prisma:generate   # regenerate Prisma client after schema changes
npm run seed:ad-config    # seed AdPlacement/AdRewardRule/etc via src/scripts/seedAdConfig.ts
```
No test suite or lint script is configured in `package.json`.

Local infra: `docker-compose.yml` brings up Redis, Postgres, Prometheus, and Grafana (Postgres db name `mobile_x_db`). Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `JWT_SECRET`, `API_CLIENT_SECRET`, Firebase service-account JSON, and Redis host/port before running `dev`. Production requires `JWT_SECRET`/`API_CLIENT_SECRET` to be set or boot fails (`src/index.ts`).

Architecture: standard Express layering — `routes/` → `controllers/` → `services/` (business logic: `fraudService`, `ledgerService`, `rssService`, `youtubeService`, `newsIngestionService`, `queueService` for BullMQ workers) → Prisma. Cross-cutting middleware in `middlewares/` is applied globally in `src/index.ts` in a specific order: `helmet` → `hpp` → rate limiting (`globalLimiter`) → `fraudDetectionMiddleware` → per-route `verifyApiSignature` (HMAC request signing, skipped only for `/api/webhooks/*`, `/api/rewards/ssv`, `/api/health`). If you add a new route, decide deliberately whether it needs to bypass signature verification (webhook/SSV callbacks) or not.

Key domains: wallet/coin ledger (`CoinLedger`, `walletController`), fraud detection (`FraudIncident`, `DeviceFingerprint`, `fraudMiddleware`/`fraudService`), rewards & offerwall/SSV callbacks (`rewardsController`, `routes/offerwall.ts`), referrals, missions/badges, short-video/YouTube content ingestion (`shortsController`, `YoutubeVideoPool`, `newsIngestionService`, RSS-based `NewsArticle`/`RssSource`), and the remote-config tables described above. Metrics are exposed via `express-prom-bundle` (Prometheus/Grafana wired in docker-compose).

## Mobile app (`modified2/reel-flow/`)

**Commands** (run from `modified2/reel-flow/`):
```
npm start      # expo start
npm run android
npm run ios
npm run web
```
React Native 0.81 + Expo SDK 54, React 19, TypeScript, no test suite configured. `AGENTS.md` in this directory flags that Expo has changed significantly — check `https://docs.expo.dev/versions/v54.0.0/` before writing Expo-specific code rather than relying on older training data.

Structure: `src/screens/` (one file per screen, no nested router — see `App.tsx` for the navigation/state-machine wiring), `src/api/` (one file per backend resource, all going through the shared `src/api/client.ts` axios instance), `src/store/` (Zustand: `useAppStore` for session/auth, `useConfigStore` for remote config), `src/hooks/` (`useFeatureFlag`, `useAdPlacement`, `useAdUnitId`, `useTelemetry` — the app-side consumers of remote config), `src/components/ads/` (ad unit wrappers around `react-native-google-mobile-ads`, with `src/mocks/react-native-google-mobile-ads.tsx` used on platforms/builds without native ad modules), `src/utils/adFarmingGuard.ts` and `deviceSafety.ts` (anti-fraud client-side checks, mirrored by backend fraud middleware — treat both sides as needing to stay consistent).

**Every outgoing API request is HMAC-signed** (`src/api/client.ts`): body is key-sorted, concatenated with a timestamp+nonce, and signed with `EXPO_PUBLIC_API_CLIENT_SECRET` using HMAC-SHA256, sent as `x-api-signature`/`x-api-timestamp`/`x-api-nonce`. This must match `backend/src/middlewares/signatureMiddleware.ts`'s verification exactly — if you change the signing scheme on one side, update the other.

Monetization is via Google AdMob (`react-native-google-mobile-ads`), configured in `app.json` under the `react-native-google-mobile-ads` plugin (separate Android/iOS app IDs) and per-placement ad unit IDs come from the remote config (`adUnits` in `RemoteConfigPayload`), not hardcoded.

## Admin panel (`admin-panel/`)

**Commands** (run from `admin-panel/`):
```
npm run dev       # vite dev server
npm run build      # tsc -b && vite build
npm run lint       # eslint .
npm run preview    # preview production build
```
React 18 + Vite + TypeScript + Tailwind v4. `src/services/api.ts` is the single axios instance (bearer token from `localStorage.adminToken`, auto-reloads on 401). `src/pages/` is a flat list of one file per admin section — most pages map 1:1 to a Prisma model/admin route in the backend (e.g. `AdPlacements.tsx` ↔ `AdPlacement` model ↔ `remoteConfigAdminController.ts`). When adding a new configurable feature, the pattern is: Prisma model → backend admin controller/route → admin-panel page → exposed in the mobile app's remote config payload.

## Cross-cutting notes

- Env vars matter a lot here: mobile app uses `EXPO_PUBLIC_*` vars (`.env` in `reel-flow/`), backend uses a plain `.env` (see `.env.example`), admin panel uses `VITE_*` vars. Never commit real secrets — `.gitignore` already excludes `.env*` (except `.env.example`) and Firebase service-account JSON.
- Backend deploys to Railway (`backend/railway.json`, `.railwayignore`); the `use-railway` skill and Railway MCP tools are available in this environment for that.
- The `games/` static site is unrelated to the Express/Prisma backend's request-signing and auth — don't assume its routes go through `verifyApiSignature`.
