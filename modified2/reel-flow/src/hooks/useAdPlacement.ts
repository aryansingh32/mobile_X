import { useRef, useCallback } from 'react';
import { useConfigStore, AdPlacementConfig } from '../store/useConfigStore';
import { useAppStore } from '../store/useAppStore';

interface AdPlacementState {
  config: AdPlacementConfig | undefined;
  rollInterval: () => number;
  canShow: (itemsSincePlacement: number, sessionActionCount: number) => boolean;
  recordShown: () => void;
}

/**
 * Hook that replaces hardcoded ad placement intervals with config-driven logic.
 * Reads from the remote config store and enforces per-placement and global cooldowns.
 *
 * Usage:
 *   const { canShow, rollInterval, recordShown } = useAdPlacement('discover_feed_sponsored_card');
 *   // In feed: if (canShow(cardsSinceLastAd, sessionCardCount)) { insertAdCard(); recordShown(); }
 */
/**
 * Standalone guard for ad-trigger functions that don't go through
 * useAdPlacement's canShow() feed-injection logic — e.g. GamesScreen's
 * completion interstitial, App.tsx's nav interstitial, or any already-
 * rendered ad card whose eligibility was computed before a penalty landed.
 * Every ad trigger function in the app should check this immediately
 * before calling AdMob's .load(), not just before deciding whether to show
 * a card — that's what actually stops repeated SDK calls from a farming
 * user, which is the thing that risks an AdMob policy ban.
 */
export const isAdPenalized = (): boolean => {
  return Date.now() < (useAppStore.getState().adPenaltyUntil || 0);
};

export const getAdPenaltyRemainingSeconds = (): number => {
  const remaining = (useAppStore.getState().adPenaltyUntil || 0) - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000));
};

export const useAdPlacement = (placementKey: string): AdPlacementState => {
  const config = useConfigStore((s) => s.adPlacements[placementKey]);
  const sessionCountRef = useRef(0);
  const lastShownRef = useRef(0);

  const rollInterval = useCallback((): number => {
    if (!config) return 5; // safe bundled fallback
    return Math.floor(Math.random() * (config.intervalMax - config.intervalMin + 1)) + config.intervalMin;
  }, [config]);

  const canShow = useCallback((itemsSincePlacement: number, sessionActionCount: number): boolean => {
    if (config && !config.enabled) return false;

    // Backend-computed ad-farming penalty takes priority over everything
    // else below — if the user has been flagged for repeatedly dismissing
    // rewarded ads without watching, don't even offer another ad card,
    // regardless of interval/cooldown math. See reportAdEvent in
    // src/api/config.ts and configController.ts on the backend.
    if (Date.now() < (useAppStore.getState().adPenaltyUntil || 0)) return false;

    // Skip first N actions
    if (sessionActionCount < (config?.skipFirstNActions ?? 2)) return false;

    // Session cap
    if (sessionCountRef.current >= (config?.maxPerSession ?? 20)) return false;

    // Per-placement cooldown
    const now = Date.now();
    if ((now - lastShownRef.current) / 1000 < (config?.cooldownSeconds ?? 15)) return false;

    // Global cross-placement cooldown
    const lastAnyAd = useAppStore.getState().lastAnyAdTimestamp ?? 0;
    const globalCooldown = useConfigStore.getState().dailyCapPolicies?.DEFAULT?.minCooldownSeconds ?? 45;
    if ((now - lastAnyAd) / 1000 < globalCooldown) return false;

    // Interval check
    const interval = rollInterval();
    if (itemsSincePlacement < interval) return false;

    return true;
  }, [config, rollInterval]);

  const recordShown = useCallback(() => {
    sessionCountRef.current += 1;
    lastShownRef.current = Date.now();
    // Update global ad timestamp
    useAppStore.setState({ lastAnyAdTimestamp: Date.now() });
  }, []);

  return { config, rollInterval, canShow, recordShown };
};
