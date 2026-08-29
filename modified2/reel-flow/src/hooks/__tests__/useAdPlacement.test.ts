import { renderHook, act } from '@testing-library/react-native';
import { useAdPlacement, isAdPenalized, getAdPenaltyRemainingSeconds } from '../useAdPlacement';
import { useConfigStore } from '../../store/useConfigStore';
import { useAppStore } from '../../store/useAppStore';

// The real store persists via a dynamic import of expo-secure-store, which
// Jest's CJS runtime can't load; this hook only touches a few numeric fields.
jest.mock('../../store/useAppStore', () => {
  let state: any = { adPenaltyUntil: 0, lastAnyAdTimestamp: 0 };
  return {
    useAppStore: {
      getState: () => state,
      setState: (next: any) => { state = { ...state, ...(typeof next === 'function' ? next(state) : next) }; },
    },
  };
});

const PLACEMENT = 'test_placement';

const setPlacement = (overrides: Record<string, unknown> = {}) => {
  useConfigStore.setState({
    adPlacements: {
      [PLACEMENT]: {
        screen: 'SHORTS', adFormat: 'REWARDED', enabled: true,
        intervalMin: 3, intervalMax: 3, cooldownSeconds: 30,
        maxPerSession: 2, skipFirstNActions: 2, adUnitKey: 'REWARDED',
        ...overrides,
      },
    } as any,
    dailyCapPolicies: { DEFAULT: { maxCoinsPerDay: 1000, minCooldownSeconds: 0 } } as any,
  });
};

beforeEach(() => {
  setPlacement();
  useAppStore.setState({ adPenaltyUntil: 0, lastAnyAdTimestamp: 0 });
});

/**
 * This hook decides when a user is shown a rewarded ad. Getting it wrong in
 * either direction is costly: too eager risks an AdMob policy strike for
 * invalid traffic, too shy costs revenue.
 */
describe('useAdPlacement — eligibility', () => {
  it('allows an ad once interval, cooldown and warm-up are all satisfied', () => {
    const { result } = renderHook(() => useAdPlacement(PLACEMENT));
    expect(result.current.canShow(5, 10)).toBe(true);
  });

  it('suppresses ads during the first N actions of a session', () => {
    const { result } = renderHook(() => useAdPlacement(PLACEMENT));
    expect(result.current.canShow(10, 1)).toBe(false);
    expect(result.current.canShow(10, 2)).toBe(true);
  });

  it('suppresses an ad before enough items have passed since the last one', () => {
    const { result } = renderHook(() => useAdPlacement(PLACEMENT));
    expect(result.current.canShow(2, 10)).toBe(false);
  });

  it('respects a disabled placement, which is how an admin kills a slot remotely', () => {
    setPlacement({ enabled: false });
    const { result } = renderHook(() => useAdPlacement(PLACEMENT));
    expect(result.current.canShow(100, 100)).toBe(false);
  });

  it('enforces the per-session cap', () => {
    const { result } = renderHook(() => useAdPlacement(PLACEMENT));
    // maxPerSession is 2; record two shows, with cooldown neutralized so the
    // cap is unambiguously what blocks the third.
    act(() => { result.current.recordShown(); });
    act(() => { result.current.recordShown(); });
    act(() => { setPlacement({ cooldownSeconds: 0 }); });
    expect(result.current.canShow(100, 100)).toBe(false);
  });

  it('enforces the per-placement cooldown right after showing an ad', () => {
    const { result } = renderHook(() => useAdPlacement(PLACEMENT));
    act(() => { result.current.recordShown(); });
    expect(result.current.canShow(100, 100)).toBe(false);
  });

  it('enforces the global cross-placement cooldown', () => {
    setPlacement({ cooldownSeconds: 0 });
    act(() => {
      useConfigStore.setState({ dailyCapPolicies: { DEFAULT: { maxCoinsPerDay: 1000, minCooldownSeconds: 60 } } as any });
    });
    useAppStore.setState({ lastAnyAdTimestamp: Date.now() });
    const { result } = renderHook(() => useAdPlacement(PLACEMENT));
    expect(result.current.canShow(100, 100)).toBe(false);
  });

  it('falls back to safe defaults when the placement is not configured at all', () => {
    useConfigStore.setState({ adPlacements: {} as any });
    const { result } = renderHook(() => useAdPlacement('missing_placement'));
    expect(result.current.config).toBeUndefined();
    // Warm-up still applies, so an unconfigured placement can't fire immediately.
    expect(result.current.canShow(100, 0)).toBe(false);
    expect(() => result.current.canShow(100, 100)).not.toThrow();
  });
});

describe('useAdPlacement — ad-farming penalty', () => {
  it('blocks ads entirely while a backend farming penalty is active', () => {
    useAppStore.setState({ adPenaltyUntil: Date.now() + 60_000 });
    const { result } = renderHook(() => useAdPlacement(PLACEMENT));
    expect(result.current.canShow(100, 100)).toBe(false);
  });

  it('resumes ads once the penalty expires', () => {
    useAppStore.setState({ adPenaltyUntil: Date.now() - 1000 });
    const { result } = renderHook(() => useAdPlacement(PLACEMENT));
    expect(result.current.canShow(100, 100)).toBe(true);
  });

  it('isAdPenalized reflects an active penalty, for triggers outside the feed', () => {
    useAppStore.setState({ adPenaltyUntil: Date.now() + 60_000 });
    expect(isAdPenalized()).toBe(true);
    useAppStore.setState({ adPenaltyUntil: Date.now() - 1 });
    expect(isAdPenalized()).toBe(false);
  });

  it('isAdPenalized is false when no penalty has ever been set', () => {
    useAppStore.setState({ adPenaltyUntil: 0 });
    expect(isAdPenalized()).toBe(false);
  });

  it('reports remaining penalty seconds for the user-facing message', () => {
    useAppStore.setState({ adPenaltyUntil: Date.now() + 30_000 });
    const remaining = getAdPenaltyRemainingSeconds();
    expect(remaining).toBeGreaterThan(28);
    expect(remaining).toBeLessThanOrEqual(30);
  });

  it('never reports negative remaining seconds after expiry', () => {
    useAppStore.setState({ adPenaltyUntil: Date.now() - 60_000 });
    expect(getAdPenaltyRemainingSeconds()).toBe(0);
  });
});

describe('useAdPlacement — interval rolling', () => {
  it('rolls an interval within the configured bounds', () => {
    setPlacement({ intervalMin: 4, intervalMax: 8 });
    const { result } = renderHook(() => useAdPlacement(PLACEMENT));
    for (let i = 0; i < 50; i++) {
      const n = result.current.rollInterval();
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(8);
    }
  });

  it('can roll the exact bound when min equals max', () => {
    setPlacement({ intervalMin: 5, intervalMax: 5 });
    const { result } = renderHook(() => useAdPlacement(PLACEMENT));
    expect(result.current.rollInterval()).toBe(5);
  });

  it('uses a safe fallback interval when unconfigured', () => {
    useConfigStore.setState({ adPlacements: {} as any });
    const { result } = renderHook(() => useAdPlacement('missing_placement'));
    expect(result.current.rollInterval()).toBe(5);
  });
});
