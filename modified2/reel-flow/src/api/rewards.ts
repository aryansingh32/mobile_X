import apiClient from './client';

export const claimAdReward = async (adType: string, adSessionId: string) => {
  const { data } = await apiClient.post('/api/rewards/ad', { adType, adSessionId });
  return data as { message: string; coinsEarned: number };
};
