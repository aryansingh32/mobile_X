import { reportAdEvent } from '../api/config';
import { useAppStore } from '../store/useAppStore';

type AdEventPayload = {
  placementKey: string;
  adType: string;
  eventType: string;
  screen: string;
  sessionId: string;
  errorCode?: string;
  latencyMs?: number;
};

/**
 * Reports an ad lifecycle event and, if the backend responds with a
 * farming penalty (only possible on DISMISSED/ABANDONED — see
 * reportAdEvent in configController.ts), stores it so every ad trigger
 * point in the app immediately stops offering rewarded ads until it
 * expires. Use this instead of calling api/config's reportAdEvent directly
 * for CLOSED/DISMISSED handlers specifically.
 */
export const reportAdEventWithPenaltyCheck = async (event: AdEventPayload): Promise<void> => {
  // api/config.ts's reportAdEvent currently always resolves to an object, but
  // this runs inside AdMob close/dismiss callbacks — a throw here would break
  // the ad flow itself, so don't depend on that guarantee holding across files.
  const result = await reportAdEvent(event);
  if (result?.penaltyUntil) {
    useAppStore.getState().setAdPenaltyUntil(result.penaltyUntil);
  }
};

/** "Ads will be available again in 5 minutes." / "in 45 seconds." */
export const formatAdPenaltyMessage = (remainingSeconds: number): string => {
  if (remainingSeconds >= 60) {
    const minutes = Math.ceil(remainingSeconds / 60);
    return `Ads will be available again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }
  return `Ads will be available again in ${remainingSeconds} seconds.`;
};
