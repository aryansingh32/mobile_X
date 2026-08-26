import React, { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useConfigStore } from '../store/useConfigStore';
import { useAppStore } from '../store/useAppStore';
import { fetchRemoteConfig } from '../api/config';

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * RemoteConfigProvider
 *
 * Wraps the entire app. On mount:
 * 1. Loads cached config from AsyncStorage immediately (no loading flash — Zustand persist handles this).
 * 2. Fetches GET /api/config/remote?version={cachedVersion} in background.
 * 3. On response: if changed, merges into configStore and persists to AsyncStorage.
 *
 * Refresh triggers:
 * - App foreground event (returning from background)
 * - Every 15 minutes while foregrounded
 *
 * Never blocks rendering — if fetch fails, app uses cached/bundled defaults.
 */
export const RemoteConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useAppStore((s) => s.token);
  const configVersion = useConfigStore((s) => s.version);
  const setConfig = useConfigStore((s) => s.setConfig);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);

  const doFetch = useCallback(async () => {
    if (!token) return; // Can't fetch without auth
    // Mount, foreground, and the 15-minute interval can all land within
    // moments of each other — skip if a fetch is already in flight instead
    // of firing overlapping requests.
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const result = await fetchRemoteConfig(configVersion);
      if (result) {
        setConfig(result);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [token, configVersion, setConfig]);

  // Fetch on mount and token change
  useEffect(() => {
    doFetch();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic refresh every 15 minutes
  useEffect(() => {
    if (!token) return;

    intervalRef.current = setInterval(doFetch, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, doFetch]);

  // Refresh on app foreground
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        doFetch();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [doFetch]);

  return <>{children}</>;
};
