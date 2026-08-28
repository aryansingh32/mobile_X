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
 * Fetch the small, unauthenticated subset of config exposed pre-login —
 * currently just maintenance mode. GET /api/config/remote requires a token,
 * so without this, a logged-out or still-onboarding user never learns the
 * backend is in maintenance mode until a login attempt fails outright.
 */
export const fetchPublicStatus = async (): Promise<{ maintenanceMode: boolean } | null> => {
  try {
    const { data } = await apiClient.get('/api/config', { timeout: 10000 });
    return { maintenanceMode: !!data?.maintenanceMode };
  } catch {
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
