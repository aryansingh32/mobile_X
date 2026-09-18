import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Mirrors the web `prefers-reduced-motion` media query for RN screens that
 * run their own decorative Animated loops (falling embers, floating chips,
 * breathing glows) — those have no scroll/CSS layer to hook a media query
 * into, so this is the only way to honor the OS-level "Reduce Motion"
 * accessibility setting. Screens should skip starting/rendering purely
 * decorative loops when this is true; one-shot entrance transitions are fine
 * either way.
 */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
};
