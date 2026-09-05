import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seedAppConfig() {
  const configs = [
    { key: 'daily_ad_cap', value: '20' },
    { key: 'daily_bonus_coins', value: '20' },
    { key: 'ad_cooldown_seconds', value: '60' },
    { key: 'min_withdrawal_coins', value: '500' },
    { key: 'coin_to_inr_rate', value: '0.10' },
    { key: 'referral_percent', value: '10' },
    // Ad-farming guard (see reportAdEvent in configController.ts): if a
    // user's ratio of dismissed/abandoned rewarded ads vs earned rewards
    // crosses ad_farming_abandon_threshold (within a rolling window of
    // ad_farming_window_minutes, once at least ad_farming_min_sample events
    // have happened), the client is told to back off from showing more ads
    // for an escalating penalty window, up to ad_farming_penalty_max_seconds.
    // This exists specifically to avoid AdMob "invalid traffic" / ad-farming
    // policy bans — repeatedly requesting/loading rewarded ads without
    // genuine engagement is exactly the pattern AdMob flags account-wide.
    { key: 'ad_farming_window_minutes', value: '60' },
    { key: 'ad_farming_min_sample', value: '5' },
    { key: 'ad_farming_abandon_threshold', value: '0.6' },
    { key: 'ad_farming_penalty_base_seconds', value: '300' },
    { key: 'ad_farming_penalty_max_seconds', value: '1800' },
    { key: 'ad_farming_fraud_sample', value: '10' },
    { key: 'ad_farming_fraud_threshold', value: '0.85' },
    { key: 'max_level', value: '50' },
    { key: 'xp_per_level', value: '100' },
    { key: 'streak_bonus_multiplier', value: '5' },
    { key: 'ad_rewarded_coins', value: '100' },
    { key: 'ad_rewarded_interstitial_coins', value: '50' },
    { key: 'ad_rewarded_discover_coins', value: '50' },
    { key: 'xp_per_coin_ratio', value: '2' },
    { key: 'streak_bonus_7', value: '100' },
    { key: 'streak_bonus_30', value: '500' },
    { key: 'config_version', value: '1' },
    { key: 'session_grace_period_seconds', value: '30' },
    { key: 'admob_android_app_id', value: 'ca-app-pub-9240675969662866~4205304049' },
    { key: 'admob_android_app_open_ad_unit_id', value: 'ca-app-pub-9240675969662866/5553667433' },
    { key: 'admob_android_rewarded_card_ad_unit_id', value: 'ca-app-pub-9240675969662866/6567366204' },
    { key: 'admob_android_rewarded_discover_ad_unit_id', value: 'ca-app-pub-9240675969662866/6567366204' },
    { key: 'admob_android_rewarded_interstitial_card_ad_unit_id', value: 'ca-app-pub-9240675969662866/4433368900' },
    { key: 'admob_android_game_completion_ad_unit_id', value: 'ca-app-pub-9240675969662866/6020571295' },
    { key: 'admob_android_interstitial_nav_ad_unit_id', value: 'ca-app-pub-9240675969662866/6020571295' },
    { key: 'admob_android_wallet_interstitial_ad_unit_id', value: 'ca-app-pub-9240675969662866/6020571295' },
    { key: 'admob_android_native_ad_unit_id', value: 'ca-app-pub-9240675969662866/4679569467' },
    { key: 'admob_android_news_banner_ad_unit_id', value: 'ca-app-pub-9240675969662866/9296637173' },
    { key: 'roulette_daily_chances', value: '2' },
  ];
  for (const c of configs) {
    await prisma.appConfig.upsert({ where: { key: c.key }, update: {}, create: c });
  }
  console.log(`Seeded ${configs.length} AppConfig entries`);
}

async function seedAdRewardRules() {
  const rules = [
    { adType: 'REWARDED', coinsAwarded: 100, dailyCapForType: 8, cooldownSeconds: 60 },
    { adType: 'REWARDED_INTERSTITIAL', coinsAwarded: 50, dailyCapForType: 8, cooldownSeconds: 45 },
    { adType: 'REWARDED_DISCOVER', coinsAwarded: 50, dailyCapForType: 8, cooldownSeconds: 45 },
    { adType: 'ROULETTE_AD', coinsAwarded: 0, dailyCapForType: 10, cooldownSeconds: 30 },
  ];
  for (const r of rules) {
    await prisma.adRewardRule.upsert({
      where: { adType: r.adType },
      update: {},
      create: r,
    });
  }
  console.log(`Seeded ${rules.length} AdRewardRule entries`);
}

