import { useConfigStore } from '../useConfigStore';

/**
 * The remote config payload is cast straight off the network with no schema
 * validation (api/config.ts), and whatever lands in this store is persisted to
 * AsyncStorage. So a single malformed response must not be able to corrupt the
 * store and brick the app across restarts — these tests pin that guarantee.
 */

const validPayload = {
  version: 7,
  adUnits: { REWARDED: { android: 'ca-app-pub-x/1' } },
  adMobAppIds: { android: 'ca-app-pub-x~1' },
  adPlacements: {
    shorts_feed_rewarded_card: {
      screen: 'SHORTS', adFormat: 'REWARDED', enabled: true,
      intervalMin: 3, intervalMax: 6, cooldownSeconds: 30,
      maxPerSession: 10, skipFirstNActions: 1, adUnitKey: 'REWARDED',
    },
  },
  adRewardRules: { REWARDED: { coins: 5, xp: 2 } },
  dailyCapPolicies: { DEFAULT: { maxCoinsPerDay: 1000, minCooldownSeconds: 30 } },
  contentStrings: { 'wallet.balance_label': 'Current Balance' },
  featureFlags: { maintenance_mode: false, games_enabled: true },
  screenSections: {
    HOME: [
      { sectionKey: 'missions', enabled: true, sortOrder: 2, layoutVariant: 'default' },
      { sectionKey: 'streak', enabled: true, sortOrder: 1, layoutVariant: 'default' },
      { sectionKey: 'hidden', enabled: false, sortOrder: 0, layoutVariant: 'default' },
    ],
  },
} as any;

const resetStore = () => {
  useConfigStore.setState({
    version: 0,
    adPlacements: {},
    adUnits: {},
    adMobAppIds: undefined,
    adRewardRules: {},
    dailyCapPolicies: {},
    contentStrings: {},
    featureFlags: {},
    screenSections: {},
    lastFetchedAt: 0,
  });
};

beforeEach(resetStore);

describe('useConfigStore — applying a remote config payload', () => {
  it('stores a well-formed payload', () => {
    useConfigStore.getState().setConfig(validPayload);
    const s = useConfigStore.getState();
    expect(s.version).toBe(7);
    expect(s.getContent('wallet.balance_label', 'fallback')).toBe('Current Balance');
    expect(s.getPlacement('shorts_feed_rewarded_card')?.adUnitKey).toBe('REWARDED');
    expect(s.getRewardRule('REWARDED')).toEqual({ coins: 5, xp: 2 });
  });

  it('records when it last fetched, which drives the refresh interval', () => {
    const before = Date.now();
    useConfigStore.getState().setConfig(validPayload);
    expect(useConfigStore.getState().lastFetchedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('useConfigStore — surviving a malformed payload', () => {
  it('keeps the previous config when the server sends nulls instead of maps', () => {
    useConfigStore.getState().setConfig(validPayload);
    useConfigStore.getState().setConfig({
      version: 8,
      adPlacements: null, contentStrings: null, featureFlags: null,
      adRewardRules: null, dailyCapPolicies: null, screenSections: null, adUnits: null,
    } as any);

    const s = useConfigStore.getState();
    // The good values survive rather than being replaced with undefined.
    expect(s.getContent('wallet.balance_label', 'fallback')).toBe('Current Balance');
    expect(s.getPlacement('shorts_feed_rewarded_card')).toBeDefined();
  });

  it('does not throw on lookups after an entirely empty payload', () => {
    useConfigStore.getState().setConfig({} as any);
    const s = useConfigStore.getState();
    expect(() => s.getPlacement('anything')).not.toThrow();
    expect(() => s.getContent('anything', 'fb')).not.toThrow();
    expect(() => s.getSections('HOME')).not.toThrow();
    expect(s.getContent('anything', 'fb')).toBe('fb');
  });

  it('ignores arrays sent where an object map is expected', () => {
    useConfigStore.getState().setConfig(validPayload);
    useConfigStore.getState().setConfig({ ...validPayload, contentStrings: ['not', 'a', 'map'] } as any);
    expect(useConfigStore.getState().getContent('wallet.balance_label', 'fallback')).toBe('Current Balance');
  });

  it('keeps the old version number when the server omits it', () => {
    useConfigStore.getState().setConfig(validPayload);
    useConfigStore.getState().setConfig({ contentStrings: {} } as any);
    expect(useConfigStore.getState().version).toBe(7);
  });

  it('does not throw when persisted state predates a field entirely', () => {
    // Simulates an app upgrade reading storage written by an older version.
    useConfigStore.setState({ contentStrings: undefined, adPlacements: undefined, screenSections: undefined } as any);
    const s = useConfigStore.getState();
    expect(s.getContent('k', 'fb')).toBe('fb');
    expect(s.getPlacement('k')).toBeUndefined();
    expect(s.getSections('HOME')).toEqual([]);
  });
});

describe('useConfigStore — feature flags', () => {
  it('returns the configured value when the flag exists', () => {
    useConfigStore.getState().setConfig(validPayload);
    expect(useConfigStore.getState().getFlag('games_enabled')).toBe(true);
    expect(useConfigStore.getState().getFlag('maintenance_mode')).toBe(false);
  });

  it('falls back when a flag is absent, defaulting to enabled', () => {
    expect(useConfigStore.getState().getFlag('never_configured')).toBe(true);
    expect(useConfigStore.getState().getFlag('never_configured', false)).toBe(false);
  });

  it('ignores a non-boolean flag value rather than treating it as truthy', () => {
    // A stray string like "false" from a config edit must not read as true.
    useConfigStore.setState({ featureFlags: { odd: 'false' } as any });
    expect(useConfigStore.getState().getFlag('odd', false)).toBe(false);
  });

  it('setFeatureFlag overrides a single flag without dropping the rest', () => {
    useConfigStore.getState().setConfig(validPayload);
    useConfigStore.getState().setFeatureFlag('maintenance_mode', true);
    expect(useConfigStore.getState().getFlag('maintenance_mode')).toBe(true);
    expect(useConfigStore.getState().getFlag('games_enabled')).toBe(true);
  });
});

describe('useConfigStore — screen sections', () => {
  it('returns only enabled sections, ordered by sortOrder', () => {
    useConfigStore.getState().setConfig(validPayload);
    expect(useConfigStore.getState().getSections('HOME').map((s) => s.sectionKey)).toEqual(['streak', 'missions']);
  });

  it('returns an empty list for a screen with no configured sections', () => {
    useConfigStore.getState().setConfig(validPayload);
    expect(useConfigStore.getState().getSections('NOT_A_SCREEN')).toEqual([]);
  });
});

describe('useConfigStore — daily cap policies', () => {
  it('falls back to the DEFAULT policy for an unknown tier', () => {
    useConfigStore.getState().setConfig(validPayload);
    expect(useConfigStore.getState().getCapPolicy('PLATINUM')?.maxCoinsPerDay).toBe(1000);
  });

  it('prefers a tier-specific policy when one exists', () => {
    useConfigStore.getState().setConfig({
      ...validPayload,
      dailyCapPolicies: {
        DEFAULT: { maxCoinsPerDay: 1000, minCooldownSeconds: 30 },
        TRUSTED: { maxCoinsPerDay: 5000, minCooldownSeconds: 10 },
      },
    } as any);
    expect(useConfigStore.getState().getCapPolicy('TRUSTED')?.maxCoinsPerDay).toBe(5000);
  });
});
