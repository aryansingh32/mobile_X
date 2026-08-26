/**
 * seedAdConfig.ts
 *
 * Seeds all production AdMob config values and reward rules into the database.
 * Run with: npx ts-node src/scripts/seedAdConfig.ts
 *
 * Safe to re-run: uses upsert for all records.
 */
import prisma from '../config/db';

const ADMOB_CONFIGS: Array<{ key: string; value: string }> = [
  { key: 'admob_android_app_id',                        value: 'ca-app-pub-9240675969662866~4205304049' },
  { key: 'admob_android_app_open_ad_unit_id',           value: 'ca-app-pub-9240675969662866/5553667433' },
  { key: 'admob_android_rewarded_card_ad_unit_id',      value: 'ca-app-pub-9240675969662866/6567366204' },
  { key: 'admob_android_rewarded_discover_ad_unit_id',  value: 'ca-app-pub-9240675969662866/6567366204' },
  { key: 'admob_android_rewarded_interstitial_card_ad_unit_id', value: 'ca-app-pub-9240675969662866/4433368900' },
  { key: 'admob_android_game_completion_ad_unit_id',    value: 'ca-app-pub-9240675969662866/6020571295' },
  { key: 'admob_android_interstitial_nav_ad_unit_id',   value: 'ca-app-pub-9240675969662866/6020571295' },
  { key: 'admob_android_wallet_interstitial_ad_unit_id', value: 'ca-app-pub-9240675969662866/6020571295' },
  { key: 'admob_android_native_ad_unit_id',             value: 'ca-app-pub-9240675969662866/4679569467' },
  { key: 'admob_android_news_banner_ad_unit_id',        value: 'ca-app-pub-9240675969662866/9296637173' },
];

const AD_REWARD_RULES = [
  {
    adType: 'REWARDED',
    coinsAwarded: 100,
    dailyCapForType: 15,
    cooldownSeconds: 45,
    enabled: true,
    requiresFullWatch: true,
  },
  {
    adType: 'REWARDED_INTERSTITIAL',
    coinsAwarded: 50,
    dailyCapForType: 20,
    cooldownSeconds: 30,
    enabled: true,
    requiresFullWatch: true,
  },
  {
    adType: 'REWARDED_DISCOVER',
    coinsAwarded: 50,
    dailyCapForType: 20,
    cooldownSeconds: 30,
    enabled: true,
    requiresFullWatch: true,
  },
  {
    adType: 'ROULETTE_AD',
    // Was 0 ("reward is extra roulette spin, not direct coins") — but
    // addLedgerEntry() rejects zero-amount writes, so no CoinLedger row was
    // ever created for this ad type, which meant the daily cap check and the
    // "extra chances" count in claimRouletteSpin (both COUNT this source from
    // CoinLedger) silently never worked. A small real coin reward is fully
    // compliant (it's a deterministic reward for a completed ad, same as any
    // other rewarded-ad type) and fixes the counting; the spin OUTCOME itself
    // stays fully decoupled from coins — see claimRouletteSpin.
    coinsAwarded: 5,
    dailyCapForType: 5,
    cooldownSeconds: 30,
    enabled: true,
    requiresFullWatch: true,
  },
];

const AD_PLACEMENTS = [
  {
    key: 'discover_feed_sponsored_card',
    screen: 'DISCOVER',
    adFormat: 'REWARDED',
    enabled: true,
    intervalMin: 4,
    intervalMax: 8,
    cooldownSeconds: 45,
    maxPerSession: 15,
    skipFirstNActions: 2,
    adUnitKey: 'REWARDED_DISCOVER',
  },
  {
    key: 'shorts_feed_interstitial',
    screen: 'SHORTS',
    adFormat: 'REWARDED_INTERSTITIAL',
    enabled: true,
    intervalMin: 6,
    intervalMax: 12,
    cooldownSeconds: 60,
    maxPerSession: 10,
    skipFirstNActions: 3,
    adUnitKey: 'REWARDED_INTERSTITIAL_SHORTS',
  },
  {
    key: 'shorts_feed_rewarded_card',
    screen: 'SHORTS',
    adFormat: 'REWARDED',
    enabled: true,
    intervalMin: 5,
    intervalMax: 8,
    cooldownSeconds: 45,
    maxPerSession: 6,
    skipFirstNActions: 2,
    adUnitKey: 'REWARDED',
  },
  {
    key: 'app_open',
    screen: 'GLOBAL',
    adFormat: 'APP_OPEN',
    enabled: true,
    intervalMin: 1,
    intervalMax: 1,
    cooldownSeconds: 300,
    maxPerSession: 3,
    skipFirstNActions: 0,
    adUnitKey: 'APP_OPEN',
  },
  {
    key: 'game_completion_interstitial',
    screen: 'GAMES',
    adFormat: 'INTERSTITIAL',
    enabled: true,
    intervalMin: 1,
    intervalMax: 1,
    cooldownSeconds: 120,
    maxPerSession: 6,
    skipFirstNActions: 0,
    adUnitKey: 'GAME_COMPLETION',
  },
  {
    key: 'news_article_banner',
    screen: 'ARTICLE_DETAIL',
    adFormat: 'BANNER',
    enabled: true,
    intervalMin: 1,
    intervalMax: 1,
    cooldownSeconds: 0,
    maxPerSession: 20,
    skipFirstNActions: 0,
    adUnitKey: 'NEWS_BANNER',
  },
  {
    key: 'nav_transition_interstitial',
    screen: 'GLOBAL',
    adFormat: 'INTERSTITIAL',
    enabled: true,
    intervalMin: 5,
    intervalMax: 8,
    cooldownSeconds: 120,
    maxPerSession: 5,
    skipFirstNActions: 2,
    adUnitKey: 'INTERSTITIAL_NAV',
  },
  {
    key: 'home_sponsored_card',
    screen: 'HOME',
    adFormat: 'REWARDED',
    enabled: true,
    intervalMin: 1,
    intervalMax: 1,
    cooldownSeconds: 86400,
    maxPerSession: 1,
    skipFirstNActions: 0,
    adUnitKey: 'REWARDED',
  },
  {
    key: 'wallet_interstitial',
    screen: 'WALLET',
    adFormat: 'INTERSTITIAL',
    enabled: true,
    intervalMin: 1,
    intervalMax: 1,
    cooldownSeconds: 30,
    maxPerSession: 10,
    skipFirstNActions: 0,
    adUnitKey: 'WALLET_INTERSTITIAL',
  },
];