async function seedDailyCapPolicies() {
  const policies = [
    { tier: 'DEFAULT', maxAdsPerDay: 20, maxCoinsPerDay: 1200, minCooldownSeconds: 45 },
    { tier: 'NEW_USER', maxAdsPerDay: 10, maxCoinsPerDay: 600, minCooldownSeconds: 60 },
    { tier: 'HIGH_TRUST', maxAdsPerDay: 25, maxCoinsPerDay: 1500, minCooldownSeconds: 40 },
    { tier: 'LOW_TRUST', maxAdsPerDay: 5, maxCoinsPerDay: 250, minCooldownSeconds: 120 },
  ];
  for (const p of policies) {
    await prisma.dailyCapPolicy.upsert({
      where: { tier: p.tier },
      update: {},
      create: p,
    });
  }
  console.log(`Seeded ${policies.length} DailyCapPolicy entries`);
}

async function seedAdPlacements() {
  const placements = [
    {
      key: 'discover_feed_sponsored_card', screen: 'DISCOVER', adFormat: 'REWARDED',
      intervalMin: 3, intervalMax: 6, cooldownSeconds: 45, maxPerSession: 8,
      skipFirstNActions: 2, adUnitKey: 'REWARDED_DISCOVER',
      titleKey: 'ad_card.discover.title', descriptionKey: 'ad_card.discover.description',
      ctaLabelKey: 'ad_card.discover.cta',
    },
    {
      key: 'shorts_feed_interstitial', screen: 'SHORTS', adFormat: 'REWARDED_INTERSTITIAL',
      intervalMin: 6, intervalMax: 9, cooldownSeconds: 60, maxPerSession: 6,
      skipFirstNActions: 3, adUnitKey: 'REWARDED_INTERSTITIAL',
    },
    {
      key: 'shorts_feed_rewarded_card', screen: 'SHORTS', adFormat: 'REWARDED',
      intervalMin: 5, intervalMax: 8, cooldownSeconds: 45, maxPerSession: 6,
      skipFirstNActions: 2, adUnitKey: 'REWARDED',
      titleKey: 'ad_card.shorts.title', descriptionKey: 'ad_card.shorts.description',
      ctaLabelKey: 'ad_card.shorts.cta',
    },
    {
      key: 'nav_transition_interstitial', screen: 'GLOBAL', adFormat: 'INTERSTITIAL',
      intervalMin: 4, intervalMax: 8, cooldownSeconds: 120, maxPerSession: 3,
      skipFirstNActions: 3, adUnitKey: 'INTERSTITIAL_NAV',
    },
    {
      key: 'app_open', screen: 'GLOBAL', adFormat: 'APP_OPEN',
      intervalMin: 1, intervalMax: 1, cooldownSeconds: 300, maxPerSession: 3,
      skipFirstNActions: 0, adUnitKey: 'APP_OPEN',
    },
    {
      key: 'game_completion_interstitial', screen: 'GAMES', adFormat: 'INTERSTITIAL',
      intervalMin: 1, intervalMax: 1, cooldownSeconds: 120, maxPerSession: 6,
      skipFirstNActions: 0, adUnitKey: 'GAME_COMPLETION',
    },
    {
      key: 'news_article_banner', screen: 'ARTICLE_DETAIL', adFormat: 'BANNER',
      intervalMin: 1, intervalMax: 1, cooldownSeconds: 0, maxPerSession: 20,
      skipFirstNActions: 0, adUnitKey: 'NEWS_BANNER',
    },
    {
      key: 'wallet_interstitial', screen: 'WALLET', adFormat: 'INTERSTITIAL',
      intervalMin: 1, intervalMax: 1, cooldownSeconds: 30, maxPerSession: 10,
      skipFirstNActions: 0, adUnitKey: 'WALLET_INTERSTITIAL',
    },
  ];
  for (const p of placements) {
    await prisma.adPlacement.upsert({
      where: { key: p.key },
      update: {},
      create: p,
    });
  }
  console.log(`Seeded ${placements.length} AdPlacement entries`);
}

