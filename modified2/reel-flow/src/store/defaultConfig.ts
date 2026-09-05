import { RemoteConfigPayload } from '../store/useConfigStore';

// ─────────────────────────────────────────────────────────
// PRODUCTION AD UNIT IDs
// These are bundled as a safe fallback so ads work on first launch
// before the remote config is fetched. They are overridden by the
// server's remote config once available.
// ─────────────────────────────────────────────────────────
const PROD_AD_UNITS = {
  APP_OPEN:                      { android: 'ca-app-pub-9240675969662866/5553667433' },
  REWARDED:                      { android: 'ca-app-pub-9240675969662866/6567366204' },
  REWARDED_CARD:                 { android: 'ca-app-pub-9240675969662866/6567366204' },
  REWARDED_DISCOVER:             { android: 'ca-app-pub-9240675969662866/6567366204' },
  REWARDED_INTERSTITIAL:         { android: 'ca-app-pub-9240675969662866/4433368900' },
  REWARDED_INTERSTITIAL_CARD:    { android: 'ca-app-pub-9240675969662866/4433368900' },
  REWARDED_INTERSTITIAL_SHORTS:  { android: 'ca-app-pub-9240675969662866/4433368900' },
  GAME_COMPLETION:               { android: 'ca-app-pub-9240675969662866/6020571295' },
  INTERSTITIAL_NAV:              { android: 'ca-app-pub-9240675969662866/6020571295' },
  WALLET_INTERSTITIAL:           { android: 'ca-app-pub-9240675969662866/6020571295' },
  NATIVE:                        { android: 'ca-app-pub-9240675969662866/4679569467' },
  NATIVE_DISCOVER:               { android: 'ca-app-pub-9240675969662866/4679569467' },
  NEWS_BANNER:                   { android: 'ca-app-pub-9240675969662866/9296637173' },
  BANNER_ARTICLE:                { android: 'ca-app-pub-9240675969662866/9296637173' },
};

export const BUNDLED_DEFAULT_CONFIG: RemoteConfigPayload = {
  version: 0,
  adUnits: PROD_AD_UNITS,
  adMobAppIds: {
    android: 'ca-app-pub-9240675969662866~4205304049',
  },
  adPlacements: {
    discover_feed_sponsored_card: {
      screen: 'DISCOVER',
      adFormat: 'REWARDED',
      enabled: true,
      intervalMin: 4,
      intervalMax: 8,
      cooldownSeconds: 45,
      maxPerSession: 15,
      skipFirstNActions: 2,
      // FIX: was 'NATIVE_DISCOVER' which mapped to native ads, not rewarded.
      // Discover cards use rewarded ads — use REWARDED_DISCOVER for proper tracking.
      adUnitKey: 'REWARDED_DISCOVER',
    },
    shorts_feed_interstitial: {
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
    shorts_feed_rewarded_card: {
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
    app_open: {
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
    game_completion_interstitial: {
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
    news_article_banner: {
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
    nav_transition_interstitial: {
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
    home_sponsored_card: {
      screen: 'HOME',
      adFormat: 'REWARDED',
      enabled: true,
      intervalMin: 1,
      intervalMax: 1,
      cooldownSeconds: 86400, // Once per day per session tracking
      maxPerSession: 1,
      skipFirstNActions: 0,
      adUnitKey: 'REWARDED',
    },
    wallet_interstitial: {
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
    wallet_rewarded_card: {
      screen: 'WALLET',
      adFormat: 'REWARDED',
      enabled: true,
      intervalMin: 1,
      intervalMax: 1,
      cooldownSeconds: 45,
      maxPerSession: 8,
      skipFirstNActions: 0,
      adUnitKey: 'REWARDED_CARD',
    },
  },
  adRewardRules: {
    REWARDED: {
      coinsAwarded: 100,
      dailyCapForType: 15,
      cooldownSeconds: 45,
      enabled: true,
      requiresFullWatch: true,
    },
    REWARDED_INTERSTITIAL: {
      coinsAwarded: 50,
      dailyCapForType: 20,
      cooldownSeconds: 30,
      enabled: true,
      requiresFullWatch: true,
    },
    REWARDED_DISCOVER: {
      coinsAwarded: 50,
      dailyCapForType: 20,
      cooldownSeconds: 30,
      enabled: true,
      requiresFullWatch: true,
    },
    // FIX: Added ROULETTE_AD rule so roulette ad reward claims succeed
    ROULETTE_AD: {
      coinsAwarded: 0, // Roulette spin is the reward, not direct coins
      dailyCapForType: 5,
      cooldownSeconds: 30,
      enabled: true,
      requiresFullWatch: true,
    },
  },
  dailyCapPolicies: {
    DEFAULT: {
      maxAdsPerDay: 40,
      maxCoinsPerDay: 4000,
      minCooldownSeconds: 30,
    }
  },
  contentStrings: {
    'home.hero.title': 'Discover the Unexpected.',
    'home.hero.subtitle': 'Curated micro-experiences for your daily commute.',
    'rewards.title': 'Your Earnings',
    'rewards.subtitle': 'Watch ads. Complete missions. Cash out real money.',
    'wallet.balance_label': 'Current Balance',
    'wallet.withdraw_btn': 'Withdraw Funds',
    'discover.sponsored_tag': 'Sponsored Content',
    'home.missions.title': "Today's Missions",
    'home.missions.empty': 'New missions arrive at midnight.',
    'home.games.title': 'Play Games',
    'home.games.subtitle': 'Fast HTML5 arcade games',
    'home.referral.title': 'Invite & Earn',
    'home.referral.body': "Earn 10% of your friends' withdrawals forever!",
    'home.referral.button': 'Share Code',
  },
  featureFlags: {
    haptics_enabled: true,
    haptics_navigation: true,
    haptics_ad_reward: true,
    haptics_welcome: false,       // OFF by default — reduces excessive vibration on first launch
    haptics_onboarding: false,    // OFF by default — reduces excessive vibration during onboarding
    coin_rain_animation: true,
    show_news_source: true,
    enable_crypto_withdrawals: false,
    // Nav interstitials enabled by default
    nav_ads_enabled: true,
    maintenance_mode: false,
    affiliate_store_enabled: false,
  },
  screenSections: {
    HOME: [
      { sectionKey: 'HERO', enabled: true, sortOrder: 0, layoutVariant: 'default' },
      { sectionKey: 'TRENDING', enabled: true, sortOrder: 1, layoutVariant: 'grid' },
      { sectionKey: 'MISSIONS', enabled: true, sortOrder: 2, layoutVariant: 'list' }
    ]
  }
};
