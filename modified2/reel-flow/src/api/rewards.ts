import apiClient from './client';

export const claimShortReward = async (videoId: string, watchSeconds: number, sessionId: string, deviceId?: string) => {
  const { data } = await apiClient.post('/api/rewards/shorts', { videoId, watchSeconds, sessionId, deviceId });
  return data as { message: string; coinsEarned: number };
};

export const claimAdReward = async (adType: string, adSessionId: string) => {
  const { data } = await apiClient.post('/api/rewards/ad', { adType, adSessionId });
  return data as { message: string; coinsEarned: number };
};

export const getRouletteConfig = async () => {
  const { data } = await apiClient.get('/api/rewards/roulette-config');
  return data as { success: boolean; data: any[] };
};

export const claimRouletteSpin = async (sessionId: string, deviceId?: string) => {
  const { data } = await apiClient.post('/api/rewards/roulette-spin', { sessionId, deviceId });
  return data as { success: boolean; coinsEarned: number; sliceIndex: number; sliceName: string; chancesRemaining: number; xpGained: number };
};