async function seedFeatureFlags() {
  const flags = [
    { key: 'haptics_enabled', category: 'HAPTICS', enabled: true, description: 'Master switch for all haptic feedback app-wide' },
    { key: 'haptics_ad_reward', category: 'HAPTICS', enabled: true, description: 'Haptic on successful ad reward' },
    { key: 'haptics_navigation', category: 'HAPTICS', enabled: true, description: 'Haptic on tab switches' },
    { key: 'coin_rain_enabled', category: 'ANIMATION', enabled: true, description: 'Particle celebration on coin reward' },
    { key: 'coin_counter_animation_enabled', category: 'ANIMATION', enabled: true, description: 'Animated counting for coin display' },
    { key: 'card_press_animation_enabled', category: 'ANIMATION', enabled: true, description: 'Scale animation on card press' },
    { key: 'splash_animation_enabled', category: 'ANIMATION', enabled: true, description: 'Animated splash screen sequence' },
    { key: 'cash_withdrawal_enabled', category: 'KILL_SWITCH', enabled: true, description: 'Emergency disable for UPI/cash redemption — keep gift cards running' },
    { key: 'nav_ads_enabled', category: 'EXPERIMENTAL', enabled: false, description: 'Show interstitial ads on tab navigation (conservative)' },
  ];
  for (const f of flags) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: {},
      create: f,
    });
  }
  console.log(`Seeded ${flags.length} FeatureFlag entries`);
}

