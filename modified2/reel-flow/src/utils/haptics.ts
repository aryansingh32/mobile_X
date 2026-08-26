import * as Haptics from 'expo-haptics';
import { useConfigStore } from '../store/useConfigStore';
import { useAppStore } from '../store/useAppStore';

type HapticType = 'impact-light' | 'impact-medium' | 'impact-heavy' | 'success' | 'warning' | 'error' | 'selection';

/**
 * Admin-gated haptic feedback wrapper.
 * Replaces all direct Haptics.impactAsync / Haptics.notificationAsync calls.
 *
 * Checks the user's local hapticsEnabled preference first (from useAppStore),
 * then falls back to the master `haptics_enabled` remote flag, then an optional
 * sub-flag (e.g., 'haptics_ad_reward', 'haptics_navigation') for granular control.
 *
 * Usage:
 *   triggerHaptic('success', 'haptics_ad_reward');
 *   triggerHaptic('impact-light');
 *   triggerHaptic('selection', 'haptics_navigation');
 */
export const triggerHaptic = (type: HapticType, subFlag?: string): void => {
  // Primary gate: user's local preference (persisted to AsyncStorage)
  const hapticsEnabled = useAppStore.getState().hapticsEnabled;
  if (!hapticsEnabled) return;

  // Secondary gate: remote config feature flags
  const flags = useConfigStore.getState().featureFlags;

  // Master remote kill switch
  if (flags['haptics_enabled'] === false) return;

  // Granular sub-flag
  if (subFlag && flags[subFlag] === false) return;

  switch (type) {
    case 'impact-light':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case 'impact-medium':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case 'impact-heavy':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      break;
    case 'success':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'warning':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
    case 'error':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      break;
    case 'selection':
      Haptics.selectionAsync();
      break;
  }
};
