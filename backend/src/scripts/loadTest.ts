/**
 * Load test for the API's hot paths.
 *
 * Every screen in the app hits these endpoints on mount and on a timer, so
 * their behavior under concurrency is what decides whether the app stays
 * usable at scale. Written in plain Node (no k6/artillery binary) so it runs
 * anywhere the backend runs, including CI.
 *
 *   npm run test:load
 *   LOAD_USERS=100 LOAD_DURATION_S=30 npm run test:load
 *
 * Reports p50/p95/p99 latency, throughput, and error breakdown per endpoint,
 * and exits non-zero if error rates or latency breach the thresholds below.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import axios, { AxiosInstance } from 'axios';
import prisma from '../config/db';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || '';
const API_CLIENT_SECRET = process.env.API_CLIENT_SECRET || '';

const CONCURRENT_USERS = Number(process.env.LOAD_USERS || 40);
const DURATION_S = Number(process.env.LOAD_DURATION_S || 15);

// Thresholds. Deliberately loose enough not to flake on a shared CI runner,
// tight enough that a real regression (an N+1 query, a missing index, a
// blocking call in a hot path) trips them.
const MAX_ERROR_RATE = 0.02; // 2%
const MAX_P95_MS = 2000;

if (!JWT_SECRET || !API_CLIENT_SECRET) {
  console.error('JWT_SECRET and API_CLIENT_SECRET must be set (they must match the running server).');
  process.exit(1);
}

const sortObjectKeys = (obj: any, depth = 0): any => {
  if (depth > 5) return obj;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((i) => sortObjectKeys(i, depth + 1));
  return Object.keys(obj).sort().reduce((acc: any, k) => { acc[k] = sortObjectKeys(obj[k], depth + 1); return acc; }, {});
};

const signedClient = (token: string): AxiosInstance => {
  const client = axios.create({ baseURL: BASE_URL, validateStatus: () => true, timeout: 20000 });
  client.interceptors.request.use((config) => {
    config.headers.Authorization = `Bearer ${token}`;
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    config.headers['x-api-timestamp'] = timestamp;
    config.headers['x-api-nonce'] = nonce;
    const body = config.data && Object.keys(config.data).length > 0 ? JSON.stringify(sortObjectKeys(config.data)) : '';
    config.headers['x-api-signature'] = crypto.createHmac('sha256', API_CLIENT_SECRET).update(body + timestamp + nonce).digest('hex');
    return config;
  });
  return client;
};

type Sample = { ms: number; status: number };
const results = new Map<string, Sample[]>();

const record = (endpoint: string, ms: number, status: number) => {
  const arr = results.get(endpoint);
  if (arr) arr.push({ ms, status });
  else results.set(endpoint, [{ ms, status }]);
};

const time = async (endpoint: string, fn: () => Promise<{ status: number }>) => {
  const started = Date.now();
  try {
    const res = await fn();
    record(endpoint, Date.now() - started, res.status);
  } catch {
    // A thrown request (timeout, socket error) is a failure, not a gap in the
    // data — record it as 0 so it counts against the error rate.
    record(endpoint, Date.now() - started, 0);
  }
};

const percentile = (sorted: number[], p: number) =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;

async function main() {
  console.log(`\x1b[1mAPI load test\x1b[0m — ${CONCURRENT_USERS} concurrent users for ${DURATION_S}s against ${BASE_URL}\n`);

  // Any HTTP response means the server is up — including a 429, which just
  // means a previous run exhausted the per-IP limiter. Only a connection
  // failure means "not running".
  const health = await axios.get(`${BASE_URL}/api/health`, { validateStatus: () => true, timeout: 5000 }).catch(() => null);
  if (!health) {
    console.error(`Server is not responding at ${BASE_URL}. Start it first.`);
    process.exit(1);
  }
  if (health.status === 429) {
    console.warn(
      '\x1b[33mWarning:\x1b[0m the per-IP rate limiter is already saturated, so these numbers will measure\n' +
      'the limiter rather than the API. Restart the server with a high RATE_LIMIT_GLOBAL_MAX\n' +
      '(e.g. RATE_LIMIT_GLOBAL_MAX=1000000) and flush Redis before a meaningful run.\n',
    );
  }

  const suffix = Date.now().toString(36);
  console.log(`Creating ${CONCURRENT_USERS} test users...`);
  const users = await Promise.all(
    Array.from({ length: CONCURRENT_USERS }, (_, i) =>
      prisma.user.create({
        data: {
          email: `load-${suffix}-${i}@test.local`,
          name: `Load User ${i}`,
          referralCode: `LD${suffix}${i}`,
          totalCoinsEarned: 500,
        },
      }),
    ),
  );

  const clients = users.map((u) => signedClient(jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '30d' })));

  // One "virtual user" loop: the request mix a real client actually makes.
  const runUser = async (client: AxiosInstance, deadline: number) => {
    // Real clients cache the config version and send it back, so all but the
    // first fetch short-circuits to a tiny {unchanged:true}. Modelling that
    // matters: always sending version=0 would measure a full payload rebuild
    // on every request, which no real client does.
    let cachedVersion = 0;
    while (Date.now() < deadline) {
      await time('GET /api/config/remote', async () => {
        const res = await client.get(`/api/config/remote?version=${cachedVersion}`);
        if (res.status === 200 && typeof res.data?.version === 'number') cachedVersion = res.data.version;
        return res;
      });
      await time('GET /api/users/profile', () => client.get('/api/users/profile'));
      await time('GET /api/shorts', () => client.get('/api/shorts'));
      await time('GET /api/news', () => client.get('/api/news'));
      await time('GET /api/users/leaderboard', () => client.get('/api/users/leaderboard'));
      await time('GET /api/marquee', () => client.get('/api/marquee'));
      await time('GET /api/users/missions/daily', () => client.get('/api/users/missions/daily'));
      await time('POST /api/users/activity', () => client.post('/api/users/activity', { screen: 'home' }));
    }
  };

  const deadline = Date.now() + DURATION_S * 1000;
  const startedAt = Date.now();
  console.log('Running...\n');
  await Promise.all(clients.map((c) => runUser(c, deadline)));
  const elapsedS = (Date.now() - startedAt) / 1000;

  // ── Report ────────────────────────────────────────────────────────────────
  let totalRequests = 0;
  let totalErrors = 0;
  let worstP95 = 0;
  const rows: string[] = [];

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(
    `\x1b[1m${pad('ENDPOINT', 34)}${pad('REQS', 8)}${pad('ERR', 7)}${pad('p50', 8)}${pad('p95', 8)}${pad('p99', 8)}${pad('max', 8)}\x1b[0m`,
  );
  console.log('─'.repeat(81));

  for (const [endpoint, samples] of [...results.entries()].sort()) {
    const latencies = samples.map((s) => s.ms).sort((a, b) => a - b);
    // 429 is the rate limiter doing its job under synthetic load from one IP,
    // not a server fault — count it separately so it doesn't mask real errors.
    const rateLimited = samples.filter((s) => s.status === 429).length;
    const errors = samples.filter((s) => s.status === 0 || s.status >= 500).length;
    const p95 = percentile(latencies, 95);
    worstP95 = Math.max(worstP95, p95);
    totalRequests += samples.length;
    totalErrors += errors;

    const errPct = ((errors / samples.length) * 100).toFixed(1);
    const color = errors > 0 ? '\x1b[31m' : '\x1b[32m';
    console.log(
      pad(endpoint, 34) +
        pad(String(samples.length), 8) +
        color + pad(`${errPct}%`, 7) + '\x1b[0m' +
        pad(`${percentile(latencies, 50)}ms`, 8) +
        pad(`${p95}ms`, 8) +
        pad(`${percentile(latencies, 99)}ms`, 8) +
        pad(`${latencies[latencies.length - 1] ?? 0}ms`, 8),
    );
    if (rateLimited > 0) rows.push(`  note: ${endpoint} — ${rateLimited} request(s) rate-limited (429)`);
  }

  rows.forEach((r) => console.log(r));

  const errorRate = totalRequests === 0 ? 0 : totalErrors / totalRequests;
  console.log('─'.repeat(81));
  console.log(`Total: ${totalRequests} requests in ${elapsedS.toFixed(1)}s — ${(totalRequests / elapsedS).toFixed(0)} req/s`);
  console.log(`Errors (5xx or dropped): ${totalErrors} (${(errorRate * 100).toFixed(2)}%)`);
  console.log(`Worst endpoint p95: ${worstP95}ms`);

  console.log('\nCleaning up test users...');
  const ids = users.map((u) => u.id);
  await prisma.errorLog.deleteMany({ where: { userId: { in: ids } } });
  await prisma.coinLedger.deleteMany({ where: { userId: { in: ids } } });
  await prisma.userMissions.deleteMany({ where: { userId: { in: ids } } });
  await prisma.userBadges.deleteMany({ where: { userId: { in: ids } } });
  await prisma.dailyUserStats.deleteMany({ where: { userId: { in: ids } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  // The fraud middleware flags these users itself: every virtual user shares
  // one IP, which is exactly the multi-account signal it exists to catch.
  await prisma.fraudIncident.deleteMany({ where: { userId: { in: ids } } });
  await prisma.deviceFingerprint.deleteMany({ where: { userId: { in: ids } } });
  await prisma.shortsSessions.deleteMany({ where: { userId: { in: ids } } });
  await prisma.withdrawal.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });

  const failures: string[] = [];
  if (errorRate > MAX_ERROR_RATE) failures.push(`error rate ${(errorRate * 100).toFixed(2)}% exceeds ${(MAX_ERROR_RATE * 100).toFixed(0)}%`);
  if (worstP95 > MAX_P95_MS) failures.push(`p95 ${worstP95}ms exceeds ${MAX_P95_MS}ms`);

  await prisma.$disconnect();

  if (failures.length > 0) {
    console.log(`\n\x1b[31m❌ Load test failed:\x1b[0m`);
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
  console.log(`\n\x1b[32m✅ Load test passed\x1b[0m — no server errors, p95 within budget.`);
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Load test crashed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
