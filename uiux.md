# Reel Flow — UI/UX & Page-Connectivity Audit
**Scope:** Every screen in the mobile app (`reel-flow`) and every page in the admin panel, what each one does, how they connect to each other and to the backend, and what's missing.
**Method:** Read every screen/component/page file directly. Where a button or tab calls an API, I traced that call into the actual backend controller to confirm it's real and not just wired to a stub.

This report is organized in two parts (Mobile App, Admin Panel), followed by a cross-cutting section that's the most important part of this report: **a recurring pattern of screens that look fully built but are silently disconnected from the real backend.**

---

## Headline Finding (read this first)

Across both the app and the admin panel, the single biggest UI/UX problem isn't visual — it's **wiring**. Over a dozen buttons, tabs, and form fields in this product are pixel-perfect and fully styled, but either call nothing, call the wrong field name, or call an endpoint the backend doesn't actually support the way the UI implies. The most serious instance: **the entire "earn coins" loop in the mobile app never talks to the server.**

```
ShortItem.tsx, line 209 (the function that fires when a user finishes watching a short):

  updateBalance(data.coins);
  // Real app would POST /api/shorts/reward here
```

That comment is in the shipped code. `updateBalance()` only changes a number stored locally on the phone (Zustand + AsyncStorage) — it never calls the backend. The same is true for both rewarded-ad payouts (+50 / +100 coins) in the Shorts feed and the Discover feed. So today:
- A user watches videos and ads, sees their coin balance climb, closes and reopens the app — the number is still there (it's saved locally), but it has **never once been written to the server's `CoinLedger`.**
- The Home screen does call `getProfile()` (the real server balance) on load, but **never uses what it gets back** — the result is fetched and discarded, so the real balance never overwrites or corrects the local one.
- Meanwhile, on the Wallet screen, the **Redeem button has no `onPress` handler at all** — even when a user can afford an item, tapping Redeem does nothing. The withdrawal API (`requestWithdrawal`) exists, fully written, in `api/wallet.ts` — it's just never called from any screen.

Put together: a user can currently "earn" any amount of coins they want by sitting and watching shorts, and there is **no working path, anywhere in the shipped UI, for that number to become real money or even reach the real ledger.** This is the most important fix in the entire app, ahead of any visual polish.

The rest of this report documents this same pattern — UI fully built, wiring missing or wrong — page by page, plus a separate list of features that are missing outright (no UI built at all).

---

# PART 1 — Mobile App (`reel-flow`)

## Navigation structure
Five-tab bottom nav (Home, Discover, Hot/Shorts, Earn/Rewards, Wallet), custom-built with a floating pill and animated circle indicator — no off-the-shelf navigation library. There's no stack/back-navigation anywhere in the app: every "screen" is really one of five flat tabs swapped via `useState`, plus two full-screen modals (the Discover article detail, and the first-time tooltip). This is fine at the current scope but means there's no deep linking, no Android hardware-back handling beyond the OS default, and no way to add a second-level screen (e.g., "Settings" or "Order History") without restructuring navigation first.

There is **no splash screen** — while the auth token is rehydrating from storage, the app renders nothing (`return null`) for a beat before showing either the login screen or the main app.

## Screen 1 — Auth (`AuthScreen.tsx`)
**Purpose:** Google Sign-In gate. Nothing else in the app is reachable until this succeeds.
**What's on it:** Logo placeholder, tagline ("Watch. Read. Earn."), one "Sign in with Google" button.
**Flow:** Google Sign-In SDK → ID token → `loginWithGoogle()` → backend verifies via Firebase/Google → JWT + user returned → stored in Zustand/AsyncStorage → app switches to the 5-tab main view. If the user arrived via a referral link, a pending referral code stored in AsyncStorage is applied right after login.
**Connected & working:** Yes — this is one of the most solid flows in the app end-to-end.
**Issues:**
- The button shows no loading state while sign-in is in progress — a user can tap it repeatedly while waiting.
- No Terms of Service / Privacy Policy link on the gate screen — typically expected (and often required by app stores) for an app that pays out real money.
- No "what is this app" explainer screens before the login wall — a brand-new user sees the tagline and a sign-in button with nothing else.
- A `console.log` of the Google Client ID is left in the code (not a secret, but unnecessary noise in production logs).

## Screen 2 — Home (`HomeScreen.tsx`)
**Purpose:** The dashboard / hub — balance, streak, daily missions, shortcuts to the other tabs.
**What's on it:** Header (avatar initial, name, level badge, coin balance, streak, XP bar) → pull-to-refresh scroll body → "Current Balance" summary card with a daily-progress bar → horizontal shortcut strip (Watch Shorts / Read News / Tasks, each jumps to another tab) → "Today's Missions" list with progress bars → a "Top Earners This Week" leaderboard teaser → an "Invite & Earn" referral banner.
**Connected & working:** Pull-to-refresh, the shortcut strip's tab-jumping, and the missions list (real data from `getDailyMissions`) all work.
**Issues:**
- `getProfile()` is called on load and its result is thrown away — see Headline Finding above. The balance shown comes entirely from local state, never reconciled with the server.
- The **leaderboard teaser has no `onPress` handler at all** — it's a dead tap target. It also shows a hardcoded fake rank ("You are rank #4,201") — there is no leaderboard feature or backend endpoint anywhere in this product. This entire card is decoration.
- "Resets in 14h" next to Today's Missions is a hardcoded string, not a real countdown to midnight.
- No error state if `loadData()` fails — only a `console.error`; the user just sees a screen with no missions and no explanation.
- No empty-state message if the missions list comes back empty.

## Screen 3 — Discover (`DiscoverScreen.tsx` / `DiscoverCard.tsx` / `DiscoverDetail.tsx`)
**Purpose:** A vertically-snapping news feed (RSS-sourced articles) with rewarded-ad cards mixed in, opening into a full-screen article detail view.
**What's on it:** Header with title + a heart/favorites icon → snapping vertical card feed (image, title, source, time-ago) → tap a card to open a full-screen detail (hero image, title, description, source pill, "Read Full Article" → opens the real source URL in the device browser) → ad cards every 3–6 items that launch a rewarded video ad.
**Connected & working:** Article fetching/pagination/dedup, opening the real source article via `Linking.openURL`, and the rewarded-ad flow (real AdMob SDK, real ad units) all work as built.
**Issues:**
- **The "5🪙 per card" reward advertised on the Home screen shortcut and in the first-time tooltip is not implemented anywhere in this screen.** There's no call to the backend's news-read endpoint at all — `api/news.ts` doesn't even export a function for it, despite the backend having a working `POST /api/news/read` route. Reading news currently earns nothing.
- The header's heart/favorites icon has no `onPress` handler — there is no "Saved" or "Favorites" feature anywhere in the app; this icon implies one exists.
- The detail screen's "Headphones" icon (implying a listen/read-aloud feature) and "More options" (⋮) icon both have no handler — pure decoration.
- The detail screen's "Share" icon doesn't actually open the native share sheet — it just re-opens the source URL, duplicating the nearby "Read Full Article" action under a different icon.
- Rewarded-ad coins here are local-only, same issue as the Headline Finding.
- `alert(...)` (the bare JS global, not `Alert.alert` from React Native) is used for the daily-ad-limit and ad-abort messages — this is the wrong API for React Native and may not reliably show anything to the user on-device.

## Screen 4 — Hot / Shorts Feed (`ShortsFeed.tsx` / `ShortItem.tsx`)
**Purpose:** The core, TikTok-style vertical video feed — the app's namesake feature.
**What's on it:** Full-screen YouTube Shorts in a swipeable `FlatList`, like/comment/share action rail on the right, tap-to-pause / double-tap-to-like gestures, a coin-toast animation on watch completion, and two special injected card types: a "Short break" interstitial-ad trigger and an opt-in "Watch Ad to Earn" card.
**Connected & working:** Video playback (via a pooled-WebView + YouTube IFrame API approach — a genuinely good technical choice for this kind of feed), swipe/pagination/infinite scroll, double-tap-to-like animation, and the real AdMob rewarded/interstitial ad flow.
**Issues:**
- The coin reward for watching (the entire point of this tab) is local-only — see Headline Finding.
- Like, Comment, and Share on the action rail are cosmetic only: liking just toggles local state with an animation (resets every feed reload, not persisted anywhere); Comment's `onPress` does nothing but stop the tap from propagating; Share does nothing at all. There's no comments feature anywhere in the backend, so this is expected for an MVP, but as built these three buttons currently mislead the user into thinking there's a social layer that doesn't exist.
- Author info row (username/avatar/caption/sound), normally standard for this style of feed, is fully built but hidden behind a `SHOW_AUTHOR_INFO = false` flag — currently off everywhere.
- The like/comment counts shown are random numbers generated client-side per video on each fetch (`Math.floor(Math.random() * 10000)`), not real engagement data.
- Placeholder AdMob unit IDs (`ca-app-pub-xxxxxxxxxxxxx/...`) are still in the code — fine for now, but must be swapped for real ad unit IDs before this can earn real revenue.

## Screen 5 — Rewards / Earn (`RewardsScreen.tsx`)
**Purpose:** Offerwall tasks, daily missions (duplicated tab), and the referral program — three sub-tabs.
**What's on it:** Coin balance badge in the header, a 3-tab switcher (Tasks / Daily / Referrals).
- **Tasks tab:** A "Preview mode" banner, then a list of demo offerwall tasks with a reward badge and a "Start" button.
- **Daily tab:** A single line of placeholder text — "Daily missions appear here."
- **Referrals tab:** Referral code with copy/share buttons, stats (friends referred, coins earned), and a tier-progress callout.
**Connected & working:** The Referrals tab is fully wired (real stats, real copy-to-clipboard, real native share sheet). Loading the task list is real (calls the actual offerwall endpoint).
**Issues:**
- **The "Start" button on every task has no `onPress` handler.** The backend has a working `completeTask` endpoint and the frontend even has a ready-to-use API function for it (`completeTask` in `api/offerwall.ts`) — it's just never called. A user can see tasks and their rewards but cannot actually complete a single one from this screen.
- **The Daily tab is an unimplemented stub**, even though the Home screen already has a working, separately-built missions feature. Right now the app effectively has missions in two places: a real one on Home, and an empty placeholder here — confusing for anyone discovering this tab first.
- The referral code shows the fallback text `'LOADNG'` (typo — missing an "I") while the real code is loading.
- Copy-to-clipboard has no confirmation toast — the code comment literally says "show toast ideally," meaning a user gets no feedback that the copy succeeded.

## Screen 6 — Wallet (`WalletScreen.tsx`)
**Purpose:** Where coins are supposed to become real rewards — catalog browsing, withdrawal history, and a "suggest a reward" feedback box. Three sub-tabs.
**What's on it:**
- **Catalog tab:** A grid of redeemable items (UPI cash, vouchers) with cost, INR value, and a "Redeem" button that disables itself if the user can't afford the item.
- **History tab:** A single placeholder line — "History entries appear here."
- **Suggest tab:** A text box to suggest a new reward, with a list of the user's past suggestions and their status.
**Connected & working:** Catalog browsing and the "can't afford it" disabled state both work; suggestion submission and listing both work.
**Issues:**
- **The Redeem button has no `onPress` handler at all — even when the user can afford the item.** This is, alongside the watch-reward issue, the most important broken connection in the app: the screen whose entire purpose is "turn coins into money" cannot actually do that. The backend's `requestWithdrawal` function is fully written in `api/wallet.ts` and never called.
- **The History tab is an unimplemented stub**, despite a working `getHistory` API function already existing in `api/wallet.ts` and a real backend endpoint (`GET /api/wallet/history`) behind it. It would take very little to wire this up — the code to call it is already written, it's just not used.

## Cross-cutting / missing from the mobile app
- **No Settings/Profile/Account screen anywhere.** There is no logout button in the entire app — the only way `logout()` is ever triggered is automatically, by the Axios interceptor, when the server returns a 401. A user cannot voluntarily sign out, switch Google accounts, view their email, delete their account, or find a Terms of Service / Privacy Policy link from inside the app.
- **No notification inbox.** The backend has a full `Notification` model and an admin "send push" feature, and the app registers an FCM token — but there's no in-app screen to view past notifications; users only ever see them as OS push notifications.
- **No onboarding beyond a single first-visit tooltip per tab.** There's no walkthrough, no permissions-priming screen before the OS tracking-permission prompt fires, and no explanation of how withdrawals/KYC will work before a user starts earning.
- **No visible loading/error/empty handling standard across screens** — some screens (Home, Rewards, Wallet) show shimmer skeletons while loading, which is good, but none of them show a retry button or distinct error message if the network call fails; everything silently falls back to an empty list.

---

# PART 2 — Admin Panel (22 routes + login)

## Navigation structure
A persistent left sidebar (React Router, `react-router-dom`) grouped into five labeled sections — **Core**, **Economy & Revenue**, **Growth & Engagement**, **Content & News**, **Security & System** — plus a fixed footer showing the logged-in admin's email and a Sign Out button. Login is Google OAuth, gated client-side by role (the real enforcement is correctly server-side). Any unmatched URL falls through to a generic "Module Under Construction" page, which is a nice touch for a panel still being built out.

## Core section

**Dashboard (`/`)** — 4 KPI cards (Total Users, Active Users 24h, Total Withdrawn, Circulating Coins) and a "Quick Actions" text block. Functional, but thin for something labeled "Executive Dashboard" — no charts, no trends, no date range. The Quick Actions text hardcodes `localhost:3000` as the Grafana link, which will be a dead/wrong link the moment this panel is deployed anywhere other than the same machine running Grafana.

**User Intelligence (`/users`)** — One of the best-built pages in the panel: a master-detail layout (searchable user list on the left, deep profile on the right) showing balance, trust score, country, last active, device fingerprint history (flags emulators/rooted devices), and a referral tree. Ban and Shadowban actions are both real and wired correctly.
- Issue: search only filters the 100 users already loaded into memory — the code comment admits "In a real app, this would hit a search endpoint." Once the user base passes 100, or a searched-for user isn't in that first page, search silently finds nothing (no "not found" message either).
- Issue: there's no manual "adjust balance" control on this screen, even though the backend has a working endpoint for it (`adjustUserBalance`) that's exported from the API layer but called from nowhere in the entire admin UI.

**Live Tracking (`/live`)** — Real-time table of currently-online users (auto-refreshes every 5s) with their current in-app screen, sourced from the app's real `trackActivity` heartbeat. Clean, functional, no issues found.

## Economy & Revenue section

**Revenue Analytics (`/analytics`)** — Three KPI cards (ad revenue, outstanding coin liability, total withdrawn) plus a 7-day bar chart. Functional as built; the chart silently renders as a flat empty bar set if the backend doesn't supply `chartData`, with no "no data yet" message.

**Economy Control (`/config`)** — A raw key/value editor for tunable settings like reward-per-watch and minimum-watch-seconds (these are the exact knobs `rewardsController` reads at runtime). It works, but the UX is rough for something this important: adding a new key uses a native browser `prompt()` dialog, there's no list of what keys actually exist/do, no value-type validation (everything is a free-text string), and no grouping — an admin needs to already know the exact key name to find and change it.

**Withdrawals (`/withdrawals`)** — Approve/Reject queue for payout requests. Approve/Reject buttons are real and wired correctly. **However, the table's "UPI ID" column references a field (`w.upiId`) that doesn't exist on the data the backend actually returns — the real field is `destinationId`. This means the column showing where the money should actually be sent is always blank.** On the single most safety-critical screen in the whole panel (approving real money payouts), the admin currently cannot see the payout destination in this table.

**Catalog (`/catalog`)** — Full CRUD for redeemable items (vouchers, UPI cash) with a modal form. Functional. One real bug: the INR value shown to users is auto-calculated from the coin price using a hardcoded ÷100 ratio, with the code literally commented `// naive conversion` — there's no separate field to set or override the real INR value, so every item created here gets whatever rupee value that fixed ratio produces, whether or not it's the actual exchange rate the business uses.

## Growth & Engagement section

**Retention Lab (`/retention`)** — D1/D7/D30 retention KPI cards plus country and acquisition-source breakdowns. Clean, functional, no issues found (assuming the backend numbers are accurate).

**A/B Testing (`/ab-testing`)** — List + create-experiment modal. Functional, but variants are entered as raw JSON text (e.g. `["A","B"]`) rather than an add/remove variant UI — usable, but unnecessarily technical for a panel meant to be operated without writing code.

**Notification Center (`/notifications`)** — The most visually polished page in the panel: a live phone-mockup preview that updates as you type, and a cohort-targeting dropdown (All Users / Inactive 3+ days / Inactive 7+ days / Level 5+ / Balance > 50,000). **This is also the single biggest functionality gap in the admin panel: the backend's `sendNotification` only knows how to handle the literal string `'ALL'` or a single numeric user ID — it has no cohort-segmentation logic at all. Every option in this dropdown except a future exact match on `'ALL'` will fail (`parseInt('INACTIVE_3_DAYS')` is not a number), and the dropdown doesn't even send `'ALL'` for its own "All Users" option — it sends `'ALL_USERS'`.** As shipped, sending a notification from this screen, with any option selected, will not reach the intended audience.

**Mission Builder (`/missions`)** — Full CRUD for daily/one-time missions (title, target count, XP/coin reward, type). Functional, no issues found — this is the real backend behind the Home screen's mission list.

**Referral Tree (`/referrals`)** — Stats cards plus an ASCII-style referral tree view, with a "Load Full Hierarchy" button. The button is decorative: it calls the exact same API request as the initial load (the code comment admits "we might pass a query param like `?full=true`" — but never actually does), and just relabels the heading from "(Preview)" to "(Full)." No additional data is ever fetched.

## Content & News section

**News Dashboard (`/news-dashboard`)** — This is the best-built content page in the panel, and the template every other content type should be following: KPI cards (total articles, active sources, categories) plus a real sync-log table with a working "Sync All Sources" button. One small accuracy issue: a `PARTIAL` sync (some articles added, some images failed) is visually lumped in with full failures, both shown as a red "Failed" badge, which could make a mostly-successful sync look like it broke.

**Articles (`/articles`)** — Searchable, paginated article browser with inline edit/delete. Looks complete, but has two real bugs: (1) **the search box is fully built with a 500ms debounce, but the backend endpoint behind it ignores the search parameter entirely** — typing into it changes nothing about the results shown. (2) **The "View Source" link points at a field (`article.url`) that doesn't exist on the actual data — the real field is `sourceUrl`** — so every "View Source" link on this page is dead. There's also a status badge checking for `article.status === 'PUBLISHED'`, but no `status` field exists on the article model at all (the real flags are `isFeatured` / `isHidden` / `isPinned`), so every article permanently shows the same "pending" yellow badge regardless of its actual state.

**Categories (`/categories`)** — Full CRUD for the category system used by News (and, as covered in the prior audit, *not* currently used by the YouTube Shorts pool — see that report for the missing-feature analysis). Functional, no issues found on this page itself.

**RSS Sources (`/content`)** — Manages RSS feed sources (full CRUD, sync triggers) and, in the same page, the YouTube video pool. The RSS half is solid and complete. The YouTube half is the page where the previously-reported missing feature lives: the only control here is a single "Add Video" modal that takes one pasted video ID or URL at a time — no search, no category tagging, no "how many to fetch" count.

**User Suggestions (`/suggestions`)** — This page has the most broken data display in the entire panel. It shows columns for "Type" (color-coded Bug/Feature/Other) and "Feedback" — but **neither field exists on the actual data.** The real model only has `message` and `status`; there's no `type` field at all, and the actual feedback text lives in a field called `message`, not `content`. The practical result: **admins viewing this page cannot see what users actually wrote** — the "Feedback" column is always blank. Delete is honestly stubbed (`alert('Deletion not supported yet.')`) rather than silently failing, which is at least transparent.

## Security & System section

**Fraud Center (`/fraud`)** — Well-built table with working Resolve and Ban actions. The catch: per the earlier backend audit, three of the four fraud-detection triggers live inside a middleware that never actually receives a logged-in user's ID due to a middleware-ordering bug, so in real traffic this page will almost always show "No fraud logs detected" — not because fraud isn't happening, but because the detection feeding this screen is currently dead code upstream. The page itself is fine; what feeds it isn't.

**Security Ops / Audit Log (`/security`)** — Clean, color-coded audit trail of admin actions (balance adjustments, withdrawals processed, env changes flagged in red). No issues found.

**Env Manager (`/env`)** — A raw textarea that directly overwrites the live backend's `.env` file (database connection string, JWT secret, API keys, etc.) over the network, gated only by a single browser "are you sure" confirm dialog. This is functional, but it's worth flagging as a standout risk from a pure UI/UX-safety standpoint: there's no diff view, no version history, no rollback, no syntax checking, and apparently no masking of secret values — anyone with access to this single page can see and overwrite every production secret the backend has, with one typo away from total downtime and no undo.

**Server Monitoring (`/monitoring`)** — An iframe pointed at `http://localhost:3000`. Like the Dashboard's Grafana link, **this will not work at all once the admin panel is deployed anywhere other than the same machine running Grafana** — it's not a dev convenience that needs cleanup later, it's a feature that's currently broken for anyone using a deployed version of this panel.

**System Logs (`/logs`)** — Live-tailing Winston log viewer, auto-refreshing every 5 seconds. Functional. No level filter, search box, or pause control, so it will get noisy quickly once there's real traffic.

---

# Summary: "Looks done, isn't wired" — full list

| Screen | What looks built | What's actually missing/broken |
|---|---|---|
| Shorts feed (app) | Coin toast on watch completion | Never calls the server — local balance only |
| Shorts feed (app) | Rewarded ad (+50/+100 coins) | Same — local balance only |
| Discover feed (app) | Rewarded ad (+50 coins) | Same — local balance only |
| Discover feed (app) | "5🪙 per card" advertised on Home + tooltip | No reward call exists anywhere for reading news |
| Wallet → Catalog (app) | "Redeem" button, fully styled, disables if unaffordable | No `onPress` handler — does nothing |
| Wallet → History (app) | Tab exists | Stub text only; working API call exists but is unused |
| Rewards → Tasks (app) | "Start" button on every task | No `onPress` handler — `completeTask` API exists but unused |
| Rewards → Daily (app) | Tab exists | Stub text only; duplicates Home's real missions feature |
| Home → Leaderboard (app) | Card with rank shown | No `onPress`, no backend, hardcoded fake rank |
| Discover header → heart icon (app) | Icon with a "+" badge | No `onPress` — implies a Favorites feature that doesn't exist |
| Withdrawals table (admin) | "UPI ID" column | References a field that doesn't exist (`upiId` vs. real `destinationId`) — always blank |
| Articles search (admin) | Debounced search box | Backend ignores the search parameter entirely |
| Articles "View Source" (admin) | Link | References a field that doesn't exist (`url` vs. real `sourceUrl`) — always dead |
| Articles status badge (admin) | PUBLISHED/pending coloring | No `status` field exists on the model — always shows the same badge |
| Suggestions "Type" + "Feedback" columns (admin) | Color-coded type, feedback text | Neither field exists (`type`, `content` vs. real `message`) — feedback text is always blank |
| Referral Tree "Load Full Hierarchy" (admin) | Button that should fetch deeper data | Fetches the exact same data; only the label changes |
| Notification cohort targeting (admin) | 5-option dropdown with live preview | Backend only understands `'ALL'` or one numeric ID — every dropdown option as currently wired will fail to reach its audience |
| Dashboard / Monitoring Grafana links (admin) | "Check your Grafana dashboard" | Hardcoded `localhost:3000` — dead link on any real deployment |

# Missing outright (no UI exists at all)
- **Settings/Profile/Account screen** in the mobile app — no logout button, no account view, no TOS/Privacy link, no account deletion path.
- **Notification inbox** in the mobile app — pushes are sent but never viewable in-app afterward.
- **Manual balance adjustment UI** in the admin panel — the backend supports it; nothing in the panel calls it.
- **YouTube search/category/auto-fetch ingestion** in the admin panel — covered in detail in the previous audit; still the one major *intentional* feature gap (vs. the bugs above, which are all unintentional wiring breaks).
- **A leaderboard feature** of any kind — the app teases one on Home; nothing exists behind it on either the app or backend.

---

*This report covers UI/UX structure, page-to-page flow, and the wiring between every screen and its backend endpoint. It does not repeat the backend/security findings from the prior technical audit except where they directly explain a UI screen showing empty or broken data (e.g., the Fraud Center).*