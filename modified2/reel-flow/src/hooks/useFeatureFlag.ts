import { useConfigStore } from '../store/useConfigStore';

/**
 * Hook to check admin-controlled feature flags.
 * Falls back to `true` (enabled) if the flag is missing from remote config,
 * ensuring features work by default when config hasn't loaded yet.
 */
export const useFeatureFlag = (key: string, fallback = true): boolean => {
  return useConfigStore((state) => {
    const val = state.featureFlags[key];
    return val !== undefined ? val : fallback;
  });
};