const DAILY_CAP_POLICY = {
  tier: 'DEFAULT',
  maxAdsPerDay: 40,
  maxCoinsPerDay: 4000,
  minCooldownSeconds: 30,
};

const FEATURE_FLAGS = [
  { key: 'haptics_enabled', category: 'HAPTICS', enabled: true, rolloutPercent: 100, description: 'Master haptic feedback toggle' },
  { key: 'haptics_navigation', category: 'HAPTICS', enabled: true, rolloutPercent: 100, description: 'Haptics on navigation actions' },
  { key: 'haptics_ad_reward', category: 'HAPTICS', enabled: true, rolloutPercent: 100, description: 'Haptics on ad reward events' },
  { key: 'coin_rain_animation', category: 'ANIMATION', enabled: true, rolloutPercent: 100, description: 'Coin rain celebration animation' },
  { key: 'show_news_source', category: 'EXPERIMENTAL', enabled: true, rolloutPercent: 100, description: 'Show news source name on cards' },
  { key: 'enable_crypto_withdrawals', category: 'EXPERIMENTAL', enabled: false, rolloutPercent: 0, description: 'Enable crypto withdrawal option' },
  { key: 'nav_ads_enabled', category: 'EXPERIMENTAL', enabled: true, rolloutPercent: 100, description: 'Navigation transition interstitials' },
  { key: 'maintenance_mode', category: 'KILL_SWITCH', enabled: false, rolloutPercent: 0, description: 'Emergency maintenance mode flag' },
];


async function main() {
  console.log('🚀 Seeding AdMob config...');

  // 1. Upsert AdMob config keys
  for (const config of ADMOB_CONFIGS) {
    await prisma.appConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: { key: config.key, value: config.value },
    });
    console.log(`  ✓ ${config.key}`);
  }

  // 2. Upsert ad reward rules
  console.log('\n📋 Seeding ad reward rules...');
  for (const rule of AD_REWARD_RULES) {
    await prisma.adRewardRule.upsert({
      where: { adType: rule.adType },
      update: rule,
      create: rule,
    });
    console.log(`  ✓ ${rule.adType} → ${rule.coinsAwarded} coins`);
  }

  // 3. Upsert daily cap policy
  console.log('\n🔒 Seeding daily cap policy...');
  await prisma.dailyCapPolicy.upsert({
    where: { tier: DAILY_CAP_POLICY.tier },
    update: DAILY_CAP_POLICY,
    create: DAILY_CAP_POLICY,
  });
  console.log(`  ✓ DEFAULT policy`);

  // 4. Upsert ad placements
  console.log('\n📍 Seeding ad placements...');
  for (const placement of AD_PLACEMENTS) {
    await prisma.adPlacement.upsert({
      where: { key: placement.key },
      update: placement,
      create: placement,
    });
    console.log(`  ✓ ${placement.key}`);
  }

  // 5. Upsert feature flags
  console.log('\n🏳️ Seeding feature flags...');
  for (const flag of FEATURE_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: flag,
      create: flag,
    });
    console.log(`  ✓ ${flag.key} = ${flag.enabled}`);
  }

  // 6. Bump config version so all clients get a fresh sync
  console.log('\n🔄 Bumping config version...');
  const current = await prisma.appConfig.findUnique({ where: { key: 'config_version' } });
  const newVersion = (parseInt(current?.value || '0') || 0) + 1;
  await prisma.appConfig.upsert({
    where: { key: 'config_version' },
    update: { value: String(newVersion) },
    create: { key: 'config_version', value: String(newVersion) },
  });
  console.log(`  ✓ Config version bumped to ${newVersion}`);

  console.log('\n✅ Ad config seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
