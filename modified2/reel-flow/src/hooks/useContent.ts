import { useConfigStore } from '../store/useConfigStore';

/**
 * Hook to get admin-controlled content strings.
 * Falls back to the bundled default if the key is missing from remote config.
 * Every user-visible string must use this hook.
 */
export const useContent = (key: string, fallback: string): string => {
  return useConfigStore((state) => state.contentStrings[key] ?? fallback);
};