async function seedContentStrings() {
  const strings = [
    // Splash
    { key: 'splash.tagline', screen: 'SPLASH', value: 'Your screen time, finally rewarded.', description: 'Splash screen tagline' },
    { key: 'splash.subtitle', screen: 'SPLASH', value: 'Watch sponsored videos to earn real rewards.', description: 'Splash screen subtitle' },
    // Auth
    { key: 'auth.tagline', screen: 'AUTH', value: 'Your screen time, finally rewarded.', description: 'Auth screen tagline' },
    { key: 'auth.button', screen: 'AUTH', value: 'Continue with Google →', description: 'Auth sign-in button label' },
    { key: 'auth.subtext', screen: 'AUTH', value: 'Takes less than 10 seconds', description: 'Auth button subtext' },
    { key: 'auth.trust_1', screen: 'AUTH', value: '✓ Trusted users', description: 'Auth trust bullet 1' },
    { key: 'auth.trust_2', screen: 'AUTH', value: '✓ Instant Google login', description: 'Auth trust bullet 2' },
    { key: 'auth.trust_3', screen: 'AUTH', value: '✓ Real coin rewards', description: 'Auth trust bullet 3' },
    { key: 'auth.trust_4', screen: 'AUTH', value: '✓ UPI/vouchers', description: 'Auth trust bullet 4' },
    // Home
    { key: 'home.explore.shorts.title', screen: 'HOME', value: 'Watch Shorts', description: 'Home shortcut card title for Shorts' },
    { key: 'home.explore.shorts.subtitle', screen: 'HOME', value: 'Reward opportunities available', description: 'Home shortcut card subtitle for Shorts' },
    { key: 'home.explore.news.title', screen: 'HOME', value: 'Discover News', description: 'Home shortcut card title for News' },
    { key: 'home.explore.news.subtitle', screen: 'HOME', value: 'Sponsored content inside', description: 'Home shortcut card subtitle for News' },
    { key: 'home.explore.tasks.title', screen: 'HOME', value: 'Complete Tasks', description: 'Home shortcut card title for Tasks' },
    { key: 'home.explore.tasks.subtitle', screen: 'HOME', value: 'Earn by completing offers', description: 'Home shortcut card subtitle for Tasks' },
    { key: 'home.daily_bonus.title', screen: 'HOME', value: 'Daily Bonus', description: 'Daily bonus card title' },
    { key: 'home.daily_bonus.cta', screen: 'HOME', value: 'Claim Now', description: 'Daily bonus claim button' },
    { key: 'home.missions.title', screen: 'HOME', value: "Today's Missions", description: 'Missions section title' },
    { key: 'home.games.title', screen: 'HOME', value: 'Play Games', description: 'Games section title' },
    { key: 'home.referral.title', screen: 'HOME', value: 'Invite & Earn', description: 'Referral banner title' },
    { key: 'home.referral.subtitle', screen: 'HOME', value: 'Share your code with friends', description: 'Referral banner subtitle' },
    // Discover
    { key: 'discover.tooltip.body', screen: 'DISCOVER', value: 'Scroll through news. Reward videos appear as you browse.', description: 'Discover tab tooltip text' },
    // Shorts
    { key: 'shorts.tooltip.body', screen: 'SHORTS', value: 'Watch shorts. Sponsored reward videos appear occasionally.', description: 'Shorts tab tooltip text' },
    // Ad Cards
    { key: 'ad_card.discover.title', screen: 'DISCOVER', value: '🎁 Sponsored', description: 'Discover ad card title' },
    { key: 'ad_card.discover.description', screen: 'DISCOVER', value: 'Watch a short sponsored video', description: 'Discover ad card description' },
    { key: 'ad_card.discover.cta', screen: 'DISCOVER', value: '▶ Watch & Earn', description: 'Discover ad card CTA' },
    { key: 'ad_card.shorts.title', screen: 'SHORTS', value: '⭐ REWARD BREAK', description: 'Shorts ad card title' },
    { key: 'ad_card.shorts.description', screen: 'SHORTS', value: 'Watch a short sponsored video to earn coins', description: 'Shorts ad card body' },
    { key: 'ad_card.shorts.cta', screen: 'SHORTS', value: '▶ Watch & Earn', description: 'Shorts ad card CTA' },
    // Wallet
    { key: 'wallet.hero.title', screen: 'WALLET', value: 'Your Wallet', description: 'Wallet hero section title' },
    { key: 'wallet.min_redeem', screen: 'WALLET', value: 'Min redemption:', description: 'Wallet min redemption label' },
    // Global
    { key: 'global.ads_remaining', screen: 'GLOBAL', value: 'Reward videos remaining today', description: 'Label for ads remaining counter' },
  ];
  for (const s of strings) {
    await prisma.contentString.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log(`Seeded ${strings.length} ContentString entries`);
}

async function seedScreenSections() {
  const sections = [
    { screen: 'HOME', sectionKey: 'hero_card', sortOrder: 0 },
    { screen: 'HOME', sectionKey: 'daily_bonus', sortOrder: 1 },
    { screen: 'HOME', sectionKey: 'explore_grid', sortOrder: 2 },
    { screen: 'HOME', sectionKey: 'missions', sortOrder: 3 },
    { screen: 'HOME', sectionKey: 'games', sortOrder: 4 },
    { screen: 'HOME', sectionKey: 'referral_banner', sortOrder: 5 },
    { screen: 'HOME', sectionKey: 'streak_row', sortOrder: 6 },
    { screen: 'EARN', sectionKey: 'tasks', sortOrder: 0 },
    { screen: 'EARN', sectionKey: 'daily', sortOrder: 1 },
    { screen: 'EARN', sectionKey: 'referrals', sortOrder: 2 },
    { screen: 'WALLET', sectionKey: 'hero', sortOrder: 0 },
    { screen: 'WALLET', sectionKey: 'catalog', sortOrder: 1 },
    { screen: 'WALLET', sectionKey: 'history', sortOrder: 2 },
    { screen: 'WALLET', sectionKey: 'suggest', sortOrder: 3 },
  ];
  for (const s of sections) {
    await prisma.screenSection.upsert({
      where: { screen_sectionKey: { screen: s.screen, sectionKey: s.sectionKey } },
      update: {},
      create: s,
    });
  }
  console.log(`Seeded ${sections.length} ScreenSection entries`);
}

async function main() {
  await seedAppConfig();
  await seedAdRewardRules();
  await seedDailyCapPolicies();
  await seedAdPlacements();
  await seedFeatureFlags();
  await seedContentStrings();
  await seedScreenSections();
  console.log('✅ All seed data complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
