import apiClient from './client';
import { RemoteConfigPayload } from '../store/useConfigStore';

/**
 * Fetch the consolidated remote config from the backend.
 * Sends the cached version to enable 304-style diffing.
 */
export const fetchRemoteConfig = async (
  currentVersion: number
): Promise<RemoteConfigPayload | null> => {
  try {
    const { data } = await apiClient.get('/api/config/remote', {
      params: { version: currentVersion },
      timeout: 10000,
    });

    if (data.unchanged) {
      return null; // No changes, keep cached config
    }

    return data as RemoteConfigPayload;
  } catch {
    // Silently fail — app uses cached/bundled defaults
    return null;
  }
};

/**
 * Report an ad lifecycle event to the backend (fire-and-forget for most
 * event types). On DISMISSED/ABANDONED events specifically, the backend
 * computes a rolling abandonment ratio server-side and may return a
 * penaltyUntil timestamp — this is what actually enforces the "if someone
 * tries to farm the rewarded-ad card, ads show later" behavior, and it's
 * computed and owned by the backend, not a client-side heuristic.
 */
export const reportAdEvent = async (event: {
  placementKey: string;
  adType: string;
  eventType: string;
  screen: string;
  sessionId: string;
  errorCode?: string;
  latencyMs?: number;
}): Promise<{ penaltyUntil?: number; penaltySeconds?: number }> => {
  try {
    const { data, status } = await apiClient.post('/api/config/ad-event', event, { timeout: 5000 });
    if (status === 200 && data?.penaltyUntil) {
      return { penaltyUntil: data.penaltyUntil, penaltySeconds: data.penaltySeconds };
    }
    return {};
  } catch {
    // Fire-and-forget — never block ad UX
    return {};
  }
};
