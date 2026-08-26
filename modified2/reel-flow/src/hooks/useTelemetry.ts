import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { AppState, AppStateStatus } from 'react-native';

export const useTelemetry = () => {
  const { trackScreentime, flushTelemetryQueue } = useAppStore(useShallow(s => ({ trackScreentime: s.trackScreentime, flushTelemetryQueue: s.flushTelemetryQueue })));
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const startTracking = () => {
      // 1 minute heartbeat
      interval = setInterval(() => {
        if (appStateRef.current === 'active') {
          trackScreentime();
          flushTelemetryQueue();
        }
      }, 60000);
    };

    startTracking();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground, immediately flush queue just in case
        flushTelemetryQueue();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);
};
