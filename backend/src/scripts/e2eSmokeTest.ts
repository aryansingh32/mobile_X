/**
 * e2eSmokeTest.ts
 *
 * A real end-to-end scenario suite that runs against a LIVE server + a real
 * Postgres + Redis — not mocks. It exercises the reward/economy logic through
 * two tiers:
 *
 *   Tier A — real HTTP requests, HMAC-signed exactly like the mobile client
 *   (see api/client.ts), against every endpoint that doesn't require a
 *   genuine Google-signed AdMob SSV callback or a real Google/Firebase
 *   OAuth token (neither of which can be forged outside Google's own infra —
 *   this suite does not attempt to).
 *
 *   Tier B — direct calls into the service-layer functions (addExp,
 *   updateStreak, checkAndAwardBadges, escalateReferralTiers) against the
 *   same live database, for the reward-crediting logic that in production
 *   is only reachable via that Google-signed SSV callback.
 *
 * Requires: DATABASE_URL and REDIS_URL/REDIS_HOST+PORT pointing at a real,
 * running Postgres/Redis (see .env), and the server itself running and
 * reachable at BASE_URL (defaults to http://localhost:5000).
 *
 * Run with: npm run test:e2e
 *
 * This is NOT the same as `npm test` (ts-jest, mocked Prisma, no live DB) —
 * that suite still exists and still runs in CI without any external
 * services. This one is for a human (or a deploy pipeline with a real
 * staging DB) to run before shipping a change that touches reward/economy
 * logic, precisely because mocks can't catch things like "the migration
 * history doesn't actually create half the tables in schema.prisma" — which
 * is exactly the class of bug this suite caught the first time it ran.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import axios, { AxiosInstance } from 'axios';
import IORedis from 'ioredis';
import prisma from '../config/db';
import { addExp, updateStreak, getLevelThresholds, getStreakMilestones } from '../services/expService';
import { checkAndAwardBadges } from '../services/badgeService';
import { escalateReferralTiers } from '../services/referralService';

// Suffixes fixture identifiers that carry "first time only" semantics
// (a mission's metricType, a content-string key) so re-running this suite
// against a database that still has a previous run's rows never collides
// with them — a fixed metricType across runs previously double-completed
// the SAME telemetry event against two leftover Missions rows, which looked
// exactly like a double-payout bug but was actually just test-data reuse.
const RUN_ID = Date.now().toString(36);

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || '';
const API_CLIENT_SECRET = process.env.API_CLIENT_SECRET || '';

if (!JWT_SECRET || !API_CLIENT_SECRET) {
  console.error('JWT_SECRET and API_CLIENT_SECRET must be set in the environment this script runs in.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];
let currentSection = '';

const section = (name: string) => {
  currentSection = name;
  console.log(`\n\x1b[1m\x1b[36m▶ ${name}\x1b[0m`);
};

const ok = (label: string) => {
  passed++;
  console.log(`  \x1b[32m✓\x1b[0m ${label}`);
};

const bad = (label: string, detail?: string) => {
  failed++;
  const msg = `[${currentSection}] ${label}${detail ? ` — ${detail}` : ''}`;
  failures.push(msg);
  console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? `\n    ${detail}` : ''}`);
};

const assert = (condition: boolean, label: string, detail?: string) => {
  if (condition) ok(label);
  else bad(label, detail);
};

const assertEqual = <T>(actual: T, expected: T, label: string) => {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  assert(match, label, match ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const assertStatus = (actualStatus: number, expectedStatus: number, label: string) => {
  assert(actualStatus === expectedStatus, label, actualStatus === expectedStatus ? undefined : `expected HTTP ${expectedStatus}, got ${actualStatus}`);
};

// ─────────────────────────────────────────────────────────
// Signed HTTP client — replicates modified2/reel-flow/src/api/client.ts's
// request interceptor exactly (same sort-keys + HMAC-SHA256 scheme
// signatureMiddleware.ts verifies), plus admin.ts's simpler bearer-token flow.
// ─────────────────────────────────────────────────────────

const sortObjectKeys = (obj: any, depth = 0): any => {
  if (depth > 5) return obj;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => sortObjectKeys(item, depth + 1));
  return Object.keys(obj).sort().reduce((acc: any, key) => {
    acc[key] = sortObjectKeys(obj[key], depth + 1);
    return acc;
  }, {});
};

const signedRequest = (token?: string) => {
  const client: AxiosInstance = axios.create({ baseURL: BASE_URL, validateStatus: () => true });
  client.interceptors.request.use((config) => {
    if (token) config.headers.Authorization = `Bearer ${token}`;
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    config.headers['x-api-timestamp'] = timestamp;
    config.headers['x-api-nonce'] = nonce;
    const bodyString = config.data && Object.keys(config.data).length > 0 ? JSON.stringify(sortObjectKeys(config.data)) : '';
    const payload = bodyString + timestamp + nonce;
    config.headers['x-api-signature'] = crypto.createHmac('sha256', API_CLIENT_SECRET).update(payload).digest('hex');
    return config;
  });
  return client;
};

const mintToken = (userId: number) => jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '30d' });

// ─────────────────────────────────────────────────────────
// Fixtures — created directly via Prisma, standing in for what a real
// Google OAuth sign-in would produce (this suite can't forge a Google ID
// token, so it starts from where authController.ts's googleLogin leaves off:
// a User row, freshly created).
// ─────────────────────────────────────────────────────────

let userSeq = 0;
const nextEmail = () => `e2e-test-user-${Date.now()}-${++userSeq}@example.test`;

const createTestUser = async (overrides: Partial<{ role: string; xp: number; level: number; streak: number; streakFreezes: number; banned: boolean; lastLogin: Date }> = {}) => {
  const user = await prisma.user.create({
    data: {
      email: nextEmail(),
      name: `E2E Test User ${userSeq}`,
      role: overrides.role ?? 'USER',
      xp: overrides.xp ?? 0,
      level: overrides.level ?? 1,
      streak: overrides.streak ?? 0,
      streakFreezes: overrides.streakFreezes ?? 0,
      banned: overrides.banned ?? false,
      lastLogin: overrides.lastLogin ?? new Date(),
      referralCode: `E2E${userSeq}${Date.now().toString(36).toUpperCase()}`,
    },
  });
  return { user, token: mintToken(user.id), client: signedRequest(mintToken(user.id)) };
};

const setConfig = async (key: string, value: string) => {
  await prisma.appConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
};

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// Badge awarding and notification sends are deliberately fire-and-forget
// (`checkAndAwardBadges(...).catch(() => undefined)`, not awaited) so a
// reward response never blocks on a non-critical side effect. That's the
// right tradeoff for production, but it means a test that immediately
// queries for the resulting badge/notification row right after the
// triggering call returns is racing an in-flight write — this gives it a
// moment to land instead of being flaky based on incidental timing.
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

// ─────────────────────────────────────────────────────────
// Test sections
// ─────────────────────────────────────────────────────────

async function testAuthAndSignatureEdgeCases() {
  section('Auth & HMAC signature edge cases');
  const anon = axios.create({ baseURL: BASE_URL, validateStatus: () => true });

  const noSig = await anon.get('/api/users/profile', { headers: { Authorization: `Bearer ${mintToken(1)}` } });
  assertStatus(noSig.status, 401, 'request with no signature headers is rejected');

  const { user, token, client } = await createTestUser();

  // A fresh client bound to no token at all — reusing `client` here would be
  // silently clobbered back to a valid Authorization header by its own
  // interceptor, since it closes over the real token regardless of any
  // per-request header override.
  const noTokenClient = signedRequest('');
  const noAuth = await noTokenClient.get('/api/users/profile');
  assertStatus(noAuth.status, 401, 'signed request with no JWT is rejected');

  const garbageAuth = signedRequest('this.is.not.a.valid.jwt');
  const garbageRes = await garbageAuth.get('/api/users/profile');
  assertStatus(garbageRes.status, 401, 'signed request with a garbage JWT is rejected');

  const staleTimestamp = axios.create({ baseURL: BASE_URL, validateStatus: () => true });
  const oldTs = (Date.now() - 10 * 60 * 1000).toString();
  const nonce1 = crypto.randomBytes(16).toString('hex');
  const sig1 = crypto.createHmac('sha256', API_CLIENT_SECRET).update('' + oldTs + nonce1).digest('hex');
  const expiredRes = await staleTimestamp.get('/api/users/profile', {
    headers: { Authorization: `Bearer ${token}`, 'x-api-timestamp': oldTs, 'x-api-nonce': nonce1, 'x-api-signature': sig1 },
  });
  assertStatus(expiredRes.status, 401, 'request with a >5min-old timestamp is rejected as expired');

  // Replay: reuse the exact same nonce twice.
  const replayNonce = crypto.randomBytes(16).toString('hex');
  const replayTs = Date.now().toString();
  const replaySig = crypto.createHmac('sha256', API_CLIENT_SECRET).update('' + replayTs + replayNonce).digest('hex');
  const headers = { Authorization: `Bearer ${token}`, 'x-api-timestamp': replayTs, 'x-api-nonce': replayNonce, 'x-api-signature': replaySig };
  const first = await axios.get(`${BASE_URL}/api/users/profile`, { headers, validateStatus: () => true });
  const second = await axios.get(`${BASE_URL}/api/users/profile`, { headers, validateStatus: () => true });
  assertStatus(first.status, 200, 'first use of a fresh nonce succeeds');
  assertStatus(second.status, 401, 'replaying the same nonce a second time is rejected (Redis SETNX working)');

  const tamperedRes = await axios.get(`${BASE_URL}/api/users/profile`, {
    headers: { ...headers, 'x-api-nonce': crypto.randomBytes(16).toString('hex') }, // signature no longer matches
    validateStatus: () => true,
  });
  assertStatus(tamperedRes.status, 401, 'signature that no longer matches the (altered) payload is rejected');

  const bannedUser = await createTestUser({ banned: true });
  const bannedRes = await bannedUser.client.get('/api/users/profile');
  assertStatus(bannedRes.status, 403, 'a banned user is rejected even with a structurally valid token+signature');
}

async function testProfileAndSignupBonus() {
  section('Profile shape & signup bonus');
  const { user, client } = await createTestUser();

  // Signup bonus: replicate exactly what authController.googleLogin's
  // "new user" branch does (this suite can't forge a real Google ID token,
  // so it starts one step downstream of that — at "a user was just created").
  const signupBonus = await prisma.appConfig.findUnique({ where: { key: 'signup_bonus_coins' } });
  const bonusAmount = signupBonus ? parseInt(signupBonus.value, 10) : 50;
  await prisma.coinLedger.create({
    data: {
      userId: user.id, amount: bonusAmount, source: 'SIGNUP_BONUS',
      idempotencyKey: `signup-${user.id}`, sessionId: `signup-${user.id}`, ipHash: 'test',
    },
  });

  const res = await client.get('/api/users/profile');
  assertStatus(res.status, 200, 'GET /api/users/profile succeeds for a freshly created user');
  assertEqual(res.data?.data?.coins, bonusAmount, `profile balance reflects the signup bonus (${bonusAmount} coins)`);
  assertEqual(res.data?.data?.xp, 0, 'fresh user has 0 XP');
  assertEqual(res.data?.data?.level, 1, 'fresh user is level 1');
  assertEqual(res.data?.data?.streakFreezes, 0, 'fresh user has 0 streak freezes');
  assert(Array.isArray(res.data?.data?.levelThresholds) && res.data.data.levelThresholds.length > 0, 'profile serves a non-empty levelThresholds array');
  assert(Array.isArray(res.data?.data?.userBadges) && res.data.data.userBadges.length === 0, 'fresh user has no badges yet');
}

async function testShortVideoRewardAndComplianceGate() {
  section('Short-video reward — compliance gate + anti-abuse');
  const { client } = await createTestUser();

  const tooShort = await client.post('/api/rewards/shorts', { videoId: 'vid1', watchSeconds: 2, sessionId: 's1' });
  assertStatus(tooShort.status, 400, 'watchSeconds below the configured minimum is rejected');

  await setConfig('short_watch_reward_coins', '0');
  const zeroReward = await client.post('/api/rewards/shorts', { videoId: 'vid2', watchSeconds: 10, sessionId: 's2' });
  assertStatus(zeroReward.status, 200, 'a valid-length watch is accepted at the default 0-coin config');
  assertEqual(zeroReward.data?.coinsEarned, 0, 'coinsEarned is 0 when short_watch_reward_coins is 0 (YouTube ToS default)');

  // Critical regression check from this session's earlier compliance fix:
  // flipping the coin amount alone must NOT pay out — the legal-review flag
  // is a second, independently-required gate.
  await setConfig('short_watch_reward_coins', '25');
  const noLegalReview = await client.post('/api/rewards/shorts', { videoId: 'vid3', watchSeconds: 10, sessionId: 's3' });
  assertEqual(noLegalReview.data?.coinsEarned, 0, 'nonzero short_watch_reward_coins WITHOUT the legal-review flag still forces payout to 0');

  await setConfig('short_watch_reward_coins_legal_review_approved', 'true');
  const withLegalReview = await client.post('/api/rewards/shorts', { videoId: 'vid4', watchSeconds: 10, sessionId: 's4' });
  assertEqual(withLegalReview.data?.coinsEarned, 25, 'with BOTH the coin amount set AND the legal-review flag, the reward pays out');
  // Reset for other tests.
  await setConfig('short_watch_reward_coins', '0');
  await setConfig('short_watch_reward_coins_legal_review_approved', 'false');

  const duplicate = await client.post('/api/rewards/shorts', { videoId: 'vid4', watchSeconds: 10, sessionId: 's4-retry' });
  assertEqual(duplicate.data?.coinsEarned, 0, 'the same video re-watched within 24h is rejected (per-video cooldown), not double-paid');
  assert(/already rewarded/i.test(duplicate.data?.message ?? ''), 'duplicate-video response explains why (no reward)');
}

async function testStreakLifecycleAndMilestones() {
  section('Streak lifecycle — claim, break, freeze protection, milestones');

  const fresh = await createTestUser({ lastLogin: daysAgo(2) }); // "yesterday" relative wording avoided; ensures first sync counts a day
  const first = await fresh.client.post('/api/users/streak/sync');
  assertStatus(first.status, 200, 'first-ever streak sync succeeds');

  const sameDayAgain = await fresh.client.post('/api/users/streak/sync');
  assertEqual(sameDayAgain.data?.data?.newStreak, first.data?.data?.newStreak, 'syncing again the same day is a no-op, not a second increment');

  // Consecutive-day increment.
  const consecutive = await createTestUser({ streak: 4, lastLogin: daysAgo(1) });
  const consecResult = await updateStreak(consecutive.user.id);
  assertEqual(consecResult.newStreak, 5, 'a consecutive-day check-in increments the streak by exactly 1');
  assertEqual(consecResult.freezeUsed, false, 'no freeze consumed on a normal consecutive check-in');

  // Broken streak, no freeze held.
  const broken = await createTestUser({ streak: 10, lastLogin: daysAgo(3), streakFreezes: 0 });
  const brokenResult = await updateStreak(broken.user.id);
  assertEqual(brokenResult.newStreak, 1, 'a missed day with 0 freezes held resets the streak to 1');
  assertEqual(brokenResult.broken, true, 'the break is reported as broken:true');

  // Broken streak, freeze held — should auto-protect instead of resetting.
  const protectedUser = await createTestUser({ streak: 10, lastLogin: daysAgo(3), streakFreezes: 2 });
  const protectedResult = await updateStreak(protectedUser.user.id);
  assertEqual(protectedResult.newStreak, 11, 'a missed day WITH a freeze held continues the streak instead of resetting it');
  assertEqual(protectedResult.freezeUsed, true, 'freezeUsed:true is reported when a freeze auto-protects the streak');
  assertEqual(protectedResult.broken, false, 'a freeze-protected save is NOT reported as broken');
  const remaining = await prisma.user.findUnique({ where: { id: protectedUser.user.id } });
  assertEqual(remaining?.streakFreezes, 1, 'exactly one freeze token is consumed, not the whole stock');
  await settle();
  const freezeNotif = await prisma.notification.findFirst({ where: { userId: protectedUser.user.id, title: { contains: 'Freeze Used' } } });
  assert(!!freezeNotif, 'a "streak freeze used" notification is logged for the protected save');

  // Streak-freeze purchase flow.
  await setConfig('streak_freeze_cost_coins', '50');
  await setConfig('streak_freeze_max', '2');
  const buyer = await createTestUser();
  const insufficientBuy = await buyer.client.post('/api/users/streak-freeze/purchase');
  assertStatus(insufficientBuy.status, 400, 'buying a freeze with 0 coins is rejected (insufficient balance)');
  await prisma.coinLedger.create({ data: { userId: buyer.user.id, amount: 200, source: 'TEST_GRANT', idempotencyKey: `grant-${buyer.user.id}`, sessionId: 'x', ipHash: 't' } });
  const buy1 = await buyer.client.post('/api/users/streak-freeze/purchase');
  assertStatus(buy1.status, 200, 'buying a freeze with sufficient balance succeeds');
  assertEqual(buy1.data?.streakFreezes, 1, 'streakFreezes count increments after purchase');
  await buyer.client.post('/api/users/streak-freeze/purchase');
  const buy3 = await buyer.client.post('/api/users/streak-freeze/purchase');
  assertStatus(buy3.status, 400, 'buying beyond streak_freeze_max is rejected once the cap is hit');

  // Milestone: cross day 7 and confirm the bonus + badge fire exactly once.
  const milestoneUser = await createTestUser({ streak: 6, lastLogin: daysAgo(1) });
  const milestoneResult = await updateStreak(milestoneUser.user.id);
  assertEqual(milestoneResult.newStreak, 7, 'streak reaches day 7');
  const milestones = await getStreakMilestones();
  const day7 = milestones.find((m) => m.day === 7);
  assert(!!day7, 'a day-7 milestone is configured (default or admin-edited)');
  if (day7) {
    const bonusEntry = await prisma.coinLedger.findFirst({ where: { userId: milestoneUser.user.id, source: 'STREAK_BONUS_7' } });
    assert(!!bonusEntry && bonusEntry.amount === day7.bonusCoins, `day-7 milestone credits exactly ${day7.bonusCoins} coins once`);
  }
  await settle();
  const weekBadge = await prisma.userBadges.findFirst({ where: { userId: milestoneUser.user.id }, include: { badge: true } });
  assert(!!weekBadge && weekBadge.badge.name === 'Week Warrior', 'the "Week Warrior" badge is awarded on reaching the day-7 milestone');
}

async function testLevelThresholdsAreLiveConfig() {
  section('Level thresholds — admin-config-driven, no hardcoded cap');
  const defaultThresholds = await getLevelThresholds();
  assert(defaultThresholds.length >= 10, 'default level thresholds table has at least 10 levels');

  const { user } = await createTestUser();
  const bigJump = await addExp(user.id, 10000);
  assertEqual(bigJump.newLevel, defaultThresholds.length, 'adding enough XP to clear every threshold at once lands exactly on the max configured level (no off-by-one)');
  assertEqual(bigJump.leveledUp, true, 'leveledUp is reported true for the jump');
  await settle();
  const maxBadge = await prisma.userBadges.findFirst({ where: { userId: user.id }, include: { badge: true } });
  assert(!!maxBadge && maxBadge.badge.name === 'Max Level', '"Max Level" badge fires when XP crosses the top configured threshold');

  // Admin raises the cap — the SAME user, already at max, should be able to
  // level up further with no code change, purely from config.
  const extended = [...defaultThresholds, defaultThresholds[defaultThresholds.length - 1]! + 5000];
  await setConfig('level_xp_thresholds', JSON.stringify(extended));
  const afterExtend = await addExp(user.id, 5000);
  assertEqual(afterExtend.newLevel, extended.length, 'raising the level cap via AppConfig alone lets an already-maxed user level up further, with zero code changes');

  // Restore defaults so later tests aren't affected.
  await prisma.appConfig.delete({ where: { key: 'level_xp_thresholds' } }).catch(() => undefined);

  // Zero-XP / no-op call shouldn't touch level or throw.
  const { user: idleUser } = await createTestUser({ xp: 500, level: 3 });
  const noop = await addExp(idleUser.id, 0);
  assertEqual(noop.leveledUp, false, 'addExp(user, 0) is a safe no-op, not a level change');
}

async function testDailyMissionsAndReset() {
  section('Daily missions — progress, completion, and the midnight reset');
  const metricType = `E2E_TEST_METRIC_${RUN_ID}`;
  const mission = await prisma.missions.create({
    data: {
      title: 'E2E Test Mission', description: 'Watch 3 shorts', targetCount: 3,
      rewardXp: 10, rewardCoins: 15, type: 'DAILY', metricType, isActive: true,
    },
  });

  const { user, client } = await createTestUser();
  const emptyList = await client.get('/api/users/missions/daily');
  const found = emptyList.data?.data?.find((m: any) => m.id === mission.id);
  assertEqual(found?.progress, 0, 'a brand-new user starts a daily mission at 0 progress');
  assertEqual(found?.completed, false, 'not completed yet');

  const balanceBefore = await prisma.coinLedger.aggregate({ where: { userId: user.id }, _sum: { amount: true } });
  const batchRes = await client.post('/api/telemetry/batch', { events: [{ eventType: metricType, count: 3 }] });
  assertStatus(batchRes.status, 200, 'telemetry batch event processes successfully');

  const completedMission = await prisma.userMissions.findFirst({ where: { userId: user.id, missionId: mission.id } });
  assert(!!completedMission?.completedAt, 'mission is marked completed once progress reaches targetCount');
  const balanceAfter = await prisma.coinLedger.aggregate({ where: { userId: user.id }, _sum: { amount: true } });
  const gained = (balanceAfter._sum.amount ?? 0) - (balanceBefore._sum.amount ?? 0);
  assertEqual(gained, mission.rewardCoins, 'mission completion credits exactly its configured rewardCoins, once');

  const overComplete = await client.post('/api/telemetry/track', { eventType: metricType, count: 5 });
  assertStatus(overComplete.status, 200, 'further progress events after completion do not error');
  const stillOneCredit = await prisma.coinLedger.count({ where: { userId: user.id, source: { startsWith: 'MISSION_COMPLETED' } } });
  assertEqual(stillOneCredit, 1, 'a completed mission is never paid out a second time from extra progress events');

  // The actual reset job's DB operation (see schedulerService.ts's private
  // resetDailyMissions — same Prisma call, exercised directly here).
  const resetResult = await prisma.userMissions.updateMany({ where: { mission: { type: 'DAILY' } }, data: { progress: 0, completedAt: null } });
  assert(resetResult.count >= 1, 'the daily-mission-reset query clears at least the mission just completed');
  const afterReset = await prisma.userMissions.findFirst({ where: { userId: user.id, missionId: mission.id } });
  assertEqual(afterReset?.progress, 0, 'progress is back to 0 after the reset');
  assertEqual(afterReset?.completedAt, null, 'completedAt is cleared after the reset');
}

async function testReferralApplyAndEscalation() {
  section('Referrals — apply, commission tiers, and automatic escalation');
  const referrer = await createTestUser();
  const referred = await createTestUser();

  const selfApply = await referrer.client.post('/api/referral/apply', { code: referrer.user.referralCode });
  assertStatus(selfApply.status, 400, 'a user cannot apply their own referral code');

  const badCode = await referred.client.post('/api/referral/apply', { code: 'DOES-NOT-EXIST' });
  assertStatus(badCode.status, 404, 'an unknown referral code is rejected');

  const apply = await referred.client.post('/api/referral/apply', { code: referrer.user.referralCode });
  assertStatus(apply.status, 200, 'applying a valid, unused referral code succeeds');

  const doubleApply = await referred.client.post('/api/referral/apply', { code: referrer.user.referralCode });
  assertStatus(doubleApply.status, 400, 'a user cannot apply a second referral code after already having one');

  const referral = await prisma.referral.findUnique({ where: { referredId: referred.user.id } });
  assertEqual(referral?.tier, 1, 'a newly applied referral starts at tier 1');

  await settle();
  const recruiterBadge = await prisma.userBadges.findFirst({ where: { userId: referrer.user.id }, include: { badge: true } });
  assert(!!recruiterBadge && recruiterBadge.badge.name === 'Recruiter', 'the referrer gets the "Recruiter" badge on their first successful referral');

  // Escalation: back-date the referred user so they qualify for tier 2, and
  // keep them "active" within the configured window.
  await setConfig('referral_tier2_days', '30');
  await setConfig('referral_active_window_days', '7');
  await prisma.user.update({ where: { id: referred.user.id }, data: { createdAt: daysAgo(31), lastActiveAt: daysAgo(1) } });
  await escalateReferralTiers();
  const escalated = await prisma.referral.findUnique({ where: { referredId: referred.user.id } });
  assertEqual(escalated?.tier, 2, 'a referral escalates to tier 2 once the referred user has been active long enough');
  await settle();
  const tierUpNotif = await prisma.notification.findFirst({ where: { userId: referrer.user.id, title: { contains: 'Tier Up' } } });
  assert(!!tierUpNotif, 'the referrer is notified when their referral escalates tiers');

  // Inactive referred user should NOT escalate even past the day threshold.
  const referrer2 = await createTestUser();
  const referred2 = await createTestUser();
  await referred2.client.post('/api/referral/apply', { code: referrer2.user.referralCode });
  await prisma.user.update({ where: { id: referred2.user.id }, data: { createdAt: daysAgo(60), lastActiveAt: daysAgo(20) } });
  await escalateReferralTiers();
  const stillTier1 = await prisma.referral.findUnique({ where: { referredId: referred2.user.id } });
  assertEqual(stillTier1?.tier, 1, 'a referral does NOT escalate if the referred user has gone inactive, even past the day threshold');
}

async function testWithdrawalFlowAndConcurrency() {
  section('Wallet — withdrawal, referral commission, and a concurrency race');
  const catalogItem = await prisma.catalogItem.create({
    data: { name: 'E2E Test Reward', type: 'CUSTOM', coinCost: 500, inrValue: 50, active: true, stock: -1 },
  });
  await setConfig('min_withdrawal_coins', '500');

  const { user, client } = await createTestUser();
  const poorWithdraw = await client.post('/api/wallet/withdraw', { catalogItemId: catalogItem.id, destinationId: 'test@upi' });
  assertStatus(poorWithdraw.status, 400, 'withdrawal with insufficient balance is rejected');

  // Referral chain so we can verify commission math ends up on the ledger.
  const referrer = await createTestUser();
  await client.post('/api/referral/apply', { code: referrer.user.referralCode });
  await setConfig('referral_percent_tier_1', '10');

  await prisma.coinLedger.create({ data: { userId: user.id, amount: 500, source: 'TEST_GRANT', idempotencyKey: `grant-${user.id}`, sessionId: 'x', ipHash: 't' } });
  const withdraw = await client.post('/api/wallet/withdraw', { catalogItemId: catalogItem.id, destinationId: 'test@upi' });
  assertStatus(withdraw.status, 200, 'withdrawal with sufficient balance succeeds');
  const afterWithdrawBalance = await prisma.coinLedger.aggregate({ where: { userId: user.id }, _sum: { amount: true } });
  assertEqual(afterWithdrawBalance._sum.amount, 0, 'the withdrawn coin cost is fully debited from the balance');
  const commission = await prisma.coinLedger.findFirst({ where: { userId: referrer.user.id, source: { startsWith: 'REFERRAL_TIER' } } });
  assertEqual(commission?.amount, 50, "the referrer is credited exactly 10% of the withdrawal's coin cost at tier 1");

  // Concurrency: exactly one of two simultaneous withdrawal requests for a
  // balance that only covers one should succeed.
  const racer = await createTestUser();
  await prisma.coinLedger.create({ data: { userId: racer.user.id, amount: 500, source: 'TEST_GRANT', idempotencyKey: `grant-${racer.user.id}`, sessionId: 'x', ipHash: 't' } });
  const [raceA, raceB] = await Promise.all([
    racer.client.post('/api/wallet/withdraw', { catalogItemId: catalogItem.id, destinationId: 'a@upi' }),
    racer.client.post('/api/wallet/withdraw', { catalogItemId: catalogItem.id, destinationId: 'b@upi' }),
  ]);
  const successes = [raceA, raceB].filter((r) => r.status === 200).length;
  assertEqual(successes, 1, 'two concurrent withdrawal requests for exactly-one-balance-worth resolve to exactly ONE success (no double-spend)');
  const racerFinalBalance = await prisma.coinLedger.aggregate({ where: { userId: racer.user.id }, _sum: { amount: true } });
  assertEqual(racerFinalBalance._sum.amount, 0, "the racer's balance reflects exactly one debit, not zero or double");
}

async function testRouletteFlow() {
  section('Roulette — config, spins, daily chances, level-tied bonus');
  const emptyConfig = await (await createTestUser()).client.get('/api/rewards/roulette-config');
  assertStatus(emptyConfig.status, 200, 'roulette-config responds 200 even with zero active slices');

  await prisma.rouletteItem.createMany({
    data: [
      { label: 'Small XP', color: '#ff0000', rewardCoins: 10, probability: 100, sizePortion: 1, isActive: true, sortOrder: 1 },
    ],
  });

  await setConfig('roulette_daily_chances', '1');
  await setConfig('roulette_level_bonus_interval', '5');
  // xp must actually support level 10 under the default thresholds — a
  // level/xp mismatch here previously masked a real bug (see addExp's
  // Math.max guard in expService.ts): granting XP recomputed the level from
  // scratch and could silently DEMOTE a user whose stored level outran
  // their stored xp.
  const { user, client } = await createTestUser({ level: 10, xp: 4500 });
  const spin1 = await client.post('/api/rewards/roulette-spin', { sessionId: 'spin-1' });
  assertStatus(spin1.status, 200, 'first roulette spin of the day succeeds');
  assertEqual(spin1.data?.coinsEarned, 0, 'roulette NEVER credits coins directly (XP-only, compliance-required)');
  assert(spin1.data?.xpGained > 0, 'roulette spin grants XP');

  const spin2 = await client.post('/api/rewards/roulette-spin', { sessionId: 'spin-2' });
  assertStatus(spin2.status, 200, 'a level-10 user (2 bonus spins at interval 5) has more than 1 daily chance');

  // Exhaust remaining chances (1 base + 2 level bonus = 3 total for a level-10 user at interval 5).
  await client.post('/api/rewards/roulette-spin', { sessionId: 'spin-3' });
  const overSpin = await client.post('/api/rewards/roulette-spin', { sessionId: 'spin-4' });
  assertStatus(overSpin.status, 429, 'spinning beyond the daily chance allotment (base + level bonus) is rejected');
}

async function testDiscoverReadReward() {
  section('Discover read-reward — XP-only, dwell-gated, deduped');
  await setConfig('read_reward_min_seconds', '10');
  await setConfig('read_reward_xp', '5');
  await setConfig('read_reward_daily_cap', '2');
  const { client } = await createTestUser();

  const tooFast = await client.post('/api/rewards/read', { articleId: 'art-1', readSeconds: 3 });
  assertEqual(tooFast.data?.xpGained, 0, 'reading for less than the minimum dwell time earns no XP');

  const valid = await client.post('/api/rewards/read', { articleId: 'art-1', readSeconds: 15 });
  assertEqual(valid.data?.xpGained, 5, 'a qualifying read earns the configured XP');

  const dup = await client.post('/api/rewards/read', { articleId: 'art-1', readSeconds: 15 });
  assertEqual(dup.data?.xpGained, 0, 're-reading the SAME article the same day earns no additional XP');

  await client.post('/api/rewards/read', { articleId: 'art-2', readSeconds: 15 });
  const overCap = await client.post('/api/rewards/read', { articleId: 'art-3', readSeconds: 15 });
  assertEqual(overCap.data?.xpGained, 0, 'reading beyond the daily read-reward cap earns no further XP');
}

async function testBadgesLeaderboardMarquee() {
  section('Badges, Leaderboard, Marquee');

  const { user, client } = await createTestUser({ level: 7 });
  await checkAndAwardBadges(user.id, 'LEVEL', 7);
  await checkAndAwardBadges(user.id, 'LEVEL', 7); // deliberately called twice
  const badgeCount = await prisma.userBadges.count({ where: { userId: user.id } });
  assert(badgeCount <= 1, 'awarding the same badge condition twice does not create duplicate UserBadges rows');

  const badgesList = await client.get('/api/users/badges');
  assertStatus(badgesList.status, 200, 'GET /api/users/badges succeeds');
  const catalogSize = await prisma.badges.count();
  assertEqual(badgesList.data?.data?.length, catalogSize, "the badges list returns the FULL catalog (locked + unlocked), not just what's earned");

  // Leaderboard.
  const richUser = await createTestUser();
  await prisma.user.update({ where: { id: richUser.user.id }, data: { totalCoinsEarned: 99999 } });
  const poorUser = await createTestUser();
  await prisma.user.update({ where: { id: poorUser.user.id }, data: { totalCoinsEarned: 1 } });
  const board = await poorUser.client.get('/api/users/leaderboard?period=all');
  assertStatus(board.status, 200, 'GET /api/users/leaderboard succeeds');
  const leaders: any[] = board.data?.data?.leaders ?? [];
  const richEntry = leaders.find((l) => l.name === richUser.user.name);
  const poorEntry = leaders.find((l) => l.name === poorUser.user.name);
  if (richEntry && poorEntry) {
    assert(richEntry.rank < poorEntry.rank, 'a higher totalCoinsEarned ranks strictly better on the leaderboard');
  } else {
    bad('leaderboard contains both the rich and poor test users', 'one or both missing from top 50 — unexpected with a small test DB');
  }
  const shadowUser = await createTestUser();
  await prisma.user.update({ where: { id: shadowUser.user.id }, data: { totalCoinsEarned: 88888, shadowBanned: true } });
  const boardAfterShadow = await poorUser.client.get('/api/users/leaderboard?period=all');
  const shadowEntry = (boardAfterShadow.data?.data?.leaders ?? []).find((l: any) => l.name === shadowUser.user.name);
  assert(!shadowEntry, 'a shadow-banned user never appears on the user-facing leaderboard, no matter how high their balance');

  // Marquee — real activity feed + custom messages.
  await setConfig('marquee_custom_messages', JSON.stringify(['E2E test promo message']));
  const marqueeRes = await poorUser.client.get('/api/marquee');
  assertStatus(marqueeRes.status, 200, 'GET /api/marquee succeeds');
  const items: any[] = marqueeRes.data?.items ?? [];
  assert(items.some((i) => i.text === 'E2E test promo message'), 'admin-authored custom marquee messages are merged into the real feed');

  // The feed is capped and shuffled, so an admin-authored message used to be
  // droppable at random once organic activity filled the cap — the admin
  // configures a message and it silently never shows. Custom messages now get
  // reserved slots; repeat the fetch so a random pass can't look like a real
  // one (this failed intermittently before the fix).
  const manyMessages = Array.from({ length: 5 }, (_, i) => `E2E reserved slot ${i}`);
  await setConfig('marquee_custom_messages', JSON.stringify(manyMessages));
  let allPresentEveryTime = true;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await poorUser.client.get('/api/marquee');
    const texts = (res.data?.items ?? []).map((i: any) => i.text);
    if (!manyMessages.every((m) => texts.includes(m))) allPresentEveryTime = false;
  }
  assert(allPresentEveryTime, 'every admin-authored message survives the feed cap on every fetch, never dropped by the shuffle');
}

async function testAdminEndpoints() {
  section('Admin panel endpoints — badges CRUD, config validation, roulette label safety');
  const admin = await createTestUser({ role: 'SUPER_ADMIN' });
  const nonAdmin = await createTestUser();

  const forbidden = await nonAdmin.client.get('/api/admin/badges');
  assertStatus(forbidden.status, 403, 'a non-admin user is rejected from admin routes');

  const createBadge = await admin.client.post('/api/admin/badges', { name: 'E2E Badge', description: 'test', conditionType: 'E2E_TEST', conditionValue: 1 });
  assertStatus(createBadge.status, 200, 'admin can create a new badge');
  const badgeId = createBadge.data?.data?.id;

  const updateBadge = await admin.client.put(`/api/admin/badges/${badgeId}`, { conditionValue: 2 });
  assertStatus(updateBadge.status, 200, 'admin can update a badge');
  assertEqual(updateBadge.data?.data?.conditionValue, 2, 'the update actually persisted');

  const deleteBadge = await admin.client.delete(`/api/admin/badges/${badgeId}`);
  assertStatus(deleteBadge.status, 200, 'admin can delete a badge');

  // Config key validation.
  const badKey = await admin.client.put('/api/admin/config/Not-A-Valid-Key!', { value: 'x' });
  assertStatus(badKey.status, 400, 'a config key with invalid characters is rejected');
  const emptyValue = await admin.client.put('/api/admin/config/e2e_test_key', { value: '' });
  assertStatus(emptyValue.status, 400, 'an empty config value is rejected');
  const goodConfig = await admin.client.put('/api/admin/config/e2e_test_key', { value: 'hello' });
  assertStatus(goodConfig.status, 200, 'a valid config key/value pair is accepted');

  // Roulette label safety — the compliance fix from an earlier pass.
  const cashLabel = await admin.client.post('/api/admin/roulette', { label: '500 Coins', color: '#fff', rewardCoins: 10, probability: 10, sizePortion: 1, isActive: true, sortOrder: 1 });
  assertStatus(cashLabel.status, 400, 'a roulette slice label implying real coins/cash is rejected');
  const xpLabel = await admin.client.post('/api/admin/roulette', { label: 'Bonus XP', color: '#fff', rewardCoins: 10, probability: 10, sizePortion: 1, isActive: true, sortOrder: 1 });
  assertStatus(xpLabel.status, 200, 'an XP-framed roulette label is accepted');

  // Content Strings CMS — create then update.
  const contentStringKey = `e2e.test.key.${RUN_ID}`;
  const newString = await admin.client.put(`/api/admin/content-strings/${contentStringKey}`, { screen: 'GLOBAL', value: 'Hello E2E' });
  assertStatus(newString.status, 201, 'admin can create a brand-new content string');
  const updateString = await admin.client.put(`/api/admin/content-strings/${contentStringKey}`, { value: 'Updated E2E' });
  assertStatus(updateString.status, 200, 'admin can update an existing content string (201 only on first create)');

  // Admin leaderboard deliberately includes banned/shadow-banned users.
  const flaggedUser = await createTestUser({ banned: true });
  await prisma.user.update({ where: { id: flaggedUser.user.id }, data: { totalCoinsEarned: 77777 } });
  const adminBoard = await admin.client.get('/api/admin/leaderboard?period=all');
  const flaggedEntry = (adminBoard.data?.data?.leaders ?? []).find((l: any) => l.id === flaggedUser.user.id);
  assert(!!flaggedEntry, 'the ADMIN leaderboard (unlike the user-facing one) keeps banned users visible for fraud review');
}

async function testClientCrashReporting() {
  section('Client crash reporting — device crashes reach the admin panel');
  const { user, client } = await createTestUser();

  const fatal = await client.post('/api/telemetry/client-error', {
    message: "TypeError: Cannot read property 'id' of undefined",
    stack: 'TypeError: ...\n    at ShortItem (src/components/shorts/ShortItem.tsx:120:5)',
    platform: 'android',
    appVersion: '1.1',
    fatal: true,
    screen: 'shorts',
  });
  assertStatus(fatal.status, 200, 'a fatal render crash from a device is accepted');

  const row = await prisma.errorLog.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  assert(!!row, 'the crash is persisted to ErrorLog');
  assertEqual(row?.source, 'CLIENT', 'it is tagged source=CLIENT, not mixed in with server faults');
  assertEqual(row?.platform, 'android', 'platform is captured for triage');
  assertEqual(row?.path, 'shorts', 'the screen it crashed on is captured');
  assertEqual(row?.fatal, true, 'the fatal flag distinguishes a crash from a handled error');
  assert(!!row?.stack && row!.stack!.includes('ShortItem'), 'the full stack trace is retained for the admin panel');

  const noMessage = await client.post('/api/telemetry/client-error', { platform: 'android' });
  assertStatus(noMessage.status, 400, 'a report with no message is rejected, not stored');

  const bogus = await client.post('/api/telemetry/client-error', {
    message: 'x'.repeat(2500),
    stack: 'y'.repeat(4000),
    platform: 'not-a-real-platform',
    appVersion: 'z'.repeat(500),
    screen: 'w'.repeat(2000),
  });
  assertStatus(bogus.status, 200, 'oversized/invalid fields are accepted rather than 500ing at a crashing app');
  const sanitized = await prisma.errorLog.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  assert((sanitized?.message.length ?? 0) <= 2000, 'message is clamped to its column bound');
  assert((sanitized?.stack?.length ?? 0) <= 8000, 'stack is clamped to its column bound');
  assertEqual(sanitized?.platform, null, 'an unrecognized platform is stored as null, not echoed back');
  assert((sanitized?.path.length ?? 0) <= 500, 'the screen field is clamped');

  // Regression guard: the client truncates to 1000/4000 chars precisely so a
  // real crash never trips express.json's 10kb limit. If this starts 413ing,
  // the worst crashes (deepest stacks) become the ones silently lost.
  const atClientCaps = await client.post('/api/telemetry/client-error', {
    message: 'm'.repeat(1000),
    stack: 's'.repeat(4000),
    platform: 'ios',
    appVersion: '1.1',
    fatal: true,
    screen: 'shorts',
  });
  assertStatus(atClientCaps.status, 200, "a report at the client's own size caps is not rejected as too large");

  const anon = await axios.post(`${BASE_URL}/api/telemetry/client-error`, { message: 'anon' }, { validateStatus: () => true });
  assert(anon.status === 401 || anon.status === 403, 'an unauthenticated crash report is rejected');

  const admin = await createTestUser({ role: 'SUPER_ADMIN' });
  const listed = await admin.client.get(`/api/admin/error-logs?source=CLIENT&userId=${user.id}`);
  assertStatus(listed.status, 200, 'admin can list client crashes filtered by source');
  assert((listed.data.data ?? []).length > 0, 'the crash is visible in the admin error log');
  assert((listed.data.data ?? []).every((r: any) => r.source === 'CLIENT'), 'the source filter returns only CLIENT rows');

  const serverOnly = await admin.client.get(`/api/admin/error-logs?source=SERVER&userId=${user.id}`);
  assertEqual((serverOnly.data.data ?? []).length, 0, "filtering to SERVER excludes this user's app crashes");
}

// ─────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\x1b[1mReelFlow backend E2E scenario suite\x1b[0m — against ${BASE_URL}, live Postgres + Redis\n`);

  // The withdrawal endpoint (and the global limiter) rate-limit by IP via a
  // Redis-backed store — everything in this suite runs from the same local
  // IP, so a rate-limit counter or a nonce from a previous run of this same
  // suite would otherwise bleed into this one and produce failures that
  // look like real bugs but are really just test-environment state. This
  // is a dedicated test Redis instance (REDIS_URL points at it), so a full
  // flush at the start of each run is the correct reset, not a shortcut
  // around something real.
  const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}/0`;
  const redis = new IORedis(redisUrl);
  await redis.flushdb();
  await redis.quit();

  const sections: Array<[string, () => Promise<void>]> = [
    ['auth', testAuthAndSignatureEdgeCases],
    ['profile', testProfileAndSignupBonus],
    ['shorts', testShortVideoRewardAndComplianceGate],
    ['streak', testStreakLifecycleAndMilestones],
    ['levels', testLevelThresholdsAreLiveConfig],
    ['missions', testDailyMissionsAndReset],
    ['referrals', testReferralApplyAndEscalation],
    ['wallet', testWithdrawalFlowAndConcurrency],
    ['roulette', testRouletteFlow],
    ['discover', testDiscoverReadReward],
    ['badges/leaderboard/marquee', testBadgesLeaderboardMarquee],
    ['admin', testAdminEndpoints],
    ['client-crash-reporting', testClientCrashReporting],
  ];

  for (const [name, fn] of sections) {
    try {
      await fn();
    } catch (err: any) {
      failed++;
      failures.push(`[${name}] threw an unhandled error — ${err?.message ?? err}`);
      console.log(`  \x1b[31m✗ unhandled error in this section\x1b[0m\n    ${err?.stack ?? err}`);
    }
  }

  console.log(`\n\x1b[1m${'─'.repeat(60)}\x1b[0m`);
  console.log(`\x1b[1mResults: \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m (${passed + failed} total)`);
  if (failures.length > 0) {
    console.log('\n\x1b[1mFailures:\x1b[0m');
    failures.forEach((f) => console.log(`  - ${f}`));
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Fatal error running the E2E suite:', err);
  await prisma.$disconnect();
  process.exit(1);
});
